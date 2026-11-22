from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import Rule, User
from ..engine.reasoning import KnowledgeReasoner
from ..semantic_network import build_semantic_network

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/frames")
def frames():
    reasoner = KnowledgeReasoner()
    return {name: reasoner.create_frame(name, "Template", {}).get("attributes", {}) for name in ("Student", "University", "Programme", "Eligibility", "EntranceExam", "Career", "Skill")}


@router.get("/rules")
def rules(db: Session = Depends(get_db)):
    return [{"id": r.id, "name": r.name, "description": r.description, "conditions": r.conditions, "result": r.result, "priority": r.priority, "source": r.source, "effective_date": r.effective_date.isoformat() if r.effective_date else None, "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None, "active": r.active} for r in db.query(Rule).all()]


@router.post("/forward-chain")
def forward(payload: dict, db: Session = Depends(get_db)):
    rules = [{"id": r.id, "name": r.name, "conditions": r.conditions, "result": r.result, "priority": r.priority, "effective_date": r.effective_date, "expiry_date": r.expiry_date, "active": r.active} for r in db.query(Rule).all()]
    facts, trace = KnowledgeReasoner(rules).forward_chain(payload.get("facts", {}))
    return {"facts": facts, "trace": trace}


@router.post("/backward-chain")
def backward(payload: dict, db: Session = Depends(get_db)):
    rules = [{"id": r.id, "name": r.name, "conditions": r.conditions, "result": r.result, "priority": r.priority, "effective_date": r.effective_date, "expiry_date": r.expiry_date, "active": r.active} for r in db.query(Rule).all()]
    return KnowledgeReasoner(rules).backward_chain(payload["goal"], payload.get("facts", {}))


@router.get("/graph")
def graph(
    academic_year: str = Query(default="", max_length=20),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_semantic_network(db, user, academic_year or None)
