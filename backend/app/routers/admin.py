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
    return [{"id": u.id, "name": u.name, "location": u.location, "region": u.region, "data_status": u.data_status} for u in db.query(University).all()]


@router.post("/universities")
def create_university(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = University(name=payload["name"], location=payload.get("location"), region=payload.get("region"), website=payload.get("website"), data_status=payload.get("data_status", "demo"))
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
