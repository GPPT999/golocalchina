"""Real guide detail and authenticated request-flow tests."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Review, ServiceRequest
from app.models.listing import GuideListing
from app.models.post import TouristPost
from tests.test_authz import auth_headers, make_user


@pytest.mark.asyncio
async def test_guide_detail_returns_database_listing_fields(
    client: AsyncClient,
    db_session: AsyncSession,
):
    guide = await make_user(db_session, email="real-guide@test.com", role="guide", display_name="Real Guide")
    listing = GuideListing(
        guide_user_id=guide.id,
        title="Real Hutong Walk",
        summary="A real listing from the database.",
        description_md="A full itinerary from the database with enough detail for travelers.",
        city="Beijing",
        languages=["en", "zh"],
        price_amount=688,
        price_currency="CNY",
        price_unit="per_half_day",
        cover_image_url="/images/Beijing.jpg",
        images=["/images/Beijing.jpg"],
        map_links=["https://maps.example/meeting-point"],
        status="published",
    )
    db_session.add(listing)
    await db_session.flush()

    resp = await client.get(f"/api/v1/guides/{guide.id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == guide.id
    assert data["display_name"] == "Real Guide"
    assert data["listings"][0]["id"] == listing.id
    assert data["listings"][0]["description_md"] == listing.description_md
    assert data["listings"][0]["cover_image_url"] == "/images/Beijing.jpg"
    assert data["listings"][0]["images"] == ["/images/Beijing.jpg"]
    assert data["listings"][0]["map_links"] == ["https://maps.example/meeting-point"]


@pytest.mark.asyncio
async def test_authenticated_tourist_request_appears_in_mine(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="request-tourist@test.com", role="tourist", display_name="Tourist")
    guide = await make_user(db_session, email="request-guide@test.com", role="guide", display_name="Guide")

    create_resp = await client.post(
        "/api/v1/service-requests",
        headers=auth_headers(tourist),
        json={
            "guide_user_id": guide.id,
            "service_date": "2026-06-12",
            "service_time_hour": 9,
            "party_size": 3,
            "language": "en",
            "tourist_notes": "We like history.",
        },
    )
    assert create_resp.status_code == 201

    mine_resp = await client.get(
        "/api/v1/service-requests/mine",
        headers=auth_headers(tourist),
    )

    assert mine_resp.status_code == 200
    requests = mine_resp.json()
    assert len(requests) == 1
    assert requests[0]["id"] == create_resp.json()["id"]
    assert requests[0]["tourist_user_id"] == tourist.id
    assert requests[0]["guide_user_id"] == guide.id
    assert requests[0]["tourist_notes"] == "We like history."


@pytest.mark.asyncio
async def test_tourist_requests_include_review_status(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="reviewed-tourist@test.com", role="tourist", display_name="Tourist")
    guide = await make_user(db_session, email="reviewed-guide@test.com", role="guide", display_name="Guide")
    reviewed_request = ServiceRequest(
        tourist_user_id=tourist.id,
        guide_user_id=guide.id,
        service_date="2026-06-12",
        party_size=2,
        language="en",
        quoted_amount=100,
        quoted_currency="CNY",
        status="met",
    )
    unreviewed_request = ServiceRequest(
        tourist_user_id=tourist.id,
        guide_user_id=guide.id,
        service_date="2026-06-13",
        party_size=2,
        language="en",
        quoted_amount=100,
        quoted_currency="CNY",
        status="met",
    )
    db_session.add_all([reviewed_request, unreviewed_request])
    await db_session.flush()

    db_session.add(
        Review(
            service_request_id=reviewed_request.id,
            reviewer_user_id=tourist.id,
            target_user_id=guide.id,
            stars=5,
            text="Helpful local context.",
        )
    )
    await db_session.flush()

    mine_resp = await client.get(
        "/api/v1/service-requests/mine",
        headers=auth_headers(tourist),
    )

    assert mine_resp.status_code == 200
    requests_by_id = {request["id"]: request for request in mine_resp.json()}
    assert requests_by_id[reviewed_request.id]["has_review"] is True
    assert requests_by_id[unreviewed_request.id]["has_review"] is False


@pytest.mark.asyncio
async def test_service_request_rejects_listing_from_a_different_guide(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="mismatch-tourist@test.com", role="tourist", display_name="Tourist")
    guide_a = await make_user(db_session, email="mismatch-guide-a@test.com", role="guide", display_name="Guide A")
    guide_b = await make_user(db_session, email="mismatch-guide-b@test.com", role="guide", display_name="Guide B")
    listing = GuideListing(
        guide_user_id=guide_b.id,
        title="Guide B Walk",
        summary="A listing owned by another guide.",
        description_md="This listing belongs to Guide B and should not be attachable to Guide A.",
        city="Beijing",
        languages=["en"],
        price_amount=900,
        status="published",
    )
    db_session.add(listing)
    await db_session.flush()

    resp = await client.post(
        "/api/v1/service-requests",
        headers=auth_headers(tourist),
        json={
            "guide_user_id": guide_a.id,
            "listing_id": listing.id,
            "service_date": "2026-06-12",
            "party_size": 2,
            "language": "en",
        },
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Listing does not belong to the selected guide"


@pytest.mark.asyncio
async def test_service_request_rejects_unpublished_listing(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="draft-tourist@test.com", role="tourist", display_name="Tourist")
    guide = await make_user(db_session, email="draft-guide@test.com", role="guide", display_name="Guide")
    listing = GuideListing(
        guide_user_id=guide.id,
        title="Draft Walk",
        summary="A draft listing not ready for booking.",
        description_md="This draft listing should not be available for service requests yet.",
        city="Beijing",
        languages=["en"],
        price_amount=900,
        status="draft",
    )
    db_session.add(listing)
    await db_session.flush()

    resp = await client.post(
        "/api/v1/service-requests",
        headers=auth_headers(tourist),
        json={
            "guide_user_id": guide.id,
            "listing_id": listing.id,
            "service_date": "2026-06-12",
            "party_size": 2,
            "language": "en",
        },
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Listing is not available"


@pytest.mark.asyncio
async def test_service_request_rejects_non_guide_recipient(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="recipient-tourist@test.com", role="tourist", display_name="Tourist")
    other_tourist = await make_user(db_session, email="recipient-other@test.com", role="tourist", display_name="Other")

    resp = await client.post(
        "/api/v1/service-requests",
        headers=auth_headers(tourist),
        json={
            "guide_user_id": other_tourist.id,
            "service_date": "2026-06-12",
            "party_size": 2,
            "language": "en",
        },
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Selected guide is not available"


@pytest.mark.asyncio
async def test_authenticated_user_can_list_liked_post_ids(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="post-tourist@test.com", role="tourist", display_name="Tourist")
    post = TouristPost(
        author_user_id=tourist.id,
        title="Beijing question",
        content="What is a good local walk near the Drum Tower?",
        images=[],
        is_done=False,
        view_count=0,
        like_count=0,
    )
    db_session.add(post)
    await db_session.flush()

    like_resp = await client.post(
        f"/api/v1/posts/{post.id}/like",
        headers=auth_headers(tourist),
    )
    assert like_resp.status_code == 200

    liked_resp = await client.get(
        "/api/v1/posts/liked",
        headers=auth_headers(tourist),
    )

    assert liked_resp.status_code == 200
    assert liked_resp.json()["liked_post_ids"] == [post.id]


@pytest.mark.parametrize("action", ["accept", "decline"])
@pytest.mark.asyncio
async def test_completed_request_cannot_return_to_an_earlier_state(
    action: str,
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(
        db_session,
        email=f"completed-{action}-tourist@test.com",
        role="tourist",
        display_name="Tourist",
    )
    guide = await make_user(
        db_session,
        email=f"completed-{action}-guide@test.com",
        role="guide",
        display_name="Guide",
    )
    request = ServiceRequest(
        tourist_user_id=tourist.id,
        guide_user_id=guide.id,
        service_date="2026-06-12",
        party_size=2,
        language="en",
        quoted_amount=100,
        quoted_currency="CNY",
        status="met",
    )
    db_session.add(request)
    await db_session.flush()

    response = await client.put(
        f"/api/v1/service-requests/{request.id}/{action}",
        headers=auth_headers(guide),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Can only update pending requests"
