from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed
from app.catalogue import PROGRAMMES, UNIVERSITIES, seed_catalogue
from app.models import Programme, University
from app.services import evaluate_eligibility, rank_recommendations


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)
with TestingSession() as db:
    seed(db)
    seed_catalogue(db)
    university = University(name="Test Fixture University", location="Pune", verification_status="PENDING_VERIFICATION")
    db.add(university)
    db.flush()
    db.add(Programme(
        university_id=university.id,
        name="Test Fixture Programme",
        data_status="test_fixture",
        verification_status="PENDING_VERIFICATION",
    ))
    db.commit()


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def auth_headers():
    response = client.post("/api/auth/login", json={"email": "student@admitwise.demo", "password": "Student123!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_and_programmes():
    assert client.get("/api/health").json()["status"] == "ok"
    programmes = client.get("/api/programmes").json()
    assert programmes == []
    assert client.get("/api/programmes/1").status_code == 404
    assert client.get("/api/careers").json() == []


def test_health_failure_does_not_expose_database_error(monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError
    from app import main

    class FailedEngine:
        def connect(self):
            raise SQLAlchemyError("sensitive connection details")

    monkeypatch.setattr(main, "engine", FailedEngine())
    response = main.health()
    assert response.status_code == 503
    assert b"sensitive connection details" not in response.body


def test_official_catalogue_seed_is_pending_and_idempotent():
    with TestingSession() as db:
        university_count = db.query(University).count()
        programme_count = db.query(Programme).count()
        seed_catalogue(db)
        assert db.query(University).count() == university_count
        assert db.query(Programme).count() == programme_count
        assert university_count == len(UNIVERSITIES) + 1
        assert programme_count == len(PROGRAMMES) + 1
        assert db.query(University).filter(University.verification_status == "PENDING_VERIFICATION").count() == len(UNIVERSITIES)
        assert db.query(Programme).filter(Programme.verification_status == "PENDING_VERIFICATION").count() == len(PROGRAMMES) + 1
        anna = db.query(University).filter(University.name == "Anna University").one()
        assert anna.verification_status == "VERIFIED"
        assert anna.academic_year == "2026-27"


def test_cors_preflight_allows_frontend_requests():
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "https://ai-intelligence-eta.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


def test_knowledge_graph_requires_authentication_and_uses_profile_data():
    assert client.get("/api/knowledge/graph").status_code == 401
    headers = auth_headers()
    profile_update = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={
            "subject_marks": {"Physics": 84},
            "entrance_scores": {"JEE Main": {"score": 72}},
            "interests": ["Engineering"],
            "skills": ["Python"],
        },
    )
    assert profile_update.status_code == 200
    response = client.get("/api/knowledge/graph?academic_year=2026-27", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["available"] is True
    assert payload["academic_year"] == "2026-27"
    assert any(node["label"] == "Student" for node in payload["nodes"])
    assert any(node["label"] == "Subject" and node["name"] == "Physics" for node in payload["nodes"])
    assert any(node["label"] == "Skill" and node["name"] == "Python" for node in payload["nodes"])
    assert any(edge["label"] == "HAS_SUBJECT_RESULT:84%" for edge in payload["edges"])


def test_unverified_catalogue_criteria_cannot_produce_eligibility_or_affordability():
    profile = {
        "qualification": "12th Grade",
        "aggregate_marks": 100,
        "subject_marks": {"Mathematics": 100, "Applied Mathematics": 100},
        "entrance_scores": {},
        "annual_budget": 1_000_000,
    }
    with TestingSession() as db:
        programme = db.query(Programme).filter(Programme.name == "BCA (Bachelor of Computer Applications)").one()
        result = evaluate_eligibility(profile, programme, academic_year="2024-25")

        assert programme.verification_status == "PENDING_VERIFICATION"
        assert result["status"] == "Insufficient Information"
        assert result["satisfied"] == []
        assert result["programme"]["minimum_percentage"] is None
        assert result["programme"]["additional_admission_conditions"] == []
        assert result["affordability"]["status"] == "unknown"
        assert rank_recommendations(profile, [programme], academic_year="2024-25") == []


def test_profile_update_and_dashboard():
    headers = auth_headers()
    response = client.put("/api/students/me/profile", headers=headers, json={"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Mathematics": 88}, "entrance_scores": {"JEE Main": 92}, "interests": ["Technology"], "aptitude": {"logical": 8}, "skills": ["Python"], "preferred_location": "Maharashtra", "annual_budget": 150000})
    assert response.status_code == 200
    assert client.get("/api/students/me/dashboard", headers=headers).status_code == 200


def test_recommendations_eligibility_and_what_if():
    headers = auth_headers()
    assert client.post("/api/eligibility/evaluate", headers=headers).status_code == 200
    assert client.get("/api/recommendations", headers=headers).status_code == 200
    response = client.post("/api/what-if", headers=headers, json={"aggregate_marks": 95, "annual_budget": 300000})
    assert response.status_code == 200
    assert "simulated" in response.json()


def test_shortlist():
    headers = auth_headers()
    assert client.post("/api/shortlist/1", headers=headers).status_code == 200
    assert any(p["id"] == 1 for p in client.get("/api/shortlist", headers=headers).json())


def test_counsellor_is_grounded():
    headers = auth_headers()
    response = client.post("/api/counsellor", headers=headers, json={"message": "Suggest Computer Science programmes"})
    assert response.status_code == 200
    assert response.json()["engine"] == "rule-based-demo"
    assert response.json()["scenario"] is False
    assert response.json()["recommendations"] == []
    assert "can't confirm" in response.json()["answer"]


def test_counsellor_what_if_changes_are_not_saved():
    headers = auth_headers()
    saved = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={"aggregate_marks": 68},
    )
    assert saved.status_code == 200
    response = client.post(
        "/api/counsellor",
        headers=headers,
        json={
            "message": "What if I improve my marks?",
            "academic_year": "2026-27",
            "profile_changes": {"aggregate_marks": 92},
        },
    )
    assert response.status_code == 200
    assert response.json()["scenario"] is True
    assert "aggregate_marks" in response.json()["answer"]
    assert client.get("/api/students/me/profile", headers=headers).json()["aggregate_marks"] == 68


def test_counsellor_rejects_removed_external_ai_option():
    response = client.post(
        "/api/counsellor",
        headers=auth_headers(),
        json={"message": "Explain my results", "use_external_ai": True},
    )
    assert response.status_code == 422


def test_admin_role_restricted():
    response = client.post("/api/auth/login", json={"email": "student@admitwise.demo", "password": "Student123!"})
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/admin/overview", headers=headers).status_code == 403


def test_current_user_and_counsellor_history():
    headers = auth_headers()
    current_user = client.get("/api/auth/me", headers=headers)
    assert current_user.status_code == 200
    assert current_user.json()["role"] == "student"

    question = "Which programme criteria should I review?"
    response = client.post("/api/counsellor", headers=headers, json={"message": question})
    assert response.status_code == 200
    history = client.get("/api/counsellor/history", headers=headers)
    assert history.status_code == 200
    assert any(item["message"] == question and item["response"] == response.json()["answer"] for item in history.json())


def test_admin_identity_and_permissions():
    response = client.post("/api/auth/login", json={"email": "admin@admitwise.demo", "password": "Admin123!"})
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=headers).json()["role"] == "admin"
    assert client.get("/api/admin/overview", headers=headers).status_code == 200
    records = client.get("/api/admin/programmes", headers=headers)
    assert records.status_code == 200
    assert records.json()[0]["verification_status"] == "PENDING_VERIFICATION"
    assert client.get("/api/admin/careers", headers=headers).status_code == 200


