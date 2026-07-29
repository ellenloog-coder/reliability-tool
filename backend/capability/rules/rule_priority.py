"""Rule priority constants and deterministic selection."""

from typing import Iterable

from .rule_schema import CapabilityRule

DEFAULT_PRIORITY = 100
CRITICAL_PRIORITY = 200
CUSTOMER_PRIORITY = 300


def highest_priority(rules: Iterable[CapabilityRule]) -> CapabilityRule:
    return max(rules, key=lambda rule: (rule.priority, rule.rule_id))
