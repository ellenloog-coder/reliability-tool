"""Capability Rule Engine Phase 2."""

import math
from typing import List, Optional, Tuple

from ..schemas.models import DecisionResult, RuleContext
from .critical_rule import CRITICAL_RULE
from .customer_rule import customer_rule
from .default_rule import DEFAULT_RULE, RULE_ENGINE_VERSION
from .rule_priority import highest_priority
from .rule_schema import CapabilityRule


def _rule_status(cpk: float, rule: CapabilityRule) -> Tuple[str, str]:
    if cpk >= rule.pass_threshold:
        return "PASS", "CPK_MEETS_RULE_REQUIREMENT"
    if cpk >= rule.review_threshold:
        return "REVIEW", "CPK_REQUIRES_REVIEW"
    return "FAIL", "CPK_BELOW_RULE_MINIMUM"


def _invalid_customer_rule(rule: CapabilityRule) -> bool:
    thresholds = (rule.pass_threshold, rule.review_threshold)
    return (
        not all(
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            for value in thresholds
        )
        or rule.review_threshold < 0
        or rule.pass_threshold <= rule.review_threshold
        or not rule.rule_id.strip()
        or not rule.version.strip()
    )


def evaluate_capability_rules(
    cpk: Optional[float],
    context: Optional[RuleContext] = None,
) -> DecisionResult:
    context = context or RuleContext()
    rules: List[CapabilityRule] = [DEFAULT_RULE]
    customer = customer_rule(context.customer_rule) if context.customer_rule else None
    if context.critical_characteristic:
        rules.append(CRITICAL_RULE)
    if customer:
        rules.append(customer)

    if cpk is None or not isinstance(cpk, (int, float)) or not math.isfinite(cpk):
        return DecisionResult(
            status="REVIEW",
            rule_set="none",
            rule_version=RULE_ENGINE_VERSION,
            matched_rules=[],
            reason_codes=["CAPABILITY_METRIC_UNAVAILABLE"],
            threshold=None,
            actual=None,
        )

    if customer and _invalid_customer_rule(customer):
        return DecisionResult(
            status="REVIEW",
            rule_set="customer",
            rule_version=RULE_ENGINE_VERSION,
            matched_rules=[customer.to_dict(cpk, "REVIEW")],
            reason_codes=["INVALID_CUSTOMER_RULE_CONTEXT"],
            threshold=None,
            actual=cpk,
        )

    applicable = [rule for rule in rules if rule is not DEFAULT_RULE] or [DEFAULT_RULE]
    evaluated = []
    for rule in applicable:
        status, _ = _rule_status(cpk, rule)
        evaluated.append(rule.to_dict(cpk, status))

    # A customer rule that relaxes a critical-characteristic requirement is
    # an explicit governance conflict; priority must not silently weaken it.
    if customer and context.critical_characteristic and (
        customer.pass_threshold < CRITICAL_RULE.pass_threshold
        or customer.review_threshold < CRITICAL_RULE.review_threshold
    ):
        return DecisionResult(
            status="REVIEW",
            rule_set="conflict",
            rule_version=RULE_ENGINE_VERSION,
            matched_rules=evaluated,
            reason_codes=["CUSTOMER_CRITICAL_RULE_CONFLICT"],
            threshold=None,
            actual=cpk,
        )

    selected = highest_priority(applicable)
    status, reason = _rule_status(cpk, selected)
    reason_prefix = selected.rule_type.upper()
    return DecisionResult(
        status=status,
        rule_set=selected.rule_type,
        rule_version=RULE_ENGINE_VERSION,
        matched_rules=evaluated,
        reason_codes=[f"{reason_prefix}_{reason}"],
        threshold=selected.pass_threshold if status != "FAIL" else selected.review_threshold,
        actual=cpk,
    )
