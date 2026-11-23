from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..career_catalogue import ILLUSTRATIVE_CAREERS
from ..database import get_db
from ..models import Career, Programme
from ..services import career_is_verified, programme_dict

router = APIRouter(prefix="/api/careers", tags=["careers"])


def _verified_career_dict(career: Career) -> dict:
    return {
        "id": career.id,
        "name": career.name,
        "description": career.description,
        "related_subjects": career.related_qualifications or [],
        "related_programmes": [],
        "technical_skills": career.technical_skills or [],
        "soft_skills": career.soft_skills or [],
        "certifications": career.certifications or [],
        "roadmap": career.roadmap or [],
        "learning_areas": career.roadmap or [],
        "responsibilities": [],
        "illustrative": False,
        "source_url": career.source_url,
        "source_title": career.source_title,
        "verification_status": career.verification_status,
        "academic_year": career.academic_year,
        "verified_at": career.verified_at.isoformat() if career.verified_at else None,
        "last_updated": career.last_updated.isoformat() if career.last_updated else None,
        "data_notes": career.data_notes,
    }


@router.get("")
def careers(db: Session = Depends(get_db)):
    verified = [
        _verified_career_dict(career)
        for career in db.query(Career).all()
        if career_is_verified(career)
    ]
    programmes = db.query(Programme).all()
    illustrative = []
    for career in ILLUSTRATIVE_CAREERS:
        related_disciplines = [value.casefold() for value in career["related_disciplines"]]
        related_programmes = [
            programme_dict(programme)
            for programme in programmes
            if any(
                discipline
                in f"{programme.name} {programme.discipline or ''}".casefold()
                for discipline in related_disciplines
            )
        ]
        illustrative.append(
            {
                **career,
                "related_programmes": [
                    {
                        "id": programme["id"],
                        "name": programme["name"],
                        "verification_status": programme["criteria_status"],
                        "academic_year": programme["academic_year"],
                    }
                    for programme in related_programmes
                ],
                "certifications": [],
                "roadmap": career["learning_areas"],
                "source_url": None,
                "source_title": "Locally maintained illustrative pathway",
                "verification_status": "ILLUSTRATIVE",
                "academic_year": None,
                "verified_at": None,
                "last_updated": None,
                "data_notes": (
                    "Illustrative career information only; not an employment guarantee "
                    "or a verified labour-market claim."
                ),
            }
        )
    return verified + illustrative


@router.get("/{career_id}")
def career_detail(career_id: int, db: Session = Depends(get_db)):
    career = db.get(Career, career_id)
    if not career or not career_is_verified(career):
        raise HTTPException(404, "Career not found")
    return _verified_career_dict(career)
