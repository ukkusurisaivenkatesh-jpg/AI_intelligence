from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import require_admin
from ..models import User, University, Programme, Career, Rule, AuditLog
from ..engine.rules import RuleEngine
from ..services import programme_dict
from ..schemas import RuleCreateRequest, UniversityCreateRequest
from sqlalchemy.exc import IntegrityError

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


@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).all()
    return [{
        "id": entry.id,
        "actor": entry.actor,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "payload": entry.payload or {},
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    } for entry in entries]


@router.post("/universities")
def create_university(payload: UniversityCreateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    audit_payload = payload.model_dump(mode="json")
    u = University(
        name=payload.name,
        location=payload.location,
        region=payload.region,
        website=str(payload.website) if payload.website else None,
        institution_type=payload.institution_type,
        state=payload.state,
        city=payload.city,
        recognition_info=payload.recognition_info,
        source_url=str(payload.source_url) if payload.source_url else None,
        source_title=payload.source_title,
        academic_year=payload.academic_year,
        data_notes=payload.data_notes,
        data_status="unverified",
        verification_status="PENDING_VERIFICATION",
    )
    db.add(u)
    try:
        db.flush()
        db.add(AuditLog(actor=admin.email, action="create", entity_type="university", entity_id=str(u.id), payload=audit_payload))
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Institution could not be added because of a catalogue conflict") from error
    return {"id": u.id, "name": u.name, "verification_status": u.verification_status}


@router.post("/rules")
def create_rule(payload: RuleCreateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    engine = RuleEngine()
    rule_data = payload.model_dump(mode="json")
    try:
        engine.validate_rule(rule_data)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    rule = Rule(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        conditions=payload.conditions,
        result=payload.result,
        priority=payload.priority,
        source=payload.source,
        active=payload.active,
    )
    db.add(rule)
    try:
        db.flush()
        db.add(AuditLog(actor=admin.email, action="publish_rule", entity_type="rule", entity_id=rule.id, payload=rule_data))
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "A rule with this ID already exists") from error
    return {"id": rule.id, "validated": True, "active": rule.active}
