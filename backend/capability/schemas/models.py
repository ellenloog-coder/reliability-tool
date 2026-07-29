"""Dependency-free schemas for the Capability Backend MVP."""

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Specification:
    lsl: Optional[float] = None
    usl: Optional[float] = None
    target: Optional[float] = None


@dataclass(frozen=True)
class CustomerRuleConfig:
    rule_id: str
    minimum_cpk: float
    review_minimum_cpk: float = 1.00
    version: str = "customer-1.0"


@dataclass(frozen=True)
class RuleContext:
    customer_rule: Optional[CustomerRuleConfig] = None
    critical_characteristic: bool = False


@dataclass(frozen=True)
class CapabilityInput:
    measurement_data: List[float]
    specification: Specification
    unit: str
    rule_context: RuleContext = field(default_factory=RuleContext)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "CapabilityInput":
        specification = payload.get("specification") or {}
        rule_context = payload.get("rule_context") or {}
        customer_rule = rule_context.get("customer_rule")
        return cls(
            measurement_data=payload.get("measurement_data"),
            specification=Specification(
                lsl=specification.get("lsl"),
                usl=specification.get("usl"),
                target=specification.get("target"),
            ),
            unit=payload.get("unit"),
            rule_context=RuleContext(
                customer_rule=CustomerRuleConfig(
                    rule_id=customer_rule.get("rule_id", "customer-rule"),
                    minimum_cpk=customer_rule.get("minimum_cpk"),
                    review_minimum_cpk=customer_rule.get("review_minimum_cpk", 1.00),
                    version=customer_rule.get("version", "customer-1.0"),
                ) if isinstance(customer_rule, dict) else None,
                critical_characteristic=rule_context.get("critical_characteristic", False),
            ),
        )


@dataclass(frozen=True)
class CapabilityMetrics:
    sample_size: int
    mean: float
    standard_deviation: float
    cp: Optional[float]
    cpu: Optional[float]
    cpl: Optional[float]
    cpk: Optional[float]
    pp: Optional[float]
    ppu: Optional[float]
    ppl: Optional[float]
    ppk: Optional[float]
    ppm_below_lsl: Optional[float]
    ppm_above_usl: Optional[float]
    ppm_total: float
    variation_method: Dict[str, str]


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    field: str
    message: str


@dataclass(frozen=True)
class ValidationResult:
    status: str
    errors: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors


@dataclass(frozen=True)
class DecisionResult:
    status: str
    rule_set: str
    rule_version: str
    matched_rules: List[Dict[str, Any]]
    reason_codes: List[str]
    threshold: Optional[float]
    actual: Optional[float]


@dataclass(frozen=True)
class CapabilityAnalysis:
    status: str
    input_summary: Dict[str, Any]
    metrics: Optional[CapabilityMetrics]
    validation: ValidationResult
    decision: DecisionResult
    engine: Dict[str, str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
