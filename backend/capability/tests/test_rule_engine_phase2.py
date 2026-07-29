from backend.capability.rules.rule_engine import evaluate_capability_rules
from backend.capability.engine.capability_engine import analyze_capability
from backend.capability.schemas.models import (
    CapabilityInput,
    CustomerRuleConfig,
    RuleContext,
    Specification,
)


def customer(
    minimum_cpk=1.50,
    review_minimum_cpk=1.20,
    version="customer-a-2026.1",
):
    return CustomerRuleConfig(
        rule_id="customer-a-cpk",
        minimum_cpk=minimum_cpk,
        review_minimum_cpk=review_minimum_cpk,
        version=version,
    )


def assert_decision_contract(decision):
    payload = {
        "status": decision.status,
        "rule_version": decision.rule_version,
        "matched_rules": decision.matched_rules,
        "reason_codes": decision.reason_codes,
    }
    assert payload["status"] in {"PASS", "FAIL", "REVIEW"}
    assert payload["rule_version"]
    assert isinstance(payload["matched_rules"], list)
    assert isinstance(payload["reason_codes"], list)
    assert payload["reason_codes"]


def test_customer_rule_overrides_default_rule_by_priority():
    decision = evaluate_capability_rules(
        1.40, RuleContext(customer_rule=customer(minimum_cpk=1.50))
    )

    assert decision.status == "REVIEW"
    assert decision.rule_set == "customer"
    assert [rule["rule_id"] for rule in decision.matched_rules] == ["customer-a-cpk"]
    assert decision.matched_rules[0]["priority"] == 300
    assert_decision_contract(decision)


def test_critical_characteristic_uses_higher_threshold():
    review = evaluate_capability_rules(
        1.50, RuleContext(critical_characteristic=True)
    )
    passed = evaluate_capability_rules(
        1.67, RuleContext(critical_characteristic=True)
    )
    failed = evaluate_capability_rules(
        1.32, RuleContext(critical_characteristic=True)
    )

    assert review.status == "REVIEW"
    assert passed.status == "PASS"
    assert failed.status == "FAIL"
    assert review.matched_rules[0]["pass_threshold"] == 1.67
    assert review.matched_rules[0]["version"] == "critical-1.0.0"


def test_less_strict_customer_rule_conflicts_with_critical_rule():
    decision = evaluate_capability_rules(
        1.80,
        RuleContext(
            customer_rule=customer(minimum_cpk=1.33, review_minimum_cpk=1.00),
            critical_characteristic=True,
        ),
    )

    assert decision.status == "REVIEW"
    assert decision.rule_set == "conflict"
    assert decision.reason_codes == ["CUSTOMER_CRITICAL_RULE_CONFLICT"]
    assert {rule["rule_type"] for rule in decision.matched_rules} == {
        "customer",
        "critical_characteristic",
    }
    assert_decision_contract(decision)


def test_stricter_customer_rule_resolves_by_customer_priority():
    decision = evaluate_capability_rules(
        1.75,
        RuleContext(
            customer_rule=customer(minimum_cpk=1.80, review_minimum_cpk=1.67),
            critical_characteristic=True,
        ),
    )

    assert decision.status == "REVIEW"
    assert decision.rule_set == "customer"
    assert len(decision.matched_rules) == 2
    assert_decision_contract(decision)


def test_missing_rule_context_uses_versioned_default():
    decision = evaluate_capability_rules(1.40)

    assert decision.status == "PASS"
    assert decision.rule_set == "default"
    assert decision.matched_rules[0]["rule_id"] == "default-cpk"
    assert_decision_contract(decision)


def test_rule_version_regression():
    decision = evaluate_capability_rules(
        1.70,
        RuleContext(customer_rule=customer(version="customer-a-2026.1")),
    )

    assert decision.rule_version == "2.0.0"
    assert decision.matched_rules[0]["version"] == "customer-a-2026.1"
    assert_decision_contract(decision)


def test_invalid_customer_rule_context_returns_review():
    decision = evaluate_capability_rules(
        1.80,
        RuleContext(customer_rule=customer(
            minimum_cpk=1.20,
            review_minimum_cpk=1.30,
        )),
    )

    assert decision.status == "REVIEW"
    assert decision.reason_codes == ["INVALID_CUSTOMER_RULE_CONTEXT"]
    assert_decision_contract(decision)


def test_invalid_analysis_decision_keeps_required_contract():
    result = analyze_capability(
        CapabilityInput([], Specification(9.5, 10.5, 10.0), "mm")
    )

    assert result.status == "INVALID_INPUT"
    assert_decision_contract(result.decision)
