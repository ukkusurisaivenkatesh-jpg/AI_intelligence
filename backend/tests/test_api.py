from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)
with TestingSession() as db:
    seed(db)


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
    assert len(client.get("/api/programmes").json()) >= 5


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


def test_knowledge_graph_reports_service_status():
    response = client.get("/api/knowledge/graph")
    assert response.status_code == 200
    assert isinstance(response.json()["available"], bool)
    if not response.json()["available"]:
        assert response.json()["message"]


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
    assert "knowledge-based" in response.json()["answer"]


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


def test_counsellor_rejects_empty_message():
    response = client.post("/api/counsellor", headers=auth_headers(), json={"message": "  "})
    assert response.status_code == 422