def test_admin_cannot_create_verified_university_without_review():
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@admitwise.demo", "password": "Admin123!"},
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    rejected = client.post(
        "/api/admin/universities",
        headers=headers,
        json={
            "name": "Unreviewed Institution",
            "verification_status": "VERIFIED",
            "source_url": "https://example.test/unreviewed",
        },
    )
    assert rejected.status_code == 422
    created = client.post(
        "/api/admin/universities",
        headers=headers,
        json={
            "name": "Unreviewed Institution",
            "source_url": "https://example.test/unreviewed",
            "source_title": "Test source",
        },
    )
    assert created.status_code == 200
    assert created.json()["verification_status"] == "PENDING_VERIFICATION"
    records = client.get("/api/admin/universities", headers=headers).json()
    record = next(item for item in records if item["name"] == "Unreviewed Institution")
    assert record["verification_status"] == "PENDING_VERIFICATION"
    audit = client.get("/api/admin/audit-logs", headers=headers)
    assert audit.status_code == 200
    assert any(entry["entity_id"] == str(created.json()["id"]) for entry in audit.json())


def test_counsellor_rejects_empty_message():
    response = client.post("/api/counsellor", headers=auth_headers(), json={"message": "  "})
    assert response.status_code == 422


def test_registration_validates_credentials_and_creates_student_account():
    weak_password = client.post(
        "/api/auth/register",
        json={"full_name": "New Student", "email": "new.student@example.edu", "password": "short"},
    )
    assert weak_password.status_code == 422

    registered = client.post(
        "/api/auth/register",
        json={"full_name": "  New   Student ", "email": "NEW.STUDENT@example.edu", "password": "SecureStudent123!"},
    )
    assert registered.status_code == 200
    assert registered.json()["role"] == "student"
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    profile = client.get("/api/students/me/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["aggregate_marks"] is None


def test_profile_marks_and_exam_results_are_validated():
    headers = auth_headers()
    invalid_subject = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={"subject_marks": {"Mathematics": 101}},
    )
    assert invalid_subject.status_code == 422

    valid_results = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={"entrance_scores": {"JEE Main": {"score": 93.5, "rank": 1200}}},
    )
    assert valid_results.status_code == 200
    assert valid_results.json()["entrance_scores"]["JEE Main"] == {"score": 93.5, "rank": 1200}

    custom_facts = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={"profile": {"category": "OBC-NCL", "domicile": "Karnataka"}},
    )
    assert custom_facts.status_code == 200
    assert custom_facts.json()["profile"]["category"] == "OBC-NCL"

    invalid_facts = client.put(
        "/api/students/me/profile",
        headers=headers,
        json={"profile": {"category": {"nested": {"too": {"deep": "value"}}}}},
    )
    assert invalid_facts.status_code == 422


def test_what_if_can_simulate_additional_admission_facts():
    response = client.post(
        "/api/what-if",
        headers=auth_headers(),
        json={"academic_year": "2026-27", "profile": {"category": "General"}},
    )
    assert response.status_code == 200
    assert response.json()["changes"]["profile"]["category"] == "General"
