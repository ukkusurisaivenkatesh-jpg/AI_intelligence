import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from .database import engine, Base
from .config import settings
from . import models
from .routers import auth as auth_router, students, admissions, knowledge, careers, admin


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.app_env in {"development", "test"}:
        Base.metadata.create_all(bind=engine)
        from sqlalchemy.orm import Session
        from .seed import seed
        from .catalogue import seed_catalogue

        with Session(bind=engine) as db:
            seed(db)
            seed_catalogue(db)
    yield


app = FastAPI(title="AdmitWise AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(students.router)
app.include_router(admissions.router)
app.include_router(knowledge.router)
app.include_router(careers.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.error("Database health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "service": "AdmitWise AI", "database": "unavailable"},
        )
    return {"status": "ok", "service": "AdmitWise AI", "database": "available"}
