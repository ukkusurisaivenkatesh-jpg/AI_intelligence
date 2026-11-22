from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Career
from ..services import career_is_verified

router = APIRouter(prefix="/api/careers", tags=["careers"])


@router.get("")
def careers(db: Session = Depends(get_db)):
    return [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "technical_skills": c.technical_skills or [],
        "soft_skills": c.soft_skills or [],
        "certifications": c.certifications or [],
        "related_qualifications": c.related_qualifications or [],
        "roadmap": c.roadmap or [],
        "source_url": c.source_url,
        "source_title": c.source_title,
        "verification_status": c.verification_status,
        "academic_year": c.academic_year,
        "verified_at": c.verified_at.isoformat() if c.verified_at else None,
        "last_updated": c.last_updated.isoformat() if c.last_updated else None,
        "data_notes": c.data_notes,
    } for c in db.query(Career).all() if career_is_verified(c)]


@router.get("/{career_id}")
def career_detail(career_id: int, db: Session = Depends(get_db)):
    c = db.get(Career, career_id)
    if not c or not career_is_verified(c):
        raise HTTPException(404, "Career not found")
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "technical_skills": c.technical_skills or [],
        "soft_skills": c.soft_skills or [],
        "certifications": c.certifications or [],
        "related_qualifications": c.related_qualifications or [],
        "roadmap": c.roadmap or [],
        "source_url": c.source_url,
        "source_title": c.source_title,
        "verification_status": c.verification_status,
        "academic_year": c.academic_year,
        "verified_at": c.verified_at.isoformat() if c.verified_at else None,
        "last_updated": c.last_updated.isoformat() if c.last_updated else None,
        "data_notes": c.data_notes,
    }
