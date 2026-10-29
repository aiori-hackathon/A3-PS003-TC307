import os
import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Automatically load backend/.env if present
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path, override=True)
else:
    load_dotenv(override=True)

logger = logging.getLogger("main")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import engine, Base, SessionLocal
from backend.app.services.traffic_history import migrate_database, historical_observation_service
from backend.app.services.traffic_provider import traffic_provider_instance
from backend.app.services.seed_data import seed_database
from backend.app.services.auth import seed_demo_user
from backend.app.api.endpoints import router as api_router
from backend.app.api.auth import router as auth_router


async def background_traffic_poller(shutdown_event: asyncio.Event):
    """
    Continuous background polling task for genuine traffic telemetry and incidents.
    Safe, rate-limit aware, and configurable via TRAFFIC_REFRESH_INTERVAL_SECONDS.
    """
    logger.info("Background traffic polling service started.")
    while not shutdown_event.is_set():
        interval = float(os.getenv("TRAFFIC_REFRESH_INTERVAL_SECONDS", "300.0"))
        try:
            traffic_provider_instance.reload_config()
            if traffic_provider_instance.mode == "live" and traffic_provider_instance.api_key:
                db = SessionLocal()
                try:
                    await historical_observation_service.coordinate_collection_and_storage(db, force=False)
                    await historical_observation_service.coordinate_incident_collection_and_storage(db, force=False)
                finally:
                    db.close()
        except Exception as exc:
            logger.warning(f"Background traffic poller error: {exc}")

        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass
    logger.info("Background traffic polling service stopped gracefully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & run safe additive schema migrations
    Base.metadata.create_all(bind=engine)
    migrate_database(engine)
    db = SessionLocal()
    try:
        seed_database(db)
        seed_demo_user(db)
    finally:
        db.close()

    shutdown_event = asyncio.Event()
    polling_task = None
    enable_polling = os.getenv("TRAFFIC_BACKGROUND_POLLING", "true").lower() in ("true", "1", "yes")

    if enable_polling:
        polling_task = asyncio.create_task(background_traffic_poller(shutdown_event))

    yield

    if polling_task:
        shutdown_event.set()
        try:
            await asyncio.wait_for(polling_task, timeout=5.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass


app = FastAPI(
    title="TrafficFlow AI — Smart City Traffic Intelligence API",
    description="Privacy-Preserving & Communication-Efficient Traffic Prediction Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Safe CORS Configuration
# Supports CORS_ALLOWED_ORIGINS (or CORS_ORIGINS) as comma-separated list
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

env_cors = os.getenv("CORS_ALLOWED_ORIGINS", "").strip() or os.getenv("CORS_ORIGINS", "").strip()
if env_cors:
    parsed = [o.strip() for o in env_cors.split(",") if o.strip()]
    # W3C CORS specification forbids wildcard "*" when allow_credentials=True
    allowed_origins = [o for o in parsed if o != "*"]
    for d in default_origins:
        if d not in allowed_origins:
            allowed_origins.append(d)
else:
    allowed_origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": "TrafficFlow AI",
        "tagline": "Predict Traffic. Prevent Congestion.",
        "description": "AI-Powered Smart City Traffic Intelligence Platform",
        "docs_url": "/docs",
        "health_check": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
