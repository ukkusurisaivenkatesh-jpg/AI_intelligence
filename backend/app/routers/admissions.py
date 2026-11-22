from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, StudentProfile, Programme, Shortlist, ChatMessage
from ..services import evaluate_eligibility, rank_recommendations, programme_dict, programme_is_verified
from ..routers.students import profile_dict

router = APIRouter(prefix="/api", tags=["admissions"])


@router.get("/programmes")
def programmes(q: str = "", status: str = "", academic_year: str = "", db: Session = Depends(get_db)):
    items = [p for p in db.query(Programme).all() if programme_is_verified(p, academic_year or None)]
    result = [programme_dict(p) for p in items]
    if academic_year:
        result = [p for p in result if p["academic_year"] == academic_year]
    if q:
        result = [p for p in result if q.lower() in p["name"].lower() or q.lower() in (p["discipline"] or "").lower()]
    return result


@router.get("/programmes/{programme_id}")
def programme_detail(programme_id: int, db: Session = Depends(get_db)):
    p = db.get(Programme, programme_id)
    if not p or not programme_is_verified(p):
        raise HTTPException(404, "Programme not found")
    return programme_dict(p)


@router.post("/eligibility/evaluate")
def evaluate(academic_year: str = Query(default=""), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return [evaluate_eligibility(data, p, academic_year or None) for p in db.query(Programme).all()]


@router.get("/recommendations")
def recommendations(academic_year: str = Query(default=""), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return rank_recommendations(data, db.query(Programme).all(), academic_year=academic_year or None)


@router.post("/what-if")
def what_if(changes: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    original = profile_dict(profile)
    simulated = {**original, **{key: value for key, value in changes.items() if key != "academic_year"}}
    academic_year = changes.get("academic_year")
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
def compare(payload: dict, db: Session = Depends(get_db)):
    ids = payload.get("programme_ids", [])
    programmes = [p for p in db.query(Programme).filter(Programme.id.in_(ids)).all()] if ids else []
    return [programme_dict(p) for p in programmes if programme_is_verified(p)]


@router.post("/counsellor")
def counsellor(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = payload.get("message", "")
    if not isinstance(message, str) or not message.strip():
        raise HTTPException(422, "A non-empty message is required")
    academic_year = payload.get("academic_year")
    if academic_year is not None and (not isinstance(academic_year, str) or not academic_year.strip()):
        raise HTTPException(422, "academic_year must be a non-empty year label")
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    recommendations = rank_recommendations(data, db.query(Programme).all(), academic_year=academic_year)
    text = message.lower()
    matches = [r for r in recommendations if any(word in r["programme"]["name"].lower() for word in text.split())]
    grounded = matches[:3] or recommendations[:3]
    missing = []
    if data["aggregate_marks"] is None: missing.append("aggregate percentage")
    if not data["subject_marks"]: missing.append("subject-wise marks")
    if not data["entrance_scores"]: missing.append("entrance examination scores")
    answer = "I used the knowledge-based eligibility engine and ranked only programmes with verified criteria."
    if not academic_year:
        missing.append("requested academic year")
        answer += " No academic year was selected, so no year's criteria were applied."
    if missing:
        answer += " Missing information: " + ", ".join(missing) + "."
    if grounded:
        answer += " Grounded suggestions: " + ", ".join(r["programme"]["name"] for r in grounded) + "."
    db.add(ChatMessage(user_id=user.id, message=message.strip(), response=answer))
    db.commit()
    return {"answer": answer, "recommendations": grounded, "missing": missing, "source": "knowledge-based eligibility engine"}


@router.get("/counsellor/history")
def counsellor_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == user.id).order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(50).all()
    return [
        {"id": item.id, "message": item.message, "response": item.response, "created_at": item.created_at.isoformat()}
        for item in reversed(messages)
    ]
