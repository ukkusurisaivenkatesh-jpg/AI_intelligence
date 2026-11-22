from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, StudentProfile, Programme, Shortlist
from ..services import evaluate_eligibility, rank_recommendations, programme_dict
from ..routers.students import profile_dict

router = APIRouter(prefix="/api", tags=["admissions"])


@router.get("/programmes")
def programmes(q: str = "", status: str = "", db: Session = Depends(get_db)):
    items = db.query(Programme).all()
    result = [programme_dict(p) for p in items]
    if q:
        result = [p for p in result if q.lower() in p["name"].lower() or q.lower() in (p["discipline"] or "").lower()]
    return result


@router.get("/programmes/{programme_id}")
def programme_detail(programme_id: int, db: Session = Depends(get_db)):
    p = db.get(Programme, programme_id)
    if not p:
        raise HTTPException(404, "Programme not found")
    return programme_dict(p)


@router.post("/eligibility/evaluate")
def evaluate(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return [evaluate_eligibility(data, p) for p in db.query(Programme).all()]


@router.get("/recommendations")
def recommendations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    return rank_recommendations(data, db.query(Programme).all())


@router.post("/what-if")
def what_if(changes: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    original = profile_dict(profile)
    simulated = {**original, **changes}
    before = rank_recommendations(original, db.query(Programme).all())
    after = rank_recommendations(simulated, db.query(Programme).all())
    before_ids = {r["programme"]["id"] for r in before}
    after_ids = {r["programme"]["id"] for r in after}
    all_evaluations = {p.id: evaluate_eligibility(simulated, p) for p in db.query(Programme).all()}
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
    return [programme_dict(p) for p in programmes]


@router.post("/counsellor")
def counsellor(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = payload.get("message", "")
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    data = profile_dict(profile)
    recommendations = rank_recommendations(data, db.query(Programme).all())
    text = message.lower()
    matches = [r for r in recommendations if any(word in r["programme"]["name"].lower() for word in text.split())]
    grounded = matches[:3] or recommendations[:3]
    missing = []
    if data["aggregate_marks"] is None: missing.append("aggregate percentage")
    if not data["subject_marks"]: missing.append("subject-wise marks")
    if not data["entrance_scores"]: missing.append("entrance examination scores")
    answer = "I used the knowledge-based eligibility engine and ranked only programmes that meet mandatory criteria."
    if missing:
        answer += " Missing information: " + ", ".join(missing) + "."
    if grounded:
        answer += " Grounded suggestions: " + ", ".join(r["programme"]["name"] for r in grounded) + "."
    return {"answer": answer, "recommendations": grounded, "missing": missing, "source": "deterministic fallback"}
