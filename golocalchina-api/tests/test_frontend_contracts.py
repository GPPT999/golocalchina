"""Contract checks for the web app changes that do not require npm."""
from pathlib import Path


WEB_SRC = Path(__file__).resolve().parents[2] / "golocalchina-web" / "src"


def read_web_source(relative_path: str) -> str:
    return (WEB_SRC / relative_path).read_text(encoding="utf-8")


def test_private_frontend_calls_do_not_trust_user_query_params():
    source = "\n".join(path.read_text(encoding="utf-8") for path in WEB_SRC.rglob("*.tsx"))

    forbidden_tokens = [
        "user_id=",
        "guide_user_id=",
        "tourist_user_id=",
        "reviewer_user_id=",
        "author_user_id=",
    ]

    for token in forbidden_tokens:
        assert token not in source


def test_api_client_sends_jwt_bearer_token():
    source = read_web_source("services/api.ts")

    assert "localStorage.getItem('glc_token')" in source
    assert "config.headers.Authorization = `Bearer ${token}`" in source


def test_guide_detail_uses_live_api_instead_of_mock_data():
    source = read_web_source("pages/GuideDetailPage.tsx")

    assert "MOCK_DETAIL" not in source
    assert "api.get(`/guides/${id}`)" in source
    assert "setGuide(res.data)" in source


def test_guide_detail_uses_safe_api_defaults_and_controlled_request_form():
    source = read_web_source("pages/GuideDetailPage.tsx")

    assert "const asStringArray = (value: unknown): string[]" in source
    assert "const listings = Array.isArray(guide.listings) ? guide.listings : []" in source
    assert "document.querySelector" not in source
    assert "querySelectorAll" not in source
    assert "value={requestForm.service_date}" in source
    assert "party_size: parseInt(requestForm.party_size || '1', 10)" in source


def test_listing_detail_uses_controlled_request_form():
    source = read_web_source("pages/ListingDetailPage.tsx")

    assert "document.querySelector" not in source
    assert "querySelectorAll" not in source
    assert "value={requestForm.service_date}" in source
    assert "party_size: parseInt(requestForm.party_size || '1', 10)" in source
