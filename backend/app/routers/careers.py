from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Career

router = APIRouter(prefix="/api/careers", tags=["careers"])


@router.get("")
def careers(db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name, "description": c.description, "technical_skills": c.technical_skills or [], "soft_skills": c.soft_skills or [], "certifications": c.certifications or [], "roadmap": c.roadmap or []} for c in db.query(Career).all()]


@router.get("/{career_id}")
def career_detail(career_id: int, db: Session = Depends(get_db)):
    c = db.get(Career, career_id)
    if not c:
        return {}
    return {"id": c.id, "name": c.name, "description": c.description, "technical_skills": c.technical_skills or [], "soft_skills": c.soft_skills or [], "certifications": c.certifications or [], "roadmap": c.roadmap or []}
