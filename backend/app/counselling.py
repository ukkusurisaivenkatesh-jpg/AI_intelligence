from copy import deepcopy

from .services import (
    career_is_verified,
    evaluate_eligibility,
    fee_is_verified,
    programme_is_verified,
    recommendation_reasons,
    rank_recommendations,
)


_MAP_FIELDS = {"subject_marks", "entrance_scores", "aptitude", "profile"}


def _value(record, key: str, default=None):
    return record.get(key, default) if isinstance(record, dict) else getattr(record, key, default)


def _apply_changes(profile: dict, changes: dict | None) -> dict:
    result = deepcopy(profile)
    for field, value in (changes or {}).items():
        if field in _MAP_FIELDS and isinstance(value, dict):
            result[field] = {**(result.get(field) or {}), **value}
        else:
            result[field] = value
    return result


def _title(record: dict) -> str:
    title = record["programme"]["name"]
    university = record["programme"].get("university") or {}
    if university.get("name"):
        title += f" at {university['name']}"
    return title


def _missing(profile: dict, academic_year: str | None) -> list[str]:
    result = []
    if profile.get("aggregate_marks") is None:
        result.append("aggregate marks")
    if not profile.get("subject_marks"):
        result.append("subject-wise marks")
    if not profile.get("entrance_scores"):
        result.append("entrance examination scores")
    if not academic_year:
        result.append("requested academic year")
    return result


def _recommendation_text(
    recommendations: list[dict], profile: dict, academic_year: str | None
) -> str:
    entries = []
    for item in recommendations[:3]:
        programme = item["programme"]
        affordability = item["affordability"]
        details = [
            f"{_title(item)}: {item['status']}",
            f"affordability {affordability['status']}",
        ]
        details.extend(recommendation_reasons(profile, programme, academic_year))
        if affordability["annual_fee"] is not None:
            details.append(
                f"verified annual tuition ₹{affordability['annual_fee']:,.0f} "
                f"for {affordability['academic_year']}"
            )
        if programme.get("source_url"):
            details.append(
                f"source ({programme.get('academic_year') or 'year unknown'}): "
                f"{programme.get('source_title') or programme['source_url']}"
            )
        entries.append("; ".join(details) + ".")
    return " ".join(entries)


