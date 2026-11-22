from datetime import date
from copy import deepcopy


def get_fact(facts, path):
    value = facts
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def compare(actual, operator, expected):
    if actual is None:
        return False
    try:
        if operator == "gte": return actual >= expected
        if operator == "lte": return actual <= expected
        if operator == "gt": return actual > expected
        if operator == "lt": return actual < expected
        if operator == "eq": return actual == expected
        if operator == "neq": return actual != expected
        if operator == "in": return actual in expected
        if operator == "contains": return expected in actual
        if operator == "contains_all": return set(expected).issubset(set(actual))
    except (TypeError, AttributeError):
        return False
    return False


def evaluate_condition(condition, facts):
    if "all" in condition:
        return all(evaluate_condition(item, facts) for item in condition["all"])
    if "any" in condition:
        return any(evaluate_condition(item, facts) for item in condition["any"])
    if "not" in condition:
        return not evaluate_condition(condition["not"], facts)
    actual = get_fact(facts, condition["fact"])
    return compare(actual, condition.get("operator", "eq"), condition.get("value"))


class RuleEngine:
    def __init__(self, rules=None):
        self.rules = deepcopy(rules or [])

    def validate_rule(self, rule):
        required = {"id", "name", "conditions", "result"}
        missing = required - set(rule)
        if missing:
            raise ValueError(f"Missing rule fields: {sorted(missing)}")
        if not isinstance(rule["conditions"], dict):
            raise ValueError("Conditions must be a structured object")

    def active_rules(self, today=None):
        today = today or date.today()
        active = []
        for rule in self.rules:
            if rule.get("active", True) is False:
                continue
            effective = rule.get("effective_date")
            expiry = rule.get("expiry_date")
            if effective and date.fromisoformat(str(effective)) > today:
                continue
            if expiry and date.fromisoformat(str(expiry)) < today:
                continue
            active.append(rule)
        return active

    def forward_chain(self, facts):
        derived = deepcopy(facts)
        trace = []
        changed = True
        while changed:
            changed = False
            for rule in sorted(self.active_rules(), key=lambda r: (-r.get("priority", 100), r["id"])):
                if evaluate_condition(rule["conditions"], derived):
                    fact_name = rule["result"].get("fact")
                    value = rule["result"].get("value")
                    if fact_name and get_fact(derived, fact_name) != value:
                        parts = fact_name.split(".")
                        target = derived
                        for part in parts[:-1]:
                            target = target.setdefault(part, {})
                        target[parts[-1]] = value
                        trace.append({"rule_id": rule["id"], "rule_name": rule["name"], "result": {fact_name: value}})
                        changed = True
        return derived, trace

    def backward_chain(self, goal, facts):
        candidates = [r for r in self.active_rules() if r["result"].get("fact") == goal["fact"] and r["result"].get("value") == goal["value"]]
        if not candidates:
            return {"goal": goal, "achieved": False, "reason": "No matching rule", "steps": []}
        candidates.sort(key=lambda r: (-r.get("priority", 100), -len(str(r["conditions"])), r["id"]))
        selected = candidates[0]
        conditions_met = evaluate_condition(selected["conditions"], facts)
        return {
            "goal": goal,
            "achieved": conditions_met,
            "selected_rule": selected["id"],
            "rule_name": selected["name"],
            "steps": [{"rule_id": selected["id"], "conditions": selected["conditions"], "conditions_met": conditions_met}],
        }

