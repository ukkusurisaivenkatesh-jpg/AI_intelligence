from datetime import date
from sqlalchemy.orm import Session
from .models import User, StudentProfile, University, Programme, Career, Rule
from .auth import hash_password


def seed(db: Session):
    if db.query(User).first():
        return
    admin = User(email="admin@admitwise.demo", full_name="AdmitWise Administrator", password_hash=hash_password("Admin123!"), role="admin")
    student = User(email="student@admitwise.demo", full_name="Aarav Sharma", password_hash=hash_password("Student123!"), role="student")
    db.add_all([admin, student])
    db.flush()
    db.add(StudentProfile(user_id=student.id, qualification="12th Grade", aggregate_marks=82, subject_marks={"Physics": 85, "Mathematics": 88, "Chemistry": 78}, entrance_scores={"JEE Main": 92, "CUET": 82}, interests=["Technology", "Artificial Intelligence", "Research"], aptitude={"logical": 8.5, "analytical": 8.0}, skills=["Python", "Problem Solving"], preferred_location="Maharashtra", annual_budget=150000))

    universities = [
        University(name="Nirma Institute (Demo)", location="Ahmedabad", region="Gujarat", data_status="demo", website="https://example.test/nirma"),
        University(name="Pune Technology University (Demo)", location="Pune", region="Maharashtra", data_status="demo", website="https://example.test/pune"),
        University(name="Bengaluru Applied Sciences College (Demo)", location="Bengaluru", region="Karnataka", data_status="demo", website="https://example.test/bengaluru"),
        University(name="Delhi Knowledge Institute (Demo)", location="Delhi", region="Delhi", data_status="demo", website="https://example.test/delhi"),
    ]
    db.add_all(universities)
    db.flush()

    def add_p(u, name, discipline, fee, minimum, subjects, subject_mins, exams, exam_req, careers):
        db.add(Programme(university_id=u.id, name=name, discipline=discipline, duration_years=4 if "B.Tech" in name or "B.E." in name else 3, annual_fee=fee, minimum_percentage=minimum, required_subjects=subjects, subject_minimums=subject_mins, entrance_exams=exams, entrance_requirements=exam_req, career_ids=careers, data_status="demo", source="Illustrative demo dataset; verify with institution", last_verified=date(2026, 11, 22)))

    add_p(universities[0], "B.Tech Computer Science", "Technology", 180000, 60, ["Physics", "Mathematics"], {"Physics": 50, "Mathematics": 55}, ["JEE Main"], {"JEE Main": {"minimum_score": 75}}, [1, 2])
    add_p(universities[1], "B.Tech Artificial Intelligence", "Artificial Intelligence", 145000, 60, ["Physics", "Mathematics"], {"Physics": 50, "Mathematics": 55}, ["JEE Main"], {"JEE Main": {"minimum_score": 80}}, [1, 2])
    add_p(universities[1], "B.Sc Data Science", "Data Science", 90000, 55, ["Mathematics"], {"Mathematics": 50}, ["CUET"], {"CUET": {"minimum_score": 60}}, [2])
    add_p(universities[2], "B.Tech Information Technology", "Technology", 120000, 58, ["Physics", "Mathematics"], {"Physics": 50, "Mathematics": 50}, ["JEE Main"], {"JEE Main": {"minimum_score": 70}}, [1])
    add_p(universities[2], "B.E. Electronics", "Electronics", 110000, 55, ["Physics", "Mathematics"], {"Physics": 50, "Mathematics": 50}, ["JEE Main"], {"JEE Main": {"minimum_score": 65}}, [3])
    add_p(universities[3], "BCA", "Computer Applications", 80000, 50, ["Mathematics"], {}, ["CUET"], {"CUET": {"minimum_score": 50}}, [1, 2])
    add_p(universities[3], "BA Economics", "Economics", 70000, 50, [], {}, ["CUET"], {"CUET": {"minimum_score": 50}}, [4])
    db.flush()

    careers = [
        Career(name="Software Developer", description="Build and maintain software applications.", technical_skills=["Programming", "Data Structures", "Git"], soft_skills=["Teamwork", "Communication"], certifications=["Language or platform certification"], roadmap=["Learn programming fundamentals", "Build projects", "Complete an internship", "Prepare for professional roles"]),
        Career(name="AI Engineer", description="Develop applied machine learning systems.", technical_skills=["Python", "Machine Learning", "Statistics"], soft_skills=["Critical thinking"], certifications=["Machine learning course with projects"], roadmap=["Learn Python and statistics", "Study ML fundamentals", "Build ML projects", "Specialize in a domain"]),
        Career(name="Data Engineer", description="Design and maintain data pipelines.", technical_skills=["SQL", "Python", "Data modeling"], soft_skills=["Attention to detail"], certifications=["Cloud or data platform project"], roadmap=["Learn databases", "Build ETL projects", "Study distributed systems"]),
        Career(name="Electronics Engineer", description="Design electronic hardware and embedded systems.", technical_skills=["Circuit design", "Embedded systems"], soft_skills=["Problem solving"], certifications=["Microcontroller project"], roadmap=["Learn circuit fundamentals", "Build embedded projects"]),
        Career(name="Economist", description="Analyse economic systems and data.", technical_skills=["Statistics", "Econometrics"], soft_skills=["Analysis", "Communication"], certifications=["Statistics or research course"], roadmap=["Build quantitative foundations", "Learn econometrics"]),
    ]
    db.add_all(careers)
    db.flush()

    db.add_all([
        Rule(id="demo-cs-min-math", name="Demo CS Mathematics Requirement", description="Illustrative rule requiring 12th qualification and Mathematics.", conditions={"all": [{"fact": "qualification", "operator": "eq", "value": "12th Grade"}, {"fact": "aggregate_marks", "operator": "gte", "value": 60}, {"fact": "subject_marks.Mathematics", "operator": "gte", "value": 55}]}, result={"fact": "eligibility.cs_academic", "value": "satisfied"}, priority=200, source="Illustrative demo dataset", effective_date=date(2026, 1, 1), active=True),
        Rule(id="demo-bca-qualification", name="Demo BCA Qualification Rule", description="Illustrative rule for a 12th-grade qualification.", conditions={"fact": "qualification", "operator": "eq", "value": "12th Grade"}, result={"fact": "eligibility.bca_academic", "value": "satisfied"}, priority=100, source="Illustrative demo dataset", effective_date=date(2026, 1, 1), active=True),
    ])
    db.commit()