def build_rule_based_counselling_response(
    message: str,
    profile: dict,
    programmes: list,
    careers: list,
    academic_year: str | None,
    profile_changes: dict | None = None,
) -> dict:
    current = deepcopy(profile)
    scenario = _apply_changes(current, profile_changes)
    scenario_applied = bool(profile_changes)
    records = [
        evaluate_eligibility(scenario, programme, academic_year)
        for programme in programmes
    ]
    current_records = (
        [evaluate_eligibility(current, programme, academic_year) for programme in programmes]
        if scenario_applied
        else records
    )
    recommendations = rank_recommendations(
        scenario, programmes, academic_year=academic_year
    )
    recommendation_by_id = {
        item["programme"]["id"]: item for item in recommendations
    }
    current_eligible = {
        item["programme"]["id"]
        for item in current_records
        if item["status"] == "Eligible"
    }
    scenario_eligible = {
        item["programme"]["id"]
        for item in records
        if item["status"] == "Eligible"
    }
    newly_eligible = scenario_eligible - current_eligible
    no_longer_eligible = current_eligible - scenario_eligible
    missing = _missing(scenario, academic_year)
    text = message.casefold()
    matched_programme = next(
        (
            item
            for item in programmes
            if _value(item, "name") and _value(item, "name").casefold() in text
        ),
        None,
    )
    result_by_id = {item["programme"]["id"]: item for item in records}

    if scenario_applied:
        changed = ", ".join(sorted(profile_changes or {}))
        answer = (
            f"What-if scenario for {academic_year or 'an unspecified academic year'} "
            f"(not saved). Updated fields: {changed or 'none'}."
        )
        if newly_eligible:
            names = [
                _title(result_by_id[item_id])
                for item_id in sorted(newly_eligible)
            ]
            answer += " Newly eligible under verified criteria: " + "; ".join(names) + "."
        else:
            answer += (
                " No additional programme can be confirmed eligible from these "
                "inputs and the available verified criteria."
            )
        if no_longer_eligible:
            current_by_id = {item["programme"]["id"]: item for item in current_records}
            names = [
                _title(current_by_id[item_id])
                for item_id in sorted(no_longer_eligible)
            ]
            answer += " No longer eligible: " + "; ".join(names) + "."
        if recommendations:
            answer += " Eligible options after the change: " + _recommendation_text(
                recommendations, scenario, academic_year
            )
        verified_fees = [
            item for item in records
            if item["affordability"]["annual_fee"] is not None
        ]
        if verified_fees:
            answer += " Verified fee comparison: " + "; ".join(
                f"{_title(item)}: ₹{item['affordability']['annual_fee']:,.0f} annual tuition, "
                f"{item['affordability']['status']}."
                for item in verified_fees[:3]
            )
        else:
            answer += (
                " Affordability remains unknown because no verified same-year fee "
                "is recorded."
            )
        if missing:
            answer += " Still missing from the simulated profile: " + ", ".join(missing) + "."
    elif any(term in text for term in ("what if", "what-if", "suppose", "scenario")):
        answer = (
            "I can evaluate a what-if scenario without saving it. Enter revised marks, "
            "subjects, entrance scores, location, budget, or profile facts in the "
            "optional scenario inputs, then ask again."
        )
    elif matched_programme and any(
        term in text for term in ("alternative", "alternatives", "instead")
    ):
        alternatives = [
            item for item in recommendations
            if item["programme"]["id"] != _value(matched_programme, "id")
        ]
        answer = (
            "Alternative eligible options: " + _recommendation_text(alternatives)
            if alternatives
            else "No other programme can be confirmed eligible from the verified criteria currently available."
        )
    elif matched_programme:
        result = result_by_id[_value(matched_programme, "id")]
        answer = (
            f"{_title(result)}: {result['status']} for "
            f"{academic_year or 'the unspecified academic year'}."
        )
        if result["satisfied"]:
            answer += " Satisfied conditions: " + "; ".join(result["satisfied"][:4]) + "."
        if result["unsatisfied"]:
            answer += " Unsatisfied verified conditions: " + "; ".join(result["unsatisfied"][:4]) + "."
        if result["missing"]:
            answer += " Unknown or missing information: " + "; ".join(result["missing"][:4]) + "."
        affordability = result["affordability"]
        if affordability["annual_fee"] is not None:
            answer += (
                f" Verified annual tuition for {affordability['academic_year']}: "
                f"₹{affordability['annual_fee']:,.0f}; affordability is "
                f"{affordability['status']}."
            )
        else:
            answer += " Affordability is unknown because no verified same-year fee is recorded."
        if result["programme"].get("source_url"):
            source_title = result["programme"].get("source_title")
            source = source_title or result["programme"]["source_url"]
            answer += f" Catalogue source: {source} ({result['programme']['source_url']})."
        recommendation = recommendation_by_id.get(_value(matched_programme, "id"))
        if recommendation:
            reasons = recommendation_reasons(
                scenario, recommendation["programme"], academic_year
            )
            if reasons:
                answer += " Profile match: " + "; ".join(reasons) + "."
    elif any(term in text for term in ("career", "pathway", "job", "profession")):
        skill_terms = {
            value.casefold()
            for value in (scenario.get("skills") or []) + (scenario.get("interests") or [])
        }
        custom_profile = scenario.get("profile") or {}
        goals = custom_profile.get("career_goals", custom_profile.get("career_goal", []))
        if isinstance(goals, str):
            goals = [goals]
        if not isinstance(goals, list):
            goals = []
        goal_terms = {goal.casefold() for goal in goals if isinstance(goal, str)}
        available_careers = [
            career
            for career in careers
            if career_is_verified(career) or _value(career, "illustrative") is True
        ]
        available_careers.sort(
            key=lambda career: sum(
                skill.casefold() in skill_terms
                for skill in (_value(career, "technical_skills") or [])
                + (_value(career, "soft_skills") or [])
            )
            + sum(
                goal in f"{_value(career, 'name', '')} {_value(career, 'description', '')}".casefold()
                for goal in goal_terms
            ),
            reverse=True,
        )
        if available_careers:
            entries = []
            for career in available_careers[:3]:
                skills = (_value(career, "technical_skills") or []) + (
                    _value(career, "soft_skills") or []
                )
                matches = [skill for skill in skills if skill.casefold() in skill_terms]
                detail = f"matching skills: {', '.join(matches)}" if matches else "no matching saved skills yet"
                matched_goals = [
                    goal for goal in goal_terms
                    if goal in f"{_value(career, 'name', '')} {_value(career, 'description', '')}".casefold()
                ]
                if matched_goals:
                    detail += f"; relates to saved career goal: {', '.join(sorted(matched_goals))}"
                if _value(career, "source_url"):
                    detail += (
                        f"; source ({_value(career, 'academic_year')}): "
                        f"{_value(career, 'source_url')}"
                    )
                if _value(career, "illustrative") is True:
                    detail = "illustrative, locally maintained pathway; " + detail
                entries.append(f"{_value(career, 'name')} - {detail}.")
            answer = "Career pathways to explore: " + " ".join(entries)
            if any(_value(career, "illustrative") is True for career in available_careers):
                answer += " Illustrative pathways are not job guarantees or verified labour-market claims."
        else:
            answer = (
                "No source-verified career pathways are currently available in the "
                "catalogue. I won't infer career requirements or outcomes."
            )
    elif any(term in text for term in ("afford", "fee", "fees", "cost", "budget")):
        fee_records = [
            item for item in records
            if fee_is_verified(item["programme"], academic_year)
        ]
        fee_lines = []
        for item in fee_records[:4]:
            fee = item["affordability"]["annual_fee"]
            if fee is not None:
                fee_lines.append(
                    f"{_title(item)}: ₹{fee:,.0f} annual tuition for "
                    f"{item['affordability']['academic_year']} "
                    f"({item['affordability']['status']})."
                )
        if fee_lines:
            answer = "Verified same-year fee information: " + " ".join(fee_lines)
            if scenario.get("annual_budget") is None:
                answer += " Add an annual budget to assess affordability."
        else:
            answer = (
                f"Affordability is unknown for {academic_year or 'the selected year'}: "
                "there is no verified same-year tuition record to compare with your budget."
            )
        if scenario.get("annual_budget") is None and "annual budget" not in missing:
            missing.append("annual budget")
    elif any(term in text for term in ("eligib", "qualify", "requirement", "admission criteria")):
        counts = {}
        for item in records:
            counts[item["status"]] = counts.get(item["status"], 0) + 1
        summary = ", ".join(
            f"{count} {status.lower()}" for status, count in sorted(counts.items())
        )
        answer = (
            f"For {academic_year or 'the unspecified academic year'}, the eligibility "
            f"engine reports {summary or 'no programme records'}. Unknown or unverified "
            "criteria are not treated as satisfied."
        )
        if missing:
            answer += " Your profile is missing: " + ", ".join(missing) + "."
        if recommendations:
            answer += " Verified eligible options: " + "; ".join(
                _title(item) for item in recommendations[:3]
            ) + "."
    elif any(term in text for term in ("recommend", "suitable", "alternative", "options", "courses", "programmes", "programs", "colleges")):
        candidates = recommendations
        if candidates:
            answer = (
                f"Based on your profile and verified {academic_year or 'current-year'} "
                "criteria, eligible options are: "
                + _recommendation_text(candidates, scenario, academic_year)
            )
        else:
            pending_count = sum(
                not programme_is_verified(programme, academic_year)
                for programme in programmes
            )
            answer = (
                f"I can't confirm a suitable eligible programme for "
                f"{academic_year or 'an unspecified academic year'}. Only complete, "
                "verified criteria can establish eligibility; this is not an admission "
                "probability."
            )
            if pending_count:
                answer += (
                    f" {pending_count} catalogue programme record(s) lack complete "
                    "verified criteria for this year and were not recommended."
                )
            if missing:
                answer += " Your profile is missing: " + ", ".join(missing) + "."
    elif any(term in text for term in ("apply", "application", "deadline", "counselling", "counseling", "admission process")):
        routes = [
            programme
            for programme in programmes
            if programme_is_verified(programme, academic_year) and programme.admission_route
        ]
        if routes:
            answer = "Verified admission routes: " + "; ".join(
                f"{programme.name}: {programme.admission_route}"
                for programme in routes[:4]
            ) + "."
        else:
            answer = (
                f"No current admission route or deadline is verified for "
                f"{academic_year or 'the selected year'}. Check the official source "
                "for the specific programme; I won't infer dates or procedures."
            )
    else:
        answer = (
            "I can help with verified eligibility, programme fit, affordability, "
            "career pathways, admissions information, or what-if scenarios. "
            "This is a rule-based demo that uses your saved profile and catalogue records."
        )
        if recommendations:
            answer += " " + _recommendation_text(recommendations)
        if missing:
            answer += " Missing profile information: " + ", ".join(missing) + "."

    return {
        "answer": answer,
        "recommendations": recommendations,
        "missing": missing,
        "scenario": scenario_applied,
        "engine": "rule-based-demo",
        "source": "application catalogue and deterministic eligibility engine",
    }
