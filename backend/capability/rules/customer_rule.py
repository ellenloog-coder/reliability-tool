"""Customer-specific capability rule construction."""

from ..schemas.models import CustomerRuleConfig
from .rule_priority import CUSTOMER_PRIORITY
from .rule_schema import CapabilityRule


def customer_rule(config: CustomerRuleConfig) -> CapabilityRule:
    return CapabilityRule(
        rule_id=config.rule_id,
        rule_type="customer",
        version=config.version,
        priority=CUSTOMER_PRIORITY,
        pass_threshold=config.minimum_cpk,
        review_threshold=config.review_minimum_cpk,
    )
