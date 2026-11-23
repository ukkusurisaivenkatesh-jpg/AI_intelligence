from copy import deepcopy

from app.counselling import build_rule_based_counselling_response


YEAR = "2026-27"


def verified_programme():
    return {
        "id": 41,
        "name": "Bachelor of Computer Science",
        "discipline": "Computer Science",
        "annual_fee": 100000,
        "minimum_percentage": 75,
        "required_subjects": ["Mathematics"],
        "subject_minimums": {"Mathematics": 60},
        "entrance_exams": [],
        "entrance_requirements": {},
        "career_ids": [],
        "minimum_qualification": None,
        "additional_admission_conditions": [],
        "criteria_complete": True,
        "academic_year": YEAR,
        "source_url": "https://example.test/programme",
        "source_title": "Official programme criteria",
        "verification_status": "VERIFIED",
        "verified_at": "2026-01-01",
        "last_updated": "2026-01-01",
        "data_notes": "Criteria checked against the source.",
        "fee_academic_year": YEAR,
        "fee_source_url": "https://example.test/fees",
        "fee_source_title": "Official tuition schedule",
        "fee_verification_status": "VERIFIED",
        "fee_verified_at": "2026-01-01",
        "fee_last_updated": "2026-01-01",
        "fee_data_notes": "Tuition checked against the source.",
        "university": {
            "id": 7,
            "name": "Example University",
            "location": "Pune",
            "verification_status": "VERIFIED",
            "academic_year": YEAR,
            "source_url": "https://example.test/institution",
            "source_title": "Official institution profile",
            "verified_at": "2026-01-01",
            "last_updated": "2026-01-01",
            "data_notes": "Institution checked against the source.",
        },
    }


def student_profile():
    return {
        "qualification": "12th Grade",
        "aggregate_marks": 82,
        "subject_marks": {"Mathematics": 78},
        "entrance_scores": {},
        "interests": ["Computer Science"],
        "aptitude": {},
        "skills": ["Python"],
        "preferred_location": "Pune",
        "annual_budget": 150000,
        "profile": {},
    }


def test_recommendation_and_course_explanation_use_verified_records():
    programme = verified_programme()
    profile = student_profile()

    recommendations = build_rule_based_counselling_response(
        "Recommend suitable programmes", profile, [programme], [], YEAR
    )
    assert recommendations["engine"] == "rule-based-demo"
    assert len(recommendations["recommendations"]) == 1
    assert "Bachelor of Computer Science at Example University: Eligible" in recommendations["answer"]
    assert "affordability affordable" in recommendations["answer"]
    assert "%" not in recommendations["answer"]

    explanation = build_rule_based_counselling_response(
        "Why is Bachelor of Computer Science recommended?",
        profile,
        [programme],
        [],
        YEAR,
    )
    assert "Bachelor of Computer Science at Example University: Eligible" in explanation["answer"]
    assert "₹100,000" in explanation["answer"]
    assert "Profile match:" in explanation["answer"]
    assert "Official programme criteria" in explanation["answer"]


def test_what_if_applies_temporary_changes_and_reports_eligibility_change():
    programme = verified_programme()
    profile = student_profile()
    original = deepcopy(profile)

    result = build_rule_based_counselling_response(
        "What if I get lower marks?",
        profile,
        [programme],
        [],
        YEAR,
        {"aggregate_marks": 70},
    )

    assert result["scenario"] is True
    assert "No longer eligible: Bachelor of Computer Science at Example University." in result["answer"]
    assert profile == original


def test_unverified_criteria_and_fees_are_never_asserted_as_verified():
    programme = verified_programme()
    programme["verification_status"] = "PENDING_VERIFICATION"
    programme["fee_verification_status"] = "PENDING_VERIFICATION"

    result = build_rule_based_counselling_response(
        "Which programmes fit my profile?",
        student_profile(),
        [programme],
        [],
        YEAR,
    )

    assert result["recommendations"] == []
    assert "can't confirm a suitable eligible programme" in result["answer"]
    assert "₹100,000" not in result["answer"]


def test_career_guidance_uses_only_source_verified_careers():
    career = {
        "id": 3,
        "name": "Software Developer",
        "description": "Software development across application projects.",
        "technical_skills": ["Python"],
        "soft_skills": ["Communication"],
        "verification_status": "VERIFIED",
        "academic_year": YEAR,
        "source_url": "https://example.test/careers",
        "source_title": "Official career framework",
        "verified_at": "2026-01-01",
        "last_updated": "2026-01-01",
        "data_notes": "Career details checked against the source.",
    }
    unverified = {**career, "id": 4, "name": "Unverified Career", "verification_status": "PENDING_VERIFICATION"}
    profile = student_profile()
    profile["profile"]["career_goal"] = "software development"

    result = build_rule_based_counselling_response(
        "Suggest career pathways",
        profile,
        [],
        [career, unverified],
        YEAR,
    )

    assert "Software Developer" in result["answer"]
    assert "Unverified Career" not in result["answer"]
    assert career["source_url"] in result["answer"]
    assert "saved career goal: software development" in result["answer"]
