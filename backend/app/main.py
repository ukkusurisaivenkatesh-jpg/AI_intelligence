from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base
from . import models
from .routers import auth as auth_router, students, admissions, knowledge, careers, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from sqlalchemy.orm import Session
    from .seed import seed
    db = Session(bind=engine)
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="AdmitWise AI", version="1.0.0", lifespan=lifespan)
cors_origins = [x.strip() for x in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in cors_origins else cors_origins,
    allow_credentials=False if "*" in cors_origins else True,
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
    return {"status": "ok", "service": "AdmitWise AI"}
