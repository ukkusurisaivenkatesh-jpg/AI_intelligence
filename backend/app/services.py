from copy import deepcopy
from datetime import date


DEFAULT_WEIGHTS = {
    "academic": 25,
    "interest": 20,
    "aptitude": 15,
    "budget": 15,
    "location": 10,
    "career": 15,
}


def programme_dict(p):
    return {
        "id": p.id,
        "name": p.name,
        "discipline": p.discipline,
        "duration_years": p.duration_years,
        "annual_fee": p.annual_fee,
        "minimum_percentage": p.minimum_percentage,
        "required_subjects": p.required_subjects or [],
        "subject_minimums": p.subject_minimums or {},
        "entrance_exams": p.entrance_exams or [],
        "entrance_requirements": p.entrance_requirements or {},
        "career_ids": p.career_ids or [],
        "data_status": p.data_status,
        "source": p.source,
        "last_verified": p.last_verified.isoformat() if p.last_verified else None,
        "university": {"id": p.university.id, "name": p.university.name, "location": p.university.location, "region": p.university.region} if p.university else None,
    }


def evaluate_eligibility(profile, programme):
    p = programme_dict(programme) if hasattr(programme, "id") else deepcopy(programme)
    trace = []
    satisfied = []
    unsatisfied = []
    missing = []
    aggregate = profile.get("aggregate_marks")
    subjects = profile.get("subject_marks") or {}
    entrance = profile.get("entrance_scores") or {}

    if not profile.get("qualification"):
        missing.append("Highest qualification")
        trace.append({"fact": "qualification", "result": "missing"})
    else:
        trace.append({"fact": "qualification", "value": profile["qualification"], "result": "present"})

    if aggregate is None:
        missing.append("Aggregate percentage")
        trace.append({"criterion": "minimum_percentage", "result": "missing"})
    elif p["minimum_percentage"] is not None:
        ok = aggregate >= p["minimum_percentage"]
        (satisfied if ok else unsatisfied).append(f"Aggregate percentage: {aggregate}% vs {p['minimum_percentage']}%")
        trace.append({"criterion": "minimum_percentage", "required": p["minimum_percentage"], "actual": aggregate, "satisfied": ok})

    for subject in p["required_subjects"]:
        if subject not in subjects:
            missing.append(f"Marks for {subject}")
            trace.append({"criterion": "required_subject", "subject": subject, "result": "missing"})
        else:
            minimum = p["subject_minimums"].get(subject)
            ok = minimum is None or subjects[subject] >= minimum
            (satisfied if ok else unsatisfied).append(f"{subject}: {subjects[subject]} vs minimum {minimum}")
            trace.append({"criterion": "subject", "subject": subject, "required": minimum, "actual": subjects[subject], "satisfied": ok})

    for exam in p["entrance_exams"]:
        req = p["entrance_requirements"].get(exam, {})
        if exam not in entrance:
            missing.append(f"{exam} score")
            trace.append({"criterion": "entrance", "exam": exam, "result": "missing"})
            continue
        score = entrance[exam]
        minimum = req.get("minimum_score")
        ok = minimum is None or score >= minimum
        (satisfied if ok else unsatisfied).append(f"{exam}: {score} vs minimum {minimum}")
        trace.append({"criterion": "entrance", "exam": exam, "required": minimum, "actual": score, "satisfied": ok})

    if p["data_status"] != "officially_sourced" or p["last_verified"] is None:
        missing.append("Verified admission criteria")

    if unsatisfied:
        status = "Not Eligible"
    elif missing:
        status = "Insufficient Information"
    else:
        status = "Eligible"
    if status == "Eligible" and unsatisfied == [] and p["annual_fee"] and profile.get("annual_budget") is not None:
        if profile["annual_budget"] < p["annual_fee"]:
            status = "Conditionally Eligible"
            unsatisfied.append("Tuition exceeds annual budget")
    elif status == "Insufficient Information" and missing == ["Verified admission criteria"] and p["annual_fee"] and profile.get("annual_budget") is not None and profile["annual_budget"] < p["annual_fee"]:
        status = "Conditionally Eligible"
        unsatisfied.append("Tuition exceeds annual budget")
    elif status == "Insufficient Information" and len(missing) == 1 and missing[0] == "Verified admission criteria":
        status = "Criteria Not Verified"

    return {"programme": p, "status": status, "satisfied": satisfied, "unsatisfied": unsatisfied, "missing": missing, "trace": trace}


def suitability_score(profile, programme, weights=None):
    weights = weights or DEFAULT_WEIGHTS
    p = programme_dict(programme) if hasattr(programme, "id") else deepcopy(programme)
    factors = {}
    aggregate = profile.get("aggregate_marks")
    minimum = p["minimum_percentage"]
    factors["academic"] = round(min(100, 100 * aggregate / minimum), 1) if aggregate is not None and minimum else 50
    interests = set(profile.get("interests") or [])
    discipline = (p["discipline"] or "").lower()
    name = (p["name"] or "").lower()
    matched = sum(1 for interest in interests if interest.lower() in name or interest.lower() in discipline)
    factors["interest"] = min(100, 50 + matched * 25)
    aptitude = profile.get("aptitude") or {}
    factors["aptitude"] = round(sum(float(v) for v in aptitude.values()) / max(1, len(aptitude)) * 10, 1) if aptitude else 50
    budget = profile.get("annual_budget")
    fee = p["annual_fee"]
    factors["budget"] = 100 if budget is not None and fee is not None and budget >= fee else (70 if budget is None or fee is None else max(0, 100 - (fee - budget) / max(fee, 1) * 100))
    location = (profile.get("preferred_location") or "").lower()
    uni_location = ((p["university"] or {}).get("location") or "").lower()
    factors["location"] = 100 if location and location in uni_location else (50 if not location else 25)
    careers = profile.get("career_interests") or []
    factors["career"] = 75 if not careers else (100 if any(str(c).lower() in name for c in careers) else 60)
    total = sum(factors[k] * weights.get(k, 0) / 100 for k in factors)
    explanations = [
        f"Academic compatibility: {factors['academic']:.1f}",
        f"Interest compatibility: {factors['interest']:.1f}",
        f"Budget compatibility: {factors['budget']:.1f}",
        f"Location compatibility: {factors['location']:.1f}",
    ]
    return {"score": round(total, 1), "factors": factors, "explanation": explanations}


def rank_recommendations(profile, programmes, weights=None):
    results = []
    for programme in programmes:
        eligibility = evaluate_eligibility(profile, programme)
        if eligibility["status"] in ("Eligible", "Conditionally Eligible"):
            suitability = suitability_score(profile, programme, weights)
            results.append({**eligibility, "suitability": suitability})
    return sorted(results, key=lambda r: r["suitability"]["score"], reverse=True)
