from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..auth import get_current_user
from ..career_catalogue import ILLUSTRATIVE_CAREERS
from ..models import User, StudentProfile, Programme, Career, Shortlist, ChatMessage
from ..counselling import build_rule_based_counselling_response
from ..schemas import CompareRequest, CounsellorRequest, ProfileChanges
from ..services import (
    build_recommendation_categories,
    evaluate_eligibility,
    programme_dict,
    rank_recommendations,
)
from ..routers.students import profile_dict

router = APIRouter(prefix="/api", tags=["admissions"])


@router.get("/programmes")
def programmes(
    q: str = Query(default="", max_length=100),
    status: str = Query(default="", max_length=50),
    academic_year: str = Query(default="", max_length=20),
    institution: str = Query(default="", max_length=100),
    location: str = Query(default="", max_length=100),
    category: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    requested_year = academic_year or None
    items = db.query(Programme).options(joinedload(Programme.university)).all()
    result = []
    for programme in items:
        if requested_year and programme.academic_year not in (None, requested_year):
            continue
        record = programme_dict(programme, academic_year=requested_year)
        university = programme.university
        search_text = " ".join(
            str(value or "")
            for value in (
                record["name"],
                record["discipline"],
                (record["university"] or {}).get("name"),
                (record["university"] or {}).get("location"),
                (record["university"] or {}).get("city"),
                (record["university"] or {}).get("state"),
                *record["required_subjects"],
            )
        ).casefold()
        institution_text = " ".join(
            str(value or "")
            for value in (
                university.name if university else "",
                university.location if university else "",
            )
        ).casefold()
        location_text = " ".join(
            str(value or "")
            for value in (
                university.location if university else "",
                university.city if university else "",
                university.state if university else "",
                university.region if university else "",
            )
        ).casefold()
        if q and q.casefold() not in search_text:
            continue
        if institution and institution.casefold() not in institution_text:
            continue
        if location and location.casefold() not in location_text:
            continue
        if category and category.casefold() not in (record["discipline"] or "").casefold():
            continue
        if status and status.casefold() not in {
            str(record["criteria_status"]).casefold(),
            str(record["verification_status"]).casefold(),
        }:
            continue
        result.append(record)
    result.sort(key=lambda item: (item["name"].casefold(), item["id"]))
    return {
        "items": result[offset : offset + limit],
        "total": len(result),
        "offset": offset,
        "limit": limit,
    }


@router.get("/programmes/{programme_id}")
def programme_detail(programme_id: int, db: Session = Depends(get_db)):
    p = db.get(Programme, programme_id)
    if not p:
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
    programmes = db.query(Programme).options(joinedload(Programme.university)).all()
    return build_recommendation_categories(data, programmes, academic_year=academic_year or None)


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
def compare(
    payload: CompareRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programmes = db.query(Programme).filter(Programme.id.in_(payload.programme_ids)).all()
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    profile_data = profile_dict(profile)
    if len(programmes) != len(payload.programme_ids):
        raise HTTPException(404, "One or more selected catalogue programmes are unavailable")
    careers_by_id = {
        career.id: career
        for career in db.query(Career).all()
    }
    result = []
    for programme in programmes:
        evaluation = evaluate_eligibility(profile_data, programme, payload.academic_year)
        record = programme_dict(programme, academic_year=payload.academic_year)
        record["eligibility_status"] = evaluation["status"]
        record["eligibility_missing"] = evaluation["missing"]
        record["career_pathways"] = [
            {
                "name": careers_by_id[career_id].name,
                "verification_status": careers_by_id[career_id].verification_status,
            }
            for career_id in programme.career_ids or []
            if career_id in careers_by_id
        ]
        result.append(record)
    return result

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
        db.query(Career).all() + ILLUSTRATIVE_CAREERS,
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
