import json
from hashlib import sha256

from sqlalchemy.orm import Session, joinedload

from .models import Career, Programme, StudentProfile, University, User
from .services import career_is_verified, evaluate_eligibility, programme_is_verified


def build_semantic_network(db: Session, user: User, academic_year: str | None = None):
    nodes = {}
    edges = {}

    def as_mapping(value):
        return value if isinstance(value, dict) else {}

    def as_list(value):
        return value if isinstance(value, list) else []

    def format_number(value):
        return f"{value:g}" if isinstance(value, (int, float)) else str(value)

    def add_node(
        node_id: str,
        label: str,
        name: str,
        *,
        verification_status: str | None = None,
        academic_year: str | None = None,
        source_url: str | None = None,
    ):
        nodes.setdefault(
            node_id,
            {
                "id": node_id,
                "label": label,
                "name": name,
                "verification_status": verification_status,
                "academic_year": academic_year,
                "source_url": source_url,
            },
        )
        return node_id

    def add_edge(source: str, target: str, label: str):
        edge_id = f"{source}|{target}|{label}"
        edges.setdefault(
            edge_id,
            {"id": edge_id, "source": source, "target": target, "label": label},
        )

    def add_source(owner_id: str, scope: str, url: str | None, title: str | None, status: str, year: str | None):
        if not url:
            return
        source_id = f"source:{owner_id}:{scope}:{sha256(url.encode('utf-8')).hexdigest()[:16]}"
        add_node(
            source_id,
            "Source document",
            title or url,
            verification_status=status,
            academic_year=year,
            source_url=url,
        )
        add_edge(owner_id, source_id, f"HAS_{scope.upper()}_SOURCE:{status}")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    student_id = add_node(f"student:{user.id}", "Student", user.full_name)
    profile_facts = {
        "qualification": profile.qualification if profile else None,
        "aggregate_marks": profile.aggregate_marks if profile else None,
        "subject_marks": as_mapping(profile.subject_marks) if profile else {},
        "entrance_scores": as_mapping(profile.entrance_scores) if profile else {},
        "interests": as_list(profile.interests) if profile else [],
        "aptitude": as_mapping(profile.aptitude) if profile else {},
        "skills": as_list(profile.skills) if profile else [],
        "preferred_location": profile.preferred_location if profile else None,
        "annual_budget": profile.annual_budget if profile else None,
        "profile": as_mapping(profile.profile) if profile else {},
    }

    if profile_facts["qualification"]:
        qualification = profile_facts["qualification"]
        qualification_id = add_node(
            f"qualification:{qualification.casefold()}",
            "Qualification",
            qualification,
        )
        add_edge(student_id, qualification_id, "HAS_QUALIFICATION")

    if profile_facts["aggregate_marks"] is not None:
        marks_id = add_node("academic-result:aggregate", "Academic result", "Aggregate marks")
        add_edge(student_id, marks_id, f"HAS_RESULT:{format_number(profile_facts['aggregate_marks'])}%")

    if profile_facts["annual_budget"] is not None:
        budget_id = add_node(
            "preference:annual-budget",
            "Budget preference",
            f"Annual budget: {format_number(profile_facts['annual_budget'])}",
        )
        add_edge(student_id, budget_id, "HAS_BUDGET_PREFERENCE")

    for fact, value in profile_facts["profile"].items():
        if value is None:
            continue
        value_text = json.dumps(value, ensure_ascii=False, sort_keys=True)
        fact_id = f"profile-fact:{fact.casefold()}"
        add_node(fact_id, "Profile fact", f"{fact}: {value_text}")
        add_edge(student_id, fact_id, "HAS_PROFILE_FACT")

    for subject, marks in profile_facts["subject_marks"].items():
        subject_id = add_node(f"subject:{subject.casefold()}", "Subject", subject)
        add_edge(student_id, subject_id, f"HAS_SUBJECT_RESULT:{format_number(marks)}%")

    for exam, result in profile_facts["entrance_scores"].items():
        exam_id = add_node(f"entrance-exam:{exam.casefold()}", "Entrance exam", exam)
        if isinstance(result, dict):
            details = []
            if result.get("score") is not None:
                details.append(f"score {format_number(result['score'])}")
            if result.get("rank") is not None:
                details.append(f"rank {format_number(result['rank'])}")
            result_label = f"TOOK_EXAM:{', '.join(details)}" if details else "TOOK_EXAM"
        else:
            result_label = f"TOOK_EXAM:score {format_number(result)}"
        add_edge(student_id, exam_id, result_label)

    for interest in profile_facts["interests"]:
        interest_id = add_node(f"interest:{interest.casefold()}", "Interest", interest)
        add_edge(student_id, interest_id, "HAS_INTEREST")

    for skill in profile_facts["skills"]:
        skill_id = add_node(f"skill:{skill.casefold()}", "Skill", skill)
        add_edge(student_id, skill_id, "HAS_SKILL")

    for aptitude, value in profile_facts["aptitude"].items():
        aptitude_id = add_node(f"aptitude:{aptitude.casefold()}", "Aptitude", aptitude)
        add_edge(student_id, aptitude_id, f"HAS_APTITUDE_RESULT:{format_number(value)}")

    if profile_facts["preferred_location"]:
        location = profile_facts["preferred_location"]
        location_id = add_node(f"location:{location.casefold()}", "Location", location)
        add_edge(student_id, location_id, "PREFERS_LOCATION")

    university_ids = {}
    for university in db.query(University).all():
        university_id = add_node(
            f"university:{university.id}",
            "University",
            university.name,
            verification_status=university.verification_status,
            academic_year=university.academic_year,
            source_url=university.source_url,
        )
        university_ids[university.id] = university_id
        add_source(
            university_id,
            "institution",
            university.source_url,
            university.source_title,
            university.verification_status,
            university.academic_year,
        )

    verified_careers = {
        career.id: career
        for career in db.query(Career).all()
        if career_is_verified(career)
    }
    for career in verified_careers.values():
        career_id = add_node(
            f"career:{career.id}",
            "Career",
            career.name,
            verification_status=career.verification_status,
            academic_year=career.academic_year,
            source_url=career.source_url,
        )
        add_source(
            career_id,
            "career",
            career.source_url,
            career.source_title,
            career.verification_status,
            career.academic_year,
        )
        for skill in career.technical_skills or []:
            skill_id = add_node(f"skill:{skill.casefold()}", "Skill", skill)
            add_edge(career_id, skill_id, "REQUIRES_SKILL")
        for skill in career.soft_skills or []:
            skill_id = add_node(f"skill:{skill.casefold()}", "Skill", skill)
            add_edge(career_id, skill_id, "BENEFITS_FROM_SKILL")
        for certification in career.certifications or []:
            certification_id = add_node(
                f"certification:{certification.casefold()}",
                "Certification",
                certification,
            )
            add_edge(career_id, certification_id, "RECOGNIZES_CERTIFICATION")

    programmes = db.query(Programme).options(joinedload(Programme.university)).all()
    for programme in programmes:
        programme_id = add_node(
            f"programme:{programme.id}",
            "Programme",
            programme.name,
            verification_status=programme.verification_status,
            academic_year=programme.academic_year,
            source_url=programme.source_url,
        )
        university_id = university_ids.get(programme.university_id)
        if university_id:
            add_edge(university_id, programme_id, "UNIVERSITY_OFFERS_PROGRAMME")
            university = programme.university
            for location in (university.city, university.state):
                if location:
                    location_id = add_node(f"location:{location.casefold()}", "Location", location)
                    add_edge(university_id, location_id, "LOCATED_IN")

        add_source(
            programme_id,
            "programme",
            programme.source_url,
            programme.source_title,
            programme.verification_status,
            programme.academic_year,
        )
        add_source(
            programme_id,
            "fee",
            programme.fee_source_url,
            programme.fee_source_title,
            programme.fee_verification_status,
            programme.fee_academic_year,
        )

        if programme_is_verified(programme, academic_year):
            for subject in programme.required_subjects or []:
                subject_id = add_node(f"subject:{subject.casefold()}", "Subject", subject)
                add_edge(programme_id, subject_id, "REQUIRES_SUBJECT:VERIFIED")
            for exam in programme.entrance_exams or []:
                exam_id = add_node(f"entrance-exam:{exam.casefold()}", "Entrance exam", exam)
                add_edge(programme_id, exam_id, "ACCEPTS_EXAM:VERIFIED")

        for career_ref in programme.career_ids or []:
            career = verified_careers.get(career_ref)
            if career:
                add_edge(programme_id, f"career:{career.id}", "PATHWAY_TO")

        result = evaluate_eligibility(profile_facts, programme, academic_year)
        add_edge(student_id, programme_id, f"ELIGIBILITY:{result['status']}")

    return {
        "available": True,
        "academic_year": academic_year,
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
    }
