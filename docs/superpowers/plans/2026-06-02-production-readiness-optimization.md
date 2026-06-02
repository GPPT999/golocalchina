# Production Readiness Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise GoLocalChina's product, demo, engineering, and compliance scores to at least 8.0 each, with an average of at least 8.2.

**Architecture:** Prioritize the lowest-scoring areas first: API authorization, real frontend data flow, and a minimal compliance execution chain. Keep changes small and testable, using JWT-derived identity instead of trusted query parameters and adding focused API tests before implementation.

**Tech Stack:** FastAPI, SQLAlchemy async, PyJWT, pytest/httpx, React/Vite/TypeScript/MUI.

---

### Task 1: Backend Authorization Boundary

**Files:**
- Create: `golocalchina-api/app/core/auth.py`
- Modify: `golocalchina-api/app/api/v1/profile.py`
- Modify: `golocalchina-api/app/api/v1/service_requests.py`
- Modify: `golocalchina-api/app/api/v1/listings.py`
- Modify: `golocalchina-api/app/api/v1/reviews.py`
- Modify: `golocalchina-api/app/api/v1/posts.py`
- Test: `golocalchina-api/tests/test_authz.py`

- [ ] Write failing tests for missing bearer tokens and cross-user access attempts.
- [ ] Verify the tests fail because endpoints currently trust query-string user IDs.
- [ ] Add a `get_current_user` dependency that decodes access tokens and loads active users.
- [ ] Replace trusted query IDs with current-user identity on mutating and private endpoints.
- [ ] Re-run authz tests and existing API tests.

### Task 2: Real Guide Detail and Request Flow

**Files:**
- Modify: `golocalchina-web/src/services/api.ts`
- Modify: `golocalchina-web/src/pages/GuideDetailPage.tsx`
- Modify: `golocalchina-web/src/pages/DashboardPage.tsx`
- Test: backend API tests proving `/guides/{id}` and service request listing work with JWT.

- [ ] Write failing tests for authenticated service request creation and listing.
- [ ] Verify the tests fail under query-param identity behavior.
- [ ] Update API clients and pages to use bearer-token requests without identity query strings.
- [ ] Replace the hardcoded guide detail with API-loaded data and loading/error states.
- [ ] Run TypeScript build.

### Task 3: Compliance MVP

**Files:**
- Create: `golocalchina-api/app/models/compliance.py`
- Create: `golocalchina-api/app/api/v1/compliance.py`
- Modify: `golocalchina-api/app/core/database.py`
- Modify: `golocalchina-api/app/main.py`
- Test: `golocalchina-api/tests/test_compliance.py`

- [ ] Write failing tests for consent recording, consent listing, DSR creation, and DSR listing.
- [ ] Verify the tests fail because compliance endpoints do not exist.
- [ ] Add consent and DSR models with minimal fields needed for an auditable MVP.
- [ ] Add authenticated compliance endpoints.
- [ ] Re-run compliance and full backend tests.

### Task 4: Verification and Re-Scoring

**Files:**
- Modify only if verification exposes defects in tasks above.

- [ ] Run backend tests.
- [ ] Run frontend build.
- [ ] Record any environment limitations honestly.
- [ ] Re-score all four dimensions and address any dimension below 8.0 or average below 8.2.
