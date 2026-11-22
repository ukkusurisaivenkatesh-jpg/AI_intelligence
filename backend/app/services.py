from copy import deepcopy


DEFAULT_WEIGHTS = {
    "academic": 25,
    "interest": 20,
    "aptitude": 15,
    "budget": 15,
    "location": 10,
    "career": 15,
}


def _read(item, key, default=None):
    return item.get(key, default) if isinstance(item, dict) else getattr(item, key, default)


def has_verification_provenance(record, academic_year=None):
    year = _read(record, "academic_year")
    return (
        _read(record, "verification_status") == "VERIFIED"
        and bool(year)
        and (academic_year is None or year == academic_year)
        and all(_read(record, key) for key in ("source_url", "source_title", "verified_at", "last_updated", "data_notes"))
    )


def programme_is_verified(programme, academic_year=None):
    university = _read(programme, "university")
    university_is_verified = university is not None and has_verification_provenance(university)
    return (
        has_verification_provenance(programme, academic_year)
        and _read(programme, "criteria_complete") is True
        and university_is_verified
    )


def fee_is_verified(programme, academic_year=None):
    fee_year = _read(programme, "fee_academic_year")
    return (
        _read(programme, "fee_verification_status") == "VERIFIED"
        and bool(fee_year)
        and (academic_year is None or fee_year == academic_year)
        and all(_read(programme, key) for key in (
            "fee_source_url", "fee_source_title", "fee_verified_at",
            "fee_last_updated", "fee_data_notes",
        ))
        and _read(programme, "annual_fee") is not None
    )


def career_is_verified(career):
    return has_verification_provenance(career)


def programme_dict(p, include_unverified=False):
    criteria_verified = programme_is_verified(p)
    verified_fee = fee_is_verified(p)
    verification_fields = (
        "degree_type", "specialization", "duration_text", "minimum_qualification",
        "additional_admission_conditions", "admission_route", "counselling_authority",
        "criteria_complete", "academic_year", "source_url", "source_title",
        "verification_status", "verified_at", "last_updated", "data_notes",
        "fee_academic_year", "fee_source_url", "fee_source_title",
        "fee_verification_status", "fee_verified_at", "fee_last_updated",
        "fee_data_notes", "other_academic_fees",
    )
    metadata = {
        key: _read(p, key)
        for key in verification_fields
    }
    if not include_unverified and not criteria_verified:
        metadata.update({
            "minimum_qualification": None,
            "additional_admission_conditions": [],
            "admission_route": None,
            "counselling_authority": None,
        })
    for key in ("verified_at", "last_updated", "fee_verified_at", "fee_last_updated"):
        if metadata[key] is not None:
            metadata[key] = metadata[key].isoformat()
    return {
        "id": p.id,
        "name": p.name,
        "discipline": p.discipline,
        "duration_years": p.duration_years,
        "annual_fee": p.annual_fee if include_unverified or verified_fee else None,
        "minimum_percentage": p.minimum_percentage if include_unverified or criteria_verified else None,
        "required_subjects": (p.required_subjects or []) if include_unverified or criteria_verified else [],
        "subject_minimums": (p.subject_minimums or {}) if include_unverified or criteria_verified else {},
        "entrance_exams": (p.entrance_exams or []) if include_unverified or criteria_verified else [],
        "entrance_requirements": (p.entrance_requirements or {}) if include_unverified or criteria_verified else {},
        "career_ids": p.career_ids or [],
        "data_status": p.data_status,
        "source": p.source,
        "last_verified": p.last_verified.isoformat() if p.last_verified else None,
        **metadata,
        "university": {
            "id": p.university.id,
            "name": p.university.name,
            "location": p.university.location,
            "region": p.university.region,
            "institution_type": getattr(p.university, "institution_type", None),
            "state": getattr(p.university, "state", None),
            "city": getattr(p.university, "city", None),
            "website": p.university.website,
            "recognition_info": getattr(p.university, "recognition_info", None),
            "source_url": getattr(p.university, "source_url", None),
            "source_title": getattr(p.university, "source_title", None),
            "verification_status": getattr(p.university, "verification_status", "PENDING_VERIFICATION"),
            "verified_at": getattr(p.university, "verified_at", None).isoformat() if getattr(p.university, "verified_at", None) else None,
            "academic_year": getattr(p.university, "academic_year", None),
            "last_updated": getattr(p.university, "last_updated", None).isoformat() if getattr(p.university, "last_updated", None) else None,
            "data_notes": getattr(p.university, "data_notes", None),
        } if p.university else None,
    }


