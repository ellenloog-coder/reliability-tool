"""Validation rules for capability inputs."""

import math
from typing import Any, List

from ..schemas.models import CapabilityInput, ValidationIssue, ValidationResult


def _finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_capability_input(value: CapabilityInput) -> ValidationResult:
    errors: List[ValidationIssue] = []
    warnings: List[ValidationIssue] = []
    data = value.measurement_data
    spec = value.specification

    if not isinstance(data, list) or not data:
        errors.append(ValidationIssue(
            "EMPTY_MEASUREMENT_DATA", "measurement_data",
            "Measurement data must be a non-empty list.",
        ))
    elif any(not _finite_number(item) for item in data):
        errors.append(ValidationIssue(
            "INVALID_MEASUREMENT_VALUE", "measurement_data",
            "Every measurement must be a finite numeric value.",
        ))
    elif len(data) < 2:
        errors.append(ValidationIssue(
            "INSUFFICIENT_SAMPLE_SIZE", "measurement_data",
            "At least two measurements are required.",
        ))
    else:
        if max(data) == min(data):
            errors.append(ValidationIssue(
                "CONSTANT_DATA", "measurement_data",
                "Capability cannot be estimated from constant data.",
            ))
        if len(data) < 30:
            warnings.append(ValidationIssue(
                "SMALL_SAMPLE_SIZE", "measurement_data",
                "Fewer than 30 measurements may produce an unstable capability estimate.",
            ))

    if spec.lsl is None and spec.usl is None:
        errors.append(ValidationIssue(
            "MISSING_SPECIFICATION", "specification",
            "At least one specification limit is required.",
        ))
    for field_name, field_value in (
        ("specification.lsl", spec.lsl),
        ("specification.usl", spec.usl),
        ("specification.target", spec.target),
    ):
        if field_value is not None and not _finite_number(field_value):
            errors.append(ValidationIssue(
                "INVALID_SPECIFICATION_VALUE", field_name,
                "Specification values must be finite numbers.",
            ))

    if _finite_number(spec.lsl) and _finite_number(spec.usl) and spec.lsl >= spec.usl:
        errors.append(ValidationIssue(
            "INVALID_SPECIFICATION_RANGE", "specification",
            "LSL must be less than USL.",
        ))
    if (spec.lsl is None) != (spec.usl is None):
        warnings.append(ValidationIssue(
            "ONE_SIDED_SPECIFICATION", "specification",
            "Only one specification limit was supplied; two-sided indices are unavailable.",
        ))
    if spec.target is None:
        warnings.append(ValidationIssue(
            "TARGET_NOT_PROVIDED", "specification.target",
            "No target was supplied; target-centered interpretation is unavailable.",
        ))
    if not isinstance(value.unit, str) or not value.unit.strip():
        errors.append(ValidationIssue(
            "MISSING_UNIT", "unit", "A non-empty measurement unit is required.",
        ))

    warnings.append(ValidationIssue(
        "OVERALL_VARIATION_PROXY", "measurement_data",
        "MVP Pp/Ppk use sample standard deviation because subgroup data are not available.",
    ))
    status = "INVALID" if errors else ("VALID_WITH_WARNINGS" if warnings else "VALID")
    return ValidationResult(status=status, errors=errors, warnings=warnings)
