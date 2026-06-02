"""Compliance MVP tests: consent ledger and DSR requests."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_authz import auth_headers, make_user


@pytest.mark.asyncio
async def test_consent_record_and_list_for_authenticated_user(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="consent@test.com", role="tourist", display_name="Consent User")

    create_resp = await client.post(
        "/api/v1/compliance/consents",
        headers=auth_headers(tourist),
        json={
            "purpose_code": "PROCESS_SERVICE_REQUEST",
            "policy_version": "pp-2026-06-02-v1",
            "granted": True,
            "evidence_hash": "a" * 64,
            "locale": "en-US",
        },
    )

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["user_id"] == tourist.id
    assert created["purpose_code"] == "PROCESS_SERVICE_REQUEST"
    assert created["granted"] is True

    list_resp = await client.get(
        "/api/v1/compliance/consents",
        headers=auth_headers(tourist),
    )

    assert list_resp.status_code == 200
    consents = list_resp.json()
    assert len(consents) == 1
    assert consents[0]["id"] == created["id"]


@pytest.mark.asyncio
async def test_dsr_request_create_and_list_for_authenticated_user(
    client: AsyncClient,
    db_session: AsyncSession,
):
    tourist = await make_user(db_session, email="dsr@test.com", role="tourist", display_name="DSR User")

    create_resp = await client.post(
        "/api/v1/compliance/dsr-requests",
        headers=auth_headers(tourist),
        json={
            "kind": "EXPORT",
            "regime": "BOTH",
            "notes": "Please export my data.",
        },
    )

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["user_id"] == tourist.id
    assert created["kind"] == "EXPORT"
    assert created["regime"] == "BOTH"
    assert created["status"] == "OPEN"
    assert created["due_by"]

    list_resp = await client.get(
        "/api/v1/compliance/dsr-requests",
        headers=auth_headers(tourist),
    )

    assert list_resp.status_code == 200
    requests = list_resp.json()
    assert len(requests) == 1
    assert requests[0]["id"] == created["id"]


@pytest.mark.asyncio
async def test_compliance_endpoints_require_bearer_token(client: AsyncClient):
    consent_resp = await client.get("/api/v1/compliance/consents")
    dsr_resp = await client.get("/api/v1/compliance/dsr-requests")

    assert consent_resp.status_code == 401
    assert dsr_resp.status_code == 401
