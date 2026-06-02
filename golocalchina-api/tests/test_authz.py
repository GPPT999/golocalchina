"""Authorization boundary tests for private API endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.booking import ServiceRequest
from app.models.listing import GuideListing
from app.models.user import GuideProfile, TouristProfile, User


async def make_user(
    db: AsyncSession,
    *,
    email: str,
    role: str,
    display_name: str,
) -> User:
    user = User(
        email=email,
        password_hash=hash_password("Test#1234"),
        role=role,
        status="active",
    )
    db.add(user)
    await db.flush()

    if role == "tourist":
        db.add(TouristProfile(user_id=user.id, display_name=display_name))
    elif role == "guide":
        db.add(
            GuideProfile(
                user_id=user.id,
                legal_name=display_name,
                display_name=display_name,
                kyc_status="approved",
            )
        )
    await db.flush()
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role)}"}


@pytest.mark.asyncio
async def test_profile_me_requires_bearer_token(client: AsyncClient):
    resp = await client.get("/api/v1/profile/me")

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_profile_me_uses_token_subject_even_when_query_user_id_differs(
    client: AsyncClient,
    db_session: AsyncSession,
):
    alice = await make_user(db_session, email="alice@test.com", role="tourist", display_name="Alice")
    bob = await make_user(db_session, email="bob@test.com", role="tourist", display_name="Bob")

    resp = await client.get(
        f"/api/v1/profile/me?user_id={bob.id}",
        headers=auth_headers(alice),
    )

    assert resp.status_code == 200
    assert resp.json()["id"] == alice.id
    assert resp.json()["display_name"] == "Alice"


@pytest.mark.asyncio
async def test_service_request_create_requires_bearer_token(client: AsyncClient):
    resp = await client.post(
        "/api/v1/service-requests",
        json={
            "guide_user_id": "guide-id",
            "service_date": "2026-06-10",
            "party_size": 2,
            "language": "en",
        },
    )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_service_request_create_uses_authenticated_tourist_not_query_param(
    client: AsyncClient,
    db_session: AsyncSession,
):
    alice = await make_user(db_session, email="alice2@test.com", role="tourist", display_name="Alice")
    bob = await make_user(db_session, email="bob2@test.com", role="tourist", display_name="Bob")
    guide = await make_user(db_session, email="guide@test.com", role="guide", display_name="Guide")

    resp = await client.post(
        f"/api/v1/service-requests?tourist_user_id={bob.id}",
        headers=auth_headers(alice),
        json={
            "guide_user_id": guide.id,
            "service_date": "2026-06-10",
            "party_size": 2,
            "language": "en",
        },
    )

    assert resp.status_code == 201
    assert resp.json()["tourist_user_id"] == alice.id


@pytest.mark.asyncio
async def test_guide_cannot_accept_another_guides_request(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="tourist@test.com", role="tourist", display_name="Tourist")
    guide_a = await make_user(db_session, email="guidea@test.com", role="guide", display_name="Guide A")
    guide_b = await make_user(db_session, email="guideb@test.com", role="guide", display_name="Guide B")
    request = ServiceRequest(
        tourist_user_id=tourist.id,
        guide_user_id=guide_b.id,
        service_date="2026-06-10",
        party_size=2,
        language="en",
        quoted_amount=0,
        quoted_currency="CNY",
        status="pending",
    )
    db_session.add(request)
    await db_session.flush()

    resp = await client.put(
        f"/api/v1/service-requests/{request.id}/accept?guide_user_id={guide_b.id}",
        headers=auth_headers(guide_a),
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_listing_create_requires_guide_role(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="tourist2@test.com", role="tourist", display_name="Tourist")

    resp = await client.post(
        "/api/v1/listings",
        headers=auth_headers(tourist),
        json={
            "title": "Forbidden City Morning",
            "summary": "A thoughtful morning walk through Beijing history.",
            "description_md": "We explore the palace axis and nearby hutongs with context.",
            "city": "Beijing",
            "languages": ["en"],
            "price_amount": 500,
        },
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_listing_update_uses_authenticated_guide_not_query_param(
    client: AsyncClient,
    db_session: AsyncSession,
):
    guide_a = await make_user(db_session, email="guidec@test.com", role="guide", display_name="Guide C")
    guide_b = await make_user(db_session, email="guided@test.com", role="guide", display_name="Guide D")
    listing = GuideListing(
        guide_user_id=guide_b.id,
        title="Original Title",
        summary="Original summary for the tour.",
        description_md="Original description for the tour with enough words.",
        city="Beijing",
        languages=["en"],
        price_amount=500,
        status="published",
    )
    db_session.add(listing)
    await db_session.flush()

    resp = await client.put(
        f"/api/v1/listings/{listing.id}?guide_user_id={guide_b.id}",
        headers=auth_headers(guide_a),
        json={"title": "Hijacked Title"},
    )

    assert resp.status_code == 404
