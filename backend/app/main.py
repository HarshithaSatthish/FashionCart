import logging
import time
from sqlalchemy import text
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import configure_logging
from app.api import auth_routes, user_routes, product_routes, customer_routes, order_routes, transaction_routes, analysis_routes, recommendation_routes, dashboard_routes

configure_logging()
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Database schema initialization deferred: %s", exc)
    yield


app = FastAPI(
    title="FashionCart – Clothing Purchase Pattern & Recommendation API",
    version="1.0.0",
    description="Production-style clothing analytics backend using Apriori association-rule mining.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    logger.info(
        "%s %s status=%s elapsed_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        int((time.perf_counter() - started) * 1000),
    )
    return response


@app.get("/health", tags=["System"], summary="Health check")
def health():
    return {"status": "ok", "service": "fashioncart-api"}


@app.get("/health/ready", tags=["System"], summary="Readiness check")
def readiness():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}


for router in [
    auth_routes.router,
    user_routes.router,
    product_routes.router,
    customer_routes.router,
    order_routes.router,
    order_routes.customer_router,
    transaction_routes.router,
    analysis_routes.router,
    recommendation_routes.router,
    dashboard_routes.router,
]:
    app.include_router(router, prefix=settings.api_prefix)
