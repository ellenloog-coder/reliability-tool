"""Critical-characteristic capability rule."""

from .rule_priority import CRITICAL_PRIORITY
from .rule_schema import CapabilityRule

CRITICAL_RULE = CapabilityRule(
    rule_id="critical-characteristic-cpk",
    rule_type="critical_characteristic",
    version="critical-1.0.0",
    priority=CRITICAL_PRIORITY,
    pass_threshold=1.67,
    review_threshold=1.33,
)
