"""Typed, immutable capability rule definitions."""

from dataclasses import asdict, dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class CapabilityRule:
    rule_id: str
    rule_type: str
    version: str
    priority: int
    pass_threshold: float
    review_threshold: float

    def to_dict(self, actual: float, status: str) -> Dict[str, Any]:
        payload = asdict(self)
        payload.update({"metric": "cpk", "actual": actual, "status": status})
        return payload
