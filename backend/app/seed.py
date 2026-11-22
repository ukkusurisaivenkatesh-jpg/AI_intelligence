from sqlalchemy.orm import Session

from .config import settings
from .models import User, StudentProfile
from .auth import hash_password


def seed(db: Session):
    if settings.app_env not in {"development", "test"}:
        raise RuntimeError("Demo account seeding is allowed only in development or test")

    if db.query(User).first():
        return

    admin = User(
        email="admin@admitwise.demo",
        full_name="AdmitWise Administrator",
        password_hash=hash_password("Admin123!"),
        role="admin",
    )
    student = User(
        email="student@admitwise.demo",
        full_name="Aarav Sharma",
        password_hash=hash_password("Student123!"),
        role="student",
    )
    db.add_all([admin, student])
    db.flush()
    db.add(
        StudentProfile(
            user_id=student.id,
            qualification="12th Grade",
            aggregate_marks=82,
            subject_marks={"Physics": 85, "Mathematics": 88, "Chemistry": 78},
            entrance_scores={"JEE Main": 92, "CUET": 82},
            interests=["Technology", "Artificial Intelligence", "Research"],
            aptitude={"logical": 8.5, "analytical": 8.0},
            skills=["Python", "Problem Solving"],
            preferred_location="Maharashtra",
            annual_budget=150000,
        )
    )
    db.commit()
