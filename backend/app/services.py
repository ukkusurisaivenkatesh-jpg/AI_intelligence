from copy import deepcopy


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


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def programme_dict(p, include_unverified=False, academic_year=None):
    criteria_verified = programme_is_verified(p, academic_year)
    verified_fee = fee_is_verified(p, academic_year)
    stored_status = _read(p, "verification_status", "PENDING_VERIFICATION")
    if stored_status == "EXPIRED":
        criteria_status = "EXPIRED"
    elif academic_year and _read(p, "academic_year") and _read(p, "academic_year") != academic_year:
        criteria_status = "NOT_CURRENT_FOR_YEAR"
    elif criteria_verified:
        criteria_status = "VERIFIED"
    elif stored_status == "UNAVAILABLE":
        criteria_status = "UNAVAILABLE"
    else:
        criteria_status = "PENDING_VERIFICATION"
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
        metadata[key] = _iso(metadata[key])
    university = _read(p, "university")
    return {
        "id": _read(p, "id"),
        "name": _read(p, "name"),
        "discipline": _read(p, "discipline"),
        "duration_years": _read(p, "duration_years"),
        "annual_fee": _read(p, "annual_fee") if include_unverified or verified_fee else None,
        "minimum_percentage": _read(p, "minimum_percentage") if include_unverified or criteria_verified else None,
        "required_subjects": (_read(p, "required_subjects") or []) if include_unverified or criteria_verified else [],
        "subject_minimums": (_read(p, "subject_minimums") or {}) if include_unverified or criteria_verified else {},
        "entrance_exams": (_read(p, "entrance_exams") or []) if include_unverified or criteria_verified else [],
        "entrance_requirements": (_read(p, "entrance_requirements") or {}) if include_unverified or criteria_verified else {},
        "career_ids": _read(p, "career_ids") or [],
        "data_status": _read(p, "data_status"),
        "source": _read(p, "source"),
        "last_verified": _iso(_read(p, "last_verified")),
        "criteria_status": criteria_status,
        **metadata,
        "university": {
            "id": _read(university, "id"),
            "name": _read(university, "name"),
            "location": _read(university, "location"),
            "region": _read(university, "region"),
            "institution_type": _read(university, "institution_type"),
            "state": _read(university, "state"),
            "city": _read(university, "city"),
            "website": _read(university, "website"),
            "recognition_info": _read(university, "recognition_info"),
            "source_url": _read(university, "source_url"),
            "source_title": _read(university, "source_title"),
            "verification_status": _read(university, "verification_status", "PENDING_VERIFICATION"),
            "verified_at": _iso(_read(university, "verified_at")),
            "academic_year": _read(university, "academic_year"),
            "last_updated": _iso(_read(university, "last_updated")),
            "data_notes": _read(university, "data_notes"),
        } if university else None,
    }


def evaluate_eligibility(profile, programme, academic_year=None):
    p = (
        programme_dict(programme, academic_year=academic_year)
        if hasattr(programme, "id")
        else deepcopy(programme)
    )
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
                    nested_profile = profile.get("profile")
                    if isinstance(nested_profile, dict) and path and path[0] in nested_profile:
                        actual = nested_profile
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


def _catalogue_text_match(values, *targets):
    targets = [str(target or "").casefold() for target in targets]
    return [
        str(value).strip()
        for value in values
        if str(value).strip()
        and any(str(value).strip().casefold() in target for target in targets)
    ]


def recommendation_reasons(profile, programme, academic_year=None):
    name = _read(programme, "name", "") or ""
    discipline = _read(programme, "discipline", "") or ""
    university = _read(programme, "university")
    location = " ".join(
        str(_read(university, field, "") or "")
        for field in ("location", "city", "state", "region")
    )
    targets = (name, discipline)
    reasons = []
    interests = _catalogue_text_match(profile.get("interests") or [], *targets)
    if interests:
        reasons.append("Interest aligns with the programme listing: " + ", ".join(interests))
    skills = _catalogue_text_match(profile.get("skills") or [], *targets)
    if skills:
        reasons.append("A saved skill aligns with the programme listing: " + ", ".join(skills))
    subjects = _catalogue_text_match(
        (profile.get("subject_marks") or {}).keys(), *targets
    )
    if subjects:
        reasons.append("A studied subject aligns with the programme listing: " + ", ".join(subjects))
    goals = profile.get("profile") or {}
    career_goals = goals.get("career_goals", goals.get("career_goal", []))
    if isinstance(career_goals, str):
        career_goals = [career_goals]
    if isinstance(career_goals, list):
        matched_goals = _catalogue_text_match(career_goals, *targets)
        if matched_goals:
            reasons.append("A saved career goal aligns with the programme listing: " + ", ".join(matched_goals))
    preferred_location = profile.get("preferred_location")
    if preferred_location and preferred_location.casefold() in location.casefold():
        reasons.append(f"Catalogue location matches your preference: {preferred_location}")
    if not reasons:
        return []
    return reasons


def build_recommendation_categories(profile, programmes, academic_year=None):
    verified = []
    suggestions = []
    for programme in programmes:
        evaluation = evaluate_eligibility(profile, programme, academic_year)
        reasons = recommendation_reasons(profile, programme, academic_year)
        catalogue_record = programme_dict(programme, academic_year=academic_year)
        if evaluation["status"] == "Eligible":
            verified.append(
                {
                    **evaluation,
                    "relevance_reasons": reasons
                    or ["Meets all complete, verified admission criteria for the selected year."],
                }
            )
        elif reasons:
            suggestions.append(
                {
                    "programme": catalogue_record,
                    "eligibility_status": evaluation["status"],
                    "affordability": evaluation["affordability"],
                    "missing": evaluation["missing"],
                    "unsatisfied": evaluation["unsatisfied"],
                    "relevance_reasons": reasons,
                }
            )
    verified.sort(key=lambda item: (-len(item["relevance_reasons"]), item["programme"]["name"].casefold()))
    suggestions.sort(
        key=lambda item: (
            -len(item["relevance_reasons"]),
            item["programme"]["name"].casefold(),
        )
    )
    return {
        "verified_recommendations": verified,
        "explore_suggestions": suggestions,
    }


def rank_recommendations(profile, programmes, academic_year=None):
    return build_recommendation_categories(profile, programmes, academic_year)[
        "verified_recommendations"
    ]
