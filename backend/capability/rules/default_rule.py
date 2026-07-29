"""Versioned default Cpk rule and backward-compatible evaluator."""

from typing import Optional

from ..schemas.models import DecisionResult
from .rule_priority import DEFAULT_PRIORITY
from .rule_schema import CapabilityRule

RULE_SET = "default"
RULE_VERSION = "default-1.0.0"
RULE_ENGINE_VERSION = "2.0.0"
PASS_THRESHOLD = 1.33
REVIEW_THRESHOLD = 1.00
DEFAULT_RULE = CapabilityRule(
    rule_id="default-cpk",
    rule_type=RULE_SET,
    version=RULE_VERSION,
    priority=DEFAULT_PRIORITY,
    pass_threshold=PASS_THRESHOLD,
    review_threshold=REVIEW_THRESHOLD,
)


def evaluate_default_rule(cpk: Optional[float]) -> DecisionResult:
    if cpk is None:
        return DecisionResult(
            status="REVIEW",
            rule_set=RULE_SET,
            rule_version=RULE_ENGINE_VERSION,
            matched_rules=[],
            reason_codes=["CAPABILITY_METRIC_UNAVAILABLE"],
            threshold=None,
            actual=None,
        )
    if cpk >= PASS_THRESHOLD:
        status, threshold, reason = "PASS", PASS_THRESHOLD, "CPK_MEETS_DEFAULT_REQUIREMENT"
    elif cpk >= REVIEW_THRESHOLD:
        status, threshold, reason = "REVIEW", PASS_THRESHOLD, "CPK_REQUIRES_REVIEW"
    else:
        status, threshold, reason = "FAIL", REVIEW_THRESHOLD, "CPK_BELOW_MINIMUM_REQUIREMENT"
    return DecisionResult(
        status=status,
        rule_set=RULE_SET,
        rule_version=RULE_ENGINE_VERSION,
        matched_rules=[DEFAULT_RULE.to_dict(cpk, status)],
        reason_codes=[reason],
        threshold=threshold,
        actual=cpk,
    )
