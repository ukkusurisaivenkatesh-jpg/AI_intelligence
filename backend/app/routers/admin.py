from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import require_admin
from ..models import User, University, Programme, Career, Rule, AuditLog
from ..engine.rules import RuleEngine
from ..services import programme_dict

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return {"universities": db.query(University).count(), "programmes": db.query(Programme).count(), "careers": db.query(Career).count(), "rules": db.query(Rule).count(), "students": db.query(User).filter(User.role == "student").count()}


@router.get("/universities")
def universities(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return [{
        "id": u.id,
        "name": u.name,
        "location": u.location,
        "region": u.region,
        "website": u.website,
        "institution_type": u.institution_type,
        "state": u.state,
        "city": u.city,
        "recognition_info": u.recognition_info,
        "source_url": u.source_url,
        "source_title": u.source_title,
        "verification_status": u.verification_status,
        "verified_at": u.verified_at.isoformat() if u.verified_at else None,
        "academic_year": u.academic_year,
        "last_updated": u.last_updated.isoformat() if u.last_updated else None,
        "data_notes": u.data_notes,
        "data_status": u.data_status,
    } for u in db.query(University).all()]


@router.get("/programmes")
def programmes(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return [programme_dict(p, include_unverified=True) for p in db.query(Programme).all()]


@router.get("/careers")
def careers(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
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
    } for c in db.query(Career).all()]


@router.post("/universities")
def create_university(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = University(
        name=payload["name"],
        location=payload.get("location"),
        region=payload.get("region"),
        website=payload.get("website"),
        institution_type=payload.get("institution_type"),
        state=payload.get("state"),
        city=payload.get("city"),
        recognition_info=payload.get("recognition_info"),
        source_url=payload.get("source_url"),
        source_title=payload.get("source_title"),
        academic_year=payload.get("academic_year"),
        data_notes=payload.get("data_notes"),
        data_status="unverified",
        verification_status="PENDING_VERIFICATION",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    db.add(AuditLog(actor=admin.email, action="create", entity_type="university", entity_id=str(u.id), payload=payload))
    db.commit()
    return {"id": u.id, "name": u.name}


@router.post("/rules")
def create_rule(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    engine = RuleEngine()
    engine.validate_rule(payload)
    rule = Rule(id=payload["id"], name=payload["name"], description=payload.get("description"), conditions=payload["conditions"], result=payload["result"], priority=payload.get("priority", 100), source=payload.get("source"), active=payload.get("active", True))
    db.add(rule)
    db.commit()
    db.add(AuditLog(actor=admin.email, action="publish_rule", entity_type="rule", entity_id=rule.id, payload=payload))
    db.commit()
    return {"id": rule.id, "validated": True}
