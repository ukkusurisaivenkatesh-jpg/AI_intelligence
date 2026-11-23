from datetime import date, datetime
from app.engine.frames import FrameRegistry
from app.engine.rules import RuleEngine
from app.services import evaluate_eligibility, rank_recommendations


def programme(fee=100000, minimum=60):
    return {
        "id": 1,
        "name": "B.Tech CS Test Fixture",
        "discipline": "Technology",
        "duration_years": 4,
        "annual_fee": fee,
        "minimum_percentage": minimum,
        "required_subjects": ["Physics", "Mathematics"],
        "subject_minimums": {"Physics": 50, "Mathematics": 55},
        "entrance_exams": ["JEE Main"],
        "entrance_requirements": {"JEE Main": {"minimum_score": 70}},
        "career_ids": [1],
        "data_status": "test_fixture",
        "source": "test fixture only",
        "last_verified": None,
        "minimum_qualification": "12th Grade",
        "criteria_complete": True,
        "academic_year": "2026-27",
        "source_url": "https://example.test/test-fixture",
        "source_title": "Test fixture",
        "verification_status": "VERIFIED",
        "verified_at": datetime(2026, 1, 1).isoformat(),
        "last_updated": datetime(2026, 1, 1).isoformat(),
        "data_notes": "Test fixture, not admission data",
        "fee_academic_year": "2026-27",
        "fee_source_url": "https://example.test/test-fee-fixture",
        "fee_source_title": "Test fee fixture",
        "fee_verification_status": "VERIFIED",
        "fee_verified_at": datetime(2026, 1, 1).isoformat(),
        "fee_last_updated": datetime(2026, 1, 1).isoformat(),
        "fee_data_notes": "Test fixture, not actual fees",
        "university": {
            "name": "Test University",
            "location": "Pune",
            "verification_status": "VERIFIED",
            "academic_year": "2026-27",
            "source_url": "https://example.test/test-university",
            "source_title": "Test university fixture",
            "verified_at": datetime(2026, 1, 1).isoformat(),
            "last_updated": datetime(2026, 1, 1).isoformat(),
            "data_notes": "Test fixture, not real institutional data",
        },
    }


def test_frame_registry_defaults_and_relationships():
    registry = FrameRegistry()
    frame = registry.create("Programme", "CS", {"minimum_percentage": 60}, {"university": "U1"})
    assert frame.attributes["duration_years"] is None
    assert registry.get("Programme", "CS")["relationships"]["university"] == "U1"


def test_forward_chaining():
    engine = RuleEngine([{"id": "r1", "name": "Math eligibility", "conditions": {"all": [{"fact": "aggregate_marks", "operator": "gte", "value": 60}, {"fact": "subject_marks.Mathematics", "operator": "gte", "value": 55}]}, "result": {"fact": "eligibility.academic", "value": "satisfied"}}])
    facts, trace = engine.forward_chain({"aggregate_marks": 82, "subject_marks": {"Mathematics": 88}})
    assert facts["eligibility"]["academic"] == "satisfied"
    assert trace[0]["rule_id"] == "r1"


def test_backward_chaining():
    engine = RuleEngine([{"id": "r1", "name": "Qualified", "conditions": {"fact": "qualification", "operator": "eq", "value": "12th Grade"}, "result": {"fact": "eligibility.qualified", "value": "satisfied"}}])
    result = engine.backward_chain({"fact": "eligibility.qualified", "value": "satisfied"}, {"qualification": "12th Grade"})
    assert result["achieved"] is True


def test_conflict_priority_and_expiry():
    engine = RuleEngine([
        {"id": "high", "name": "High", "priority": 500, "conditions": {"fact": "x", "operator": "eq", "value": 1}, "result": {"fact": "y", "value": "a"}},
        {"id": "expired", "name": "Expired", "priority": 900, "expiry_date": date(2020, 1, 1), "conditions": {"fact": "x", "operator": "eq", "value": 1}, "result": {"fact": "y", "value": "b"}},
    ])
    facts, trace = engine.forward_chain({"x": 1})
    assert facts["y"] == "a"
    assert trace[0]["rule_id"] == "high"


def test_missing_marks_are_never_satisfied():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": None, "subject_marks": {}, "entrance_scores": {}, "annual_budget": 200000}, programme(), "2026-27")
    assert result["status"] == "Insufficient Information"
    assert "Aggregate percentage" in result["missing"]