def evaluate_eligibility(profile, programme, academic_year=None):
    p = programme_dict(programme) if hasattr(programme, "id") else deepcopy(programme)
    trace = []
    satisfied = []
    unsatisfied = []
    missing = []

    def value(key, default=None):
        return p.get(key, default)

    record_year = value("academic_year")
    requested_year = academic_year
    university = p.get("university")
    criteria_verified = (
        bool(academic_year)
        and has_verification_provenance(p, academic_year)
        and value("criteria_complete") is True
        and university is not None
        and has_verification_provenance(university)
    )
    if not criteria_verified:
        missing.append("Verified, complete admission criteria for the requested academic year")
        trace.append({
            "criterion": "admission_criteria_provenance",
            "verification_status": value("verification_status", "PENDING_VERIFICATION"),
            "record_academic_year": record_year,
            "requested_academic_year": academic_year,
            "source_title": value("source_title"),
            "source_url": value("source_url"),
            "result": "unavailable",
        })

    aggregate = profile.get("aggregate_marks")
    subjects = profile.get("subject_marks") or {}
    entrance = profile.get("entrance_scores") or {}

    if criteria_verified:
        minimum_qualification = value("minimum_qualification")
        qualification = profile.get("qualification")
        if minimum_qualification:
            if not qualification:
                missing.append("Highest qualification")
                trace.append({"criterion": "minimum_qualification", "result": "missing"})
            else:
                ok = qualification.strip().casefold() == minimum_qualification.strip().casefold()
                (satisfied if ok else unsatisfied).append(
                    f"Qualification: {qualification} vs required {minimum_qualification}"
                )
                trace.append({
                    "criterion": "minimum_qualification",
                    "required": minimum_qualification,
                    "actual": qualification,
                    "satisfied": ok,
                })

        minimum_percentage = value("minimum_percentage")
        if minimum_percentage is not None:
            if aggregate is None:
                missing.append("Aggregate percentage")
                trace.append({"criterion": "minimum_percentage", "result": "missing"})
            else:
                ok = aggregate >= minimum_percentage
                (satisfied if ok else unsatisfied).append(
                    f"Aggregate percentage: {aggregate}% vs {minimum_percentage}%"
                )
                trace.append({
                    "criterion": "minimum_percentage",
                    "required": minimum_percentage,
                    "actual": aggregate,
                    "satisfied": ok,
                })

        for subject in p.get("required_subjects") or []:
            if subject not in subjects:
                missing.append(f"Marks for {subject}")
                trace.append({"criterion": "required_subject", "subject": subject, "result": "missing"})
            else:
                minimum = (p.get("subject_minimums") or {}).get(subject)
                if minimum is None:
                    missing.append(f"Verified minimum for {subject}")
                    trace.append({"criterion": "subject", "subject": subject, "result": "minimum_unavailable"})
                    continue
                ok = subjects[subject] >= minimum
                (satisfied if ok else unsatisfied).append(f"{subject}: {subjects[subject]} vs minimum {minimum}")
                trace.append({"criterion": "subject", "subject": subject, "required": minimum, "actual": subjects[subject], "satisfied": ok})

        for exam in p.get("entrance_exams") or []:
            req = (p.get("entrance_requirements") or {}).get(exam, {})
            if not isinstance(req, dict):
                req = {}
            if exam not in entrance:
                missing.append(f"{exam} score or rank")
                trace.append({"criterion": "entrance", "exam": exam, "result": "missing"})
                continue
            minimum_score = req.get("minimum_score")
            maximum_rank = req.get("maximum_rank")
            if minimum_score is None and maximum_rank is None:
                missing.append(f"Verified score or rank requirement for {exam}")
                trace.append({"criterion": "entrance", "exam": exam, "result": "requirement_unavailable"})
                continue
            result = entrance[exam]
            score = result.get("score") if isinstance(result, dict) else result
            rank = result.get("rank") if isinstance(result, dict) else None
            checks = []
            if minimum_score is not None:
                if score is None:
                    missing.append(f"{exam} score")
                    checks.append({"measure": "score", "result": "missing"})
                else:
                    ok = score >= minimum_score
                    (satisfied if ok else unsatisfied).append(f"{exam} score: {score} vs minimum {minimum_score}")
                    checks.append({"measure": "score", "required": minimum_score, "actual": score, "satisfied": ok})
            if maximum_rank is not None:
                if rank is None:
                    missing.append(f"{exam} rank")
                    checks.append({"measure": "rank", "result": "missing"})
                else:
                    ok = rank <= maximum_rank
                    (satisfied if ok else unsatisfied).append(f"{exam} rank: {rank} vs maximum {maximum_rank}")
                    checks.append({"measure": "rank", "maximum": maximum_rank, "actual": rank, "satisfied": ok})
            trace.append({"criterion": "entrance", "exam": exam, "checks": checks})

        for condition in p.get("additional_admission_conditions") or []:
            if not isinstance(condition, dict):
                missing.append("Additional admission condition")
                trace.append({"criterion": "additional_condition", "result": "unavailable"})
                continue
            label = condition.get("label") or condition.get("description") or "Additional admission condition"
            field = condition.get("field")
            operator = condition.get("operator")
            expected = condition.get("value")
            actual = profile
            if isinstance(field, str) and field:
                path = field.split(".")
                if path[0] == "profile":
                    path = path[1:]
                for part in path:
                    if isinstance(actual, dict) and part in actual:
                        actual = actual[part]
                    else:
                        actual = None
                        break
            else:
                actual = None

            operations = {
                "eq": lambda a, b: a == b,
                "gte": lambda a, b: a >= b,
                "gt": lambda a, b: a > b,
                "lte": lambda a, b: a <= b,
                "lt": lambda a, b: a < b,
                "in": lambda a, b: a in b,
                "contains": lambda a, b: b in a,
                "has_any_key": lambda a, b: isinstance(a, dict) and any(key in a for key in b),
            }
            operation = operations.get(operator)
            if actual is None or expected is None or operation is None:
                missing.append(label)
                trace.append({"criterion": "additional_condition", "label": label, "result": "unavailable"})
                continue
            try:
                ok = operation(actual, expected)
            except (TypeError, ValueError):
                missing.append(label)
                trace.append({"criterion": "additional_condition", "label": label, "result": "unavailable"})
                continue
            (satisfied if ok else unsatisfied).append(label)
            trace.append({
                "criterion": "additional_condition",
                "label": label,
                "field": field,
                "operator": operator,
                "required": expected,
                "actual": actual,
                "satisfied": ok,
            })

    if unsatisfied:
        status = "Not Eligible"
    elif missing:
        status = "Insufficient Information"
    else:
        status = "Eligible"

    fee_verified = bool(requested_year) and fee_is_verified(p, requested_year)
    budget = profile.get("annual_budget")
    affordability = "unknown"
    if fee_verified and budget is not None:
        affordability = "affordable" if budget >= value("annual_fee") else "over_budget"

    return {
        "programme": p,
        "status": status,
        "academic_year": requested_year,
        "verification_status": value("verification_status", "PENDING_VERIFICATION"),
        "affordability": {
            "status": affordability,
            "annual_fee": value("annual_fee") if fee_verified else None,
            "academic_year": value("fee_academic_year") if fee_verified else None,
        },
        "satisfied": satisfied,
        "unsatisfied": unsatisfied,
        "missing": missing,
        "trace": trace,
    }


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
    fee_verified = bool(p.get("academic_year")) and fee_is_verified(p, p.get("academic_year"))
    fee = p["annual_fee"] if fee_verified else None
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


def rank_recommendations(profile, programmes, weights=None, academic_year=None):
    results = []
    for programme in programmes:
        eligibility = evaluate_eligibility(profile, programme, academic_year)
        if eligibility["status"] == "Eligible":
            suitability = suitability_score(profile, programme, weights)
            suitability["explanation"].append(
                f"Admission criteria source ({eligibility['academic_year']}): "
                f"{eligibility['programme']['source_title']} - {eligibility['programme']['source_url']}"
            )
            if eligibility["affordability"]["status"] != "unknown":
                suitability["explanation"].append(
                    f"Fee source ({eligibility['affordability']['academic_year']}): "
                    f"{eligibility['programme']['fee_source_title']} - "
                    f"{eligibility['programme']['fee_source_url']}"
                )
            results.append({**eligibility, "suitability": suitability})
    return sorted(results, key=lambda r: r["suitability"]["score"], reverse=True)
