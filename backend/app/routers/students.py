from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, StudentProfile, Shortlist
from ..schemas import ProfileRequest

router = APIRouter(prefix="/api/students", tags=["students"])


def profile_dict(profile):
    if not profile:
        return {"qualification": None, "aggregate_marks": None, "subject_marks": {}, "entrance_scores": {}, "interests": [], "aptitude": {}, "skills": [], "preferred_location": None, "annual_budget": None}
    return {k: getattr(profile, k) for k in ("qualification", "aggregate_marks", "subject_marks", "entrance_scores", "interests", "aptitude", "skills", "preferred_location", "annual_budget")}


@router.get("/me/profile")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    return profile_dict(profile)


@router.put("/me/profile")
def save_profile(payload: ProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if not profile:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile_dict(profile)


@router.get("/me/dashboard")
def dashboard(academic_year: str = Query(default=""), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import Programme
    from ..services import rank_recommendations
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    profile_data = profile_dict(profile)
    programmes = db.query(Programme).all()
    recommendations = rank_recommendations(profile_data, programmes, academic_year=academic_year or None)[:5]
    return {"student": {"name": user.full_name, "email": user.email}, "profile": profile_data, "academic_year": academic_year or None, "recommendations": recommendations, "shortlist_count": db.query(Shortlist).filter(Shortlist.user_id == user.id).count()}
