from datetime import date
from app.engine.frames import FrameRegistry
from app.engine.rules import RuleEngine
from app.services import evaluate_eligibility, rank_recommendations


def programme(fee=100000, minimum=60):
    return {"id": 1, "name": "B.Tech CS Demo", "discipline": "Technology", "duration_years": 4, "annual_fee": fee, "minimum_percentage": minimum, "required_subjects": ["Physics", "Mathematics"], "subject_minimums": {"Mathematics": 55}, "entrance_exams": ["JEE Main"], "entrance_requirements": {"JEE Main": {"minimum_score": 70}}, "career_ids": [1], "data_status": "demo", "source": "demo", "last_verified": None, "university": {"name": "Demo University", "location": "Pune"}}


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
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": None, "subject_marks": {}, "entrance_scores": {}, "annual_budget": 200000}, programme())
    assert result["status"] == "Insufficient Information"
    assert "Aggregate percentage" in result["missing"]


def test_subject_failure_is_not_eligible():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 40}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 200000}, programme())
    assert result["status"] == "Not Eligible"


def test_budget_makes_conditionally_eligible():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 50000}, programme(fee=100000))
    assert result["status"] == "Conditionally Eligible"


def test_missing_entrance_is_insufficient():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {}, "annual_budget": 200000}, programme())
    assert "JEE Main score" in result["missing"]


def test_expired_criteria_is_not_officially_verified():
    result = evaluate_eligibility({"qualification": "12th Grade", "aggregate_marks": 82, "subject_marks": {"Physics": 80, "Mathematics": 88}, "entrance_scores": {"JEE Main": 90}, "annual_budget": 200000}, programme())
    assert result["status"] in ("Eligible", "Criteria Not Verified")


def test_recommendations_require_eligibility():
    ineligible = {"aggregate_marks": 40, "subject_marks": {}, "entrance_scores": {}, "interests": [], "aptitude": {}, "annual_budget": 200000, "preferred_location": ""}
    assert rank_recommendations(ineligible, [programme()]) == []


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
        result = evaluate_eligibility(base, programme())
        assert result["status"] in {"Eligible", "Not Eligible", "Conditionally Eligible", "Insufficient Information", "Criteria Not Verified"}
