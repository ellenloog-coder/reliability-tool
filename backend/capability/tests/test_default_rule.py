import pytest

from backend.capability.rules.default_rule import evaluate_default_rule


@pytest.mark.parametrize(
    ("cpk", "expected_status", "expected_reason"),
    [
        (1.33, "PASS", "CPK_MEETS_DEFAULT_REQUIREMENT"),
        (1.329, "REVIEW", "CPK_REQUIRES_REVIEW"),
        (1.0, "REVIEW", "CPK_REQUIRES_REVIEW"),
        (0.999, "FAIL", "CPK_BELOW_MINIMUM_REQUIREMENT"),
        (None, "REVIEW", "CAPABILITY_METRIC_UNAVAILABLE"),
    ],
)
def test_default_rule_boundaries(cpk, expected_status, expected_reason):
    decision = evaluate_default_rule(cpk)

    assert decision.status == expected_status
    assert decision.reason_codes == [expected_reason]
    assert decision.rule_set == "default"
    assert decision.rule_version == "2.0.0"
    assert isinstance(decision.matched_rules, list)
