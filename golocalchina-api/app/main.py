"""FastAPI application — GoLocalChina API.

Merged from golocalchina-backend engineering improvements:
- Security headers (OWASP baseline)
- Request context middleware (request_id, locale, timing)
- Structured logging via structlog
- Exception handling
"""
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.api.v1.auth import router as auth_router
from app.api.v1.guides import router as guides_router
from app.api.v1.service_requests import router as sr_router
from app.api.v1.profile import router as profile_router
from app.api.v1.listings import router as listings_router
from app.api.v1.explore import router as explore_router
from app.api.v1.reviews import router as reviews_router
from app.api.v1.posts import router as posts_router
from app.api.v1.compliance import router as compliance_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    # Auto-seed demo data if DB is empty (Railway wipes /tmp on redeploy)
    from seed_on_start import seed
    await seed()
    yield


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach request_id and locale to every request; emit timing log."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        # i18n: honour Accept-Language but only allow supported locales
        al = request.headers.get("accept-language", "en-US")
        locale = "en-US"
        supported = ["en-US", "zh-CN", "ja-JP", "ko-KR", "fr-FR"]
        for tag in (t.strip().split(";")[0] for t in al.split(",")):
            if tag in supported:
                locale = tag
                break
        request.state.request_id = rid
        request.state.locale = locale

        t0 = time.perf_counter()
        response = await call_next(request)
        dt_ms = (time.perf_counter() - t0) * 1000.0

        response.headers["x-request-id"] = rid
        response.headers["content-language"] = locale
        # OWASP baseline security headers
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["x-frame-options"] = "DENY"
        response.headers["referrer-policy"] = "no-referrer"
        response.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains"
        
        # Structured log (if structlog available)
        try:
            import structlog
            log = structlog.get_logger()
            log.info(
                "http.request",
                request_id=rid,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=round(dt_ms, 2),
                locale=locale,
            )
        except ImportError:
            pass  # structlog not installed, skip logging
        
        return response


app = FastAPI(
    title="GoLocalChina API",
    description="Information service platform connecting foreign tourists with local guides in China. Not a travel agency.",
    version="0.2.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RequestContextMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return structured error."""
    rid = getattr(request.state, "request_id", None)
    try:
        import structlog
        log = structlog.get_logger()
        log.exception("http.unhandled", request_id=rid)
    except ImportError:
        pass
    return JSONResponse(
        status_code=500,
        content={"detail": "internal_server_error", "request_id": rid},
    )


app.include_router(auth_router, prefix="/api/v1")
app.include_router(guides_router, prefix="/api/v1")
app.include_router(sr_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(listings_router, prefix="/api/v1")
app.include_router(explore_router, prefix="/api/v1")
app.include_router(reviews_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
app.include_router(compliance_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "platform": "GoLocalChina", "version": "0.2.0"}
