from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import auth, bot, health, logs, orders, reports
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.services.bootstrap import bootstrap_defaults
from app.services.runtime_singleton import orchestrator


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        async def send_wrapper(message):
            if message['type'] == 'http.response.start':
                headers = message.setdefault('headers', [])
                headers.extend([
                    (b'x-content-type-options', b'nosniff'),
                    (b'x-frame-options', b'DENY'),
                    (b'referrer-policy', b'no-referrer'),
                    (b'permissions-policy', b'camera=(), microphone=(), geolocation=()'),
                    (b'cache-control', b'no-store'),
                ])
            await send(message)
        await self.app(scope, receive, send_wrapper)


settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    bootstrap_defaults(db)
    db.close()
    orchestrator.start()
    yield
    orchestrator.stop()
    orchestrator.ws.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.host_allowlist)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(bot.router, prefix=settings.api_prefix)
app.include_router(orders.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(logs.router, prefix=settings.api_prefix)
