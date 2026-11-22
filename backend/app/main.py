import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from . import models
from .routers import auth as auth_router, students, admissions, knowledge, careers, admin


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from sqlalchemy.orm import Session
    from .seed import seed
    from .catalogue import seed_catalogue
    from .graph import KnowledgeGraph
    db = Session(bind=engine)
    try:
        seed(db)
        seed_catalogue(db)
        graph = KnowledgeGraph()
        try:
            sync_result = graph.sync_catalogue(db)
            if sync_result is None:
                logger.warning("Neo4j catalogue synchronization skipped: %s", graph.error)
            else:
                logger.info(
                    "Synchronized %s institutions and %s programmes to Neo4j",
                    sync_result["universities"],
                    sync_result["programmes"],
                )
        finally:
            graph.close()
    finally:
        db.close()
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
    return {"status": "ok", "service": "AdmitWise AI"}