def test_subject_failure_is_not_eligible():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 40}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 200000}, programme(), "2026-27")
    assert result["status"] == "Not Eligible"


def test_affordability_does_not_change_academic_eligibility():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 50000}, programme(fee=100000), "2026-27")
    assert result["status"] == "Eligible"
    assert result["affordability"]["status"] == "over_budget"


def test_missing_entrance_is_insufficient():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {}, "annual_budget": 200000}, programme(), "2026-27")
    assert "JEE Main score or rank" in result["missing"]


def test_expired_criteria_is_not_officially_verified():
    expired = programme()
    expired["verification_status"] = "EXPIRED"
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 200000}, expired, "2026-27")
    assert result["status"] == "Insufficient Information"
    assert result["satisfied"] == []


def test_academic_year_must_match_requested_year():
    result = evaluate_eligibility(
        {"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}},
        programme(),
        academic_year="2027-28",
    )
    assert result["status"] == "Insufficient Information"
    assert result["affordability"]["status"] == "unknown"


def test_missing_requested_academic_year_never_uses_recorded_criteria():
    result = evaluate_eligibility(
        {"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}},
        programme(),
    )
    assert result["status"] == "Insufficient Information"
    assert result["satisfied"] == []


def test_missing_subject_requirement_is_unknown_not_satisfied():
    incomplete = programme()
    incomplete["subject_minimums"].pop("Physics")
    result = evaluate_eligibility(
        {"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}},
        incomplete,
        "2026-27",
    )
    assert result["status"] == "Insufficient Information"
    assert "Verified minimum for Physics" in result["missing"]


def test_qualification_requirement_is_programme_specific():
    result = evaluate_eligibility(
        {"qualification": "Diploma", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}},
        programme(),
        "2026-27",
    )
    assert result["status"] == "Not Eligible"
    assert any("Qualification:" in item for item in result["unsatisfied"])


def test_entrance_rank_and_additional_conditions_are_evaluated():
    criteria = programme()
    criteria["entrance_requirements"] = {"JEE Main": {"maximum_rank": 5000}}
    criteria["additional_admission_conditions"] = [
        {"label": "Applicant category", "field": "category", "operator": "eq", "value": "General"}
    ]
    profile = {
        "qualification": "12th Grade",
        "aggregate_marks": 82,
        "subject_marks": {"Physics": 80, "Mathematics": 88},
        "entrance_scores": {"JEE Main": {"rank": 4200}},
        "category": "General",
    }
    result = evaluate_eligibility(profile, criteria, "2026-27")
    assert result["status"] == "Eligible"
    assert "Applicant category" in result["satisfied"]


def test_nested_profile_facts_support_programme_specific_conditions():
    criteria = programme()
    criteria["additional_admission_conditions"] = [
        {"label": "Applicant category", "field": "profile.category", "operator": "eq", "value": "OBC-NCL"}
    ]
    profile = {
        "qualification": "12th Grade",
        "aggregate_marks": 82,
        "subject_marks": {"Physics": 80, "Mathematics": 88},
        "entrance_scores": {"JEE Main": 90},
        "profile": {"category": "OBC-NCL"},
    }

    result = evaluate_eligibility(profile, criteria, "2026-27")
    assert result["status"] == "Eligible"
    assert "Applicant category" in result["satisfied"]


def test_unavailable_additional_condition_is_not_assumed_satisfied():
    criteria = programme()
    criteria["additional_admission_conditions"] = [
        {"label": "Category condition", "field": "category", "operator": "eq", "value": "General"}
    ]
    result = evaluate_eligibility(
        {"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}},
        criteria,
        "2026-27",
    )
    assert result["status"] == "Insufficient Information"
    assert "Category condition" in result["missing"]


def test_unverified_programme_cannot_produce_eligibility_or_recommendation():
    unverified = programme()
    unverified["verification_status"] = "PENDING_VERIFICATION"
    profile = {"qualification": "12th Grade", "aggregate_marks": 95, "subject_marks": {"Physics": 95, "Mathematics": 95}, "entrance_scores": {"JEE Main": 99}}
    result = evaluate_eligibility(profile, unverified, "2026-27")
    assert result["status"] == "Insufficient Information"
    assert result["satisfied"] == []
    assert rank_recommendations(profile, [unverified]) == []


def test_verified_but_incomplete_criteria_are_unknown():
    incomplete = programme()
    incomplete["criteria_complete"] = False
    result = evaluate_eligibility({}, incomplete, "2026-27")
    assert result["status"] == "Insufficient Information"
    assert result["satisfied"] == []


def test_recommendations_require_eligibility():
    ineligible = {"aggregate_marks": 40, "subject_marks": {}, "entrance_scores": {}, "interests": [], "aptitude": {}, "annual_budget": 200000, "preferred_location": ""}
    assert rank_recommendations(ineligible, [programme()], academic_year="2026-27") == []


def test_recommendations_use_matching_verified_academic_year():
    profile = {"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 150000}
    results = rank_recommendations(profile, [programme()], academic_year="2026-27")
    assert len(results) == 1
    assert results[0]["programme"]["source_title"] == "Test fixture"
    assert results[0]["programme"]["fee_source_url"].endswith("test-fee-fixture")
    assert "relevance_reasons" in results[0]
    assert "suitability" not in results[0]
    assert rank_recommendations(profile, [programme()], academic_year="2027-28") == []


def test_recommendations_explain_profile_matches_without_numeric_scores():
    preferred = programme()
    preferred["name"] = "B.Tech Technology Test Fixture"
    other = {**programme(), "id": 2, "name": "B.Tech Physics Test Fixture", "discipline": "Physics"}
    profile = {
        "qualification": "12th Grade",
        "aggregate_marks": 82,
        "subject_marks": {"Physics": 80, "Mathematics": 88},
        "entrance_scores": {"JEE Main": 90},
        "interests": ["Technology"],
        "skills": ["Technology"],
        "annual_budget": 150000,
        "preferred_location": "Pune",
    }

    results = rank_recommendations(profile, [other, preferred], academic_year="2026-27")

    assert [item["programme"]["id"] for item in results] == [1, 2]
    assert any("Interest aligns" in reason for reason in results[0]["relevance_reasons"])
    assert any("Catalogue location matches" in reason for reason in results[0]["relevance_reasons"])
    assert all("suitability" not in item for item in results)


def test_10_diverse_profiles():
    profiles = [
        {"aggregate_marks": 85, "subject_marks": {"Physics": 85, "Mathematics": 88}, "entrance_scores": {"JEE Main": 95}, "annual_budget": 200000},
        {"aggregate_marks": 75, "subject_marks": {"Physics": 70, "Mathematics": 72}, "entrance_scores": {"JEE Main": 80}, "annual_budget": 120000},
        {"aggregate_marks": 65, "subject_marks": {"Physics": 60, "Mathematics": 65}, "entrance_scores": {"JEE Main": 75}, "annual_budget": 100000},
        {"aggregate_marks": 59, "subject_marks": {"Physics": 55, "Mathematics": 60}, "entrance_scores": {"JEE Main": 70}, "annual_budget": 90000},
        {"aggregate_marks": 90, "subject_marks": {"Physics": 90, "Mathematics": 91}, "entrance_scores": {}, "annual_budget": 150000},
        {"aggregate_marks": 80, "subject_marks": {"Physics": 30, "Mathematics": 90}, "entrance_scores": {"JEE Main": 85}, "annual_budget": 150000},
        {"aggregate_marks": None, "subject_marks": {}, "entrance_scores": {}, "annual_budget": 150000},
        {"aggregate_marks": 70, "subject_marks": {"Physics": 65, "Mathematics": 70}, "entrance_scores": {"JEE Main": 69}, "annual_budget": 50000},
        {"aggregate_marks": 55, "subject_marks": {"Physics": 50, "Mathematics": 55}, "entrance_scores": {"JEE Main": 71}, "annual_budget": 100000},
        {"aggregate_marks": 95, "subject_marks": {"Physics": 95, "Mathematics": 96}, "entrance_scores": {"JEE Main": 99}, "annual_budget": 300000},
    ]
    for i, base in enumerate(profiles):
        base.update({"qualification": "12th Grade", "interests": [], "aptitude": {}, "preferred_location": ""})
        result = evaluate_eligibility(base, programme(), "2026-27")
        assert result["status"] in {"Eligible", "Not Eligible", "Conditionally Eligible", "Insufficient Information", "Criteria Not Verified"}
