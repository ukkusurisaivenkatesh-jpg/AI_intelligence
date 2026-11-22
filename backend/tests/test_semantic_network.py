from datetime import datetime
from hashlib import sha256

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Career, Programme, StudentProfile, University, User
from app.semantic_network import build_semantic_network


def test_semantic_network_uses_profile_catalogue_and_provenance_relationships():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    verified_at = datetime(2026, 1, 1)

    try:
        with Session(engine) as db:
            user = User(email="student@example.test", full_name="Test Student", password_hash="unused")
            university = University(
                name="Verified University",
                verification_status="VERIFIED",
                academic_year="2026-27",
                source_url="https://example.test/university",
                source_title="University source",
                verified_at=verified_at,
                last_updated=verified_at,
                data_notes="Verified test fixture.",
            )
            career = Career(
                name="Software Engineer",
                technical_skills=["Python"],
                soft_skills=["Communication"],
                verification_status="VERIFIED",
                academic_year="2026-27",
                source_url="https://example.test/career",
                source_title="Career source",
                verified_at=verified_at,
                last_updated=verified_at,
                data_notes="Verified test fixture.",
            )
            db.add_all([user, university, career])
            db.flush()
            programme = Programme(
                university_id=university.id,
                name="BSc Computing",
                degree_type="BSc",
                minimum_qualification="12th Grade",
                minimum_percentage=70,
                required_subjects=["Mathematics"],
                entrance_exams=["JEE Main"],
                entrance_requirements={"JEE Main": {"minimum_score": 50}},
                career_ids=[career.id],
                criteria_complete=True,
                verification_status="VERIFIED",
                academic_year="2026-27",
                source_url="https://example.test/programme",
                source_title="Programme source",
                verified_at=verified_at,
                last_updated=verified_at,
                data_notes="Verified test fixture.",
                fee_source_url="https://example.test/fees",
                fee_source_title="Fee source",
                fee_verification_status="PENDING_VERIFICATION",
                fee_academic_year="2026-27",
            )
            profile = StudentProfile(
                user_id=user.id,
                qualification="12th Grade",
                aggregate_marks=85,
                subject_marks={"Mathematics": 90},
                entrance_scores={"JEE Main": {"score": 80, "rank": 1000}},
                interests=["Computing"],
                aptitude={"logical": 8},
                skills=["Python"],
                preferred_location="Tamil Nadu",
                annual_budget=150000,
                profile={"category": "general"},
            )
            db.add_all([programme, profile])
            db.commit()

            network = build_semantic_network(db, user, "2026-27")
            nodes = {node["id"]: node for node in network["nodes"]}
            edges = {(edge["source"], edge["target"], edge["label"]) for edge in network["edges"]}
            student_id = f"student:{user.id}"
            programme_id = f"programme:{programme.id}"
            university_id = f"university:{university.id}"
            career_id = f"career:{career.id}"
            mathematics_id = "subject:mathematics"
            python_id = "skill:python"
            fee_source_id = (
                f"source:{programme_id}:fee:"
                f"{sha256('https://example.test/fees'.encode()).hexdigest()[:16]}"
            )

            assert network["available"] is True
            assert network["academic_year"] == "2026-27"
            assert nodes[student_id]["label"] == "Student"
            assert nodes[programme_id]["verification_status"] == "VERIFIED"
            assert nodes[mathematics_id]["label"] == "Subject"
            assert (student_id, mathematics_id, "HAS_SUBJECT_RESULT:90%") in edges
            assert (student_id, "qualification:12th grade", "HAS_QUALIFICATION") in edges
            assert (student_id, "academic-result:aggregate", "HAS_RESULT:85%") in edges
            assert (student_id, "interest:computing", "HAS_INTEREST") in edges
            assert (student_id, "aptitude:logical", "HAS_APTITUDE_RESULT:8") in edges
            assert (student_id, "location:tamil nadu", "PREFERS_LOCATION") in edges
            assert (student_id, "preference:annual-budget", "HAS_BUDGET_PREFERENCE") in edges
            assert nodes["profile-fact:category"]["name"] == 'category: "general"'
            assert (university_id, programme_id, "UNIVERSITY_OFFERS_PROGRAMME") in edges
            assert (programme_id, mathematics_id, "REQUIRES_SUBJECT:VERIFIED") in edges
            assert (programme_id, "entrance-exam:jee main", "ACCEPTS_EXAM:VERIFIED") in edges
            assert (student_id, "entrance-exam:jee main", "TOOK_EXAM:score 80, rank 1000") in edges
            assert (student_id, python_id, "HAS_SKILL") in edges
            assert (career_id, python_id, "REQUIRES_SKILL") in edges
            assert (career_id, "skill:communication", "BENEFITS_FROM_SKILL") in edges
            assert (programme_id, career_id, "PATHWAY_TO") in edges
            assert nodes[fee_source_id]["verification_status"] == "PENDING_VERIFICATION"
            assert any(
                source == student_id and target == programme_id and label.startswith("ELIGIBILITY:")
                for source, target, label in edges
            )
            previous_year = build_semantic_network(db, user, "2027-28")
            assert not any(
                edge["source"] == programme_id and edge["label"] == "REQUIRES_SUBJECT:VERIFIED"
                for edge in previous_year["edges"]
            )
    finally:
        engine.dispose()


def test_unverified_programme_requirements_are_not_presented_as_semantic_facts():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)

    try:
        with Session(engine) as db:
            user = User(email="student@example.test", full_name="Test Student", password_hash="unused")
            university = University(name="Pending University", verification_status="PENDING_VERIFICATION")
            db.add_all([user, university])
            db.flush()
            programme = Programme(
                university_id=university.id,
                name="Pending Programme",
                required_subjects=["Mathematics"],
                entrance_exams=["JEE Main"],
                verification_status="PENDING_VERIFICATION",
                criteria_complete=False,
            )
            career = Career(name="Unverified career", technical_skills=["Python"])
            db.add(career)
            db.flush()
            programme.career_ids = [career.id]
            db.add(programme)
            db.commit()

            network = build_semantic_network(db, user, "2026-27")
            edges = network["edges"]
            programme_id = f"programme:{programme.id}"

            assert not any(
                edge["source"] == programme_id
                and edge["label"].startswith(("REQUIRES_SUBJECT", "ACCEPTS_EXAM", "PATHWAY_TO"))
                for edge in edges
            )
            assert f"career:{career.id}" not in {node["id"] for node in network["nodes"]}
            assert any(
                edge["source"] == f"student:{user.id}"
                and edge["target"] == programme_id
                and edge["label"] == "ELIGIBILITY:Insufficient Information"
                for edge in edges
            )
    finally:
        engine.dispose()
