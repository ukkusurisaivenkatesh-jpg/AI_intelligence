from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, StudentProfile, Programme, Career, Shortlist, ChatMessage
from ..counselling import build_rule_based_counselling_response
from ..schemas import CompareRequest, CounsellorRequest, ProfileChanges
from ..services import evaluate_eligibility, rank_recommendations, programme_dict, programme_is_verified
from ..routers.students import profile_dict

router = APIRouter(prefix="/api", tags=["admissions"])


@router.get("/programmes")
def programmes(
    q: str = Query(default="", max_length=100),
    status: str = Query(default="", max_length=50),
    academic_year: str = Query(default="", max_length=20),
    db: Session = Depends(get_db),
):
    items = [p for p in db.query(Programme).all() if programme_is_verified(p, academic_year or None)]
    result = [programme_dict(p) for p in items]
    if academic_year:
        result = [p for p in result if p["academic_year"] == academic_year]
    if q:
        result = [p for p in result if q.lower() in p["name"].lower() or q.lower() in (p["discipline"] or "").lower()]
    if status:
        result = [p for p in result if p["verification_status"].casefold() == status.casefold()]
    return result


@router.get("/programmes/{programme_id}")
def programme_detail(programme_id: int, db: Session = Depends(get_db)):
    p = db.get(Programme, programme_id)
    if not p or not programme_is_verified(p):
        raise HTTPException(404, "Programme not found")
    return programme_dict(p)


@router.post("/eligibility/evaluate")
def evaluate(academic_year: str = Query(default="", max_length=20), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return [evaluate_eligibility(data, p, academic_year or None) for p in db.query(Programme).all()]


@router.get("/recommendations")
def recommendations(academic_year: str = Query(default="", max_length=20), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return rank_recommendations(data, db.query(Programme).all(), academic_year=academic_year or None)


@router.post("/what-if")
def what_if(payload: ProfileChanges, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    original = profile_dict(profile)
    changes = payload.model_dump(exclude_unset=True, exclude={"academic_year"})
    simulated = {**original, **changes}
    academic_year = payload.academic_year
    before = rank_recommendations(original, db.query(Programme).all(), academic_year=academic_year)
    after = rank_recommendations(simulated, db.query(Programme).all(), academic_year=academic_year)
    before_ids = {r["programme"]["id"] for r in before}
    after_ids = {r["programme"]["id"] for r in after}
    all_evaluations = {p.id: evaluate_eligibility(simulated, p, academic_year) for p in db.query(Programme).all()}
    return {
        "previous": before,
        "simulated": after,
        "newly_eligible": [all_evaluations[i] for i in after_ids - before_ids],
        "no_longer_eligible": [all_evaluations[i]["programme"] for i in before_ids - after_ids],
        "changes": changes,
        "comparison": all_evaluations,
    }


@router.post("/shortlist/{programme_id}")
def add_shortlist(programme_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(Programme, programme_id):
        raise HTTPException(404, "Programme not found")
    if not db.query(Shortlist).filter(Shortlist.user_id == user.id, Shortlist.programme_id == programme_id).first():
        db.add(Shortlist(user_id=user.id, programme_id=programme_id))
        db.commit()
    return {"saved": True}


@router.delete("/shortlist/{programme_id}")
def remove_shortlist(programme_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Shortlist).filter(Shortlist.user_id == user.id, Shortlist.programme_id == programme_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"saved": False}


@router.get("/shortlist")
def shortlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Shortlist).filter(Shortlist.user_id == user.id).all()
    return [programme_dict(db.get(Programme, item.programme_id)) for item in items]


@router.post("/compare")
def compare(payload: CompareRequest, db: Session = Depends(get_db)):
    programmes = db.query(Programme).filter(Programme.id.in_(payload.programme_ids)).all()
    return [
        programme_dict(programme)
        for programme in programmes
        if programme_is_verified(programme, payload.academic_year)
    ]

@router.post("/counsellor")
def counsellor(payload: CounsellorRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    changes = (
        payload.profile_changes.model_dump(exclude_unset=True, exclude={"academic_year"})
        if payload.profile_changes
        else None
    )
    result = build_rule_based_counselling_response(
        payload.message,
        data,
        db.query(Programme).all(),
        db.query(Career).all(),
        payload.academic_year,
        changes,
    )
    db.add(ChatMessage(user_id=user.id, message=payload.message, response=result["answer"]))
    db.commit()
    return result


@router.get("/counsellor/history")
def counsellor_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == user.id).order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(50).all()
    return [
        {"id": item.id, "message": item.message, "response": item.response, "created_at": item.created_at.isoformat()}
        for item in reversed(messages)
    ]
