import math

import pytest

from backend.capability.engine.capability_engine import analyze_capability
from backend.capability.schemas.models import CapabilityInput, Specification
from backend.capability.validation.capability_validation import validate_capability_input


@pytest.mark.parametrize(
    ("value", "expected_code"),
    [
        (CapabilityInput([], Specification(0, 1), "mm"), "EMPTY_MEASUREMENT_DATA"),
        (CapabilityInput([1.0], Specification(0, 1), "mm"), "INSUFFICIENT_SAMPLE_SIZE"),
        (CapabilityInput([1.0, math.nan], Specification(0, 2), "mm"), "INVALID_MEASUREMENT_VALUE"),
        (CapabilityInput([1.0, math.inf], Specification(0, 2), "mm"), "INVALID_MEASUREMENT_VALUE"),
        (CapabilityInput([1.0, 1.0], Specification(0, 2), "mm"), "CONSTANT_DATA"),
        (CapabilityInput([1.0, 2.0], Specification(), "mm"), "MISSING_SPECIFICATION"),
        (CapabilityInput([1.0, 2.0], Specification(2, 1), "mm"), "INVALID_SPECIFICATION_RANGE"),
        (CapabilityInput([1.0, 2.0], Specification(0, 3), ""), "MISSING_UNIT"),
    ],
)
def test_invalid_inputs_return_stable_error_codes(value, expected_code):
    validation = validate_capability_input(value)

    assert validation.status == "INVALID"
    assert expected_code in {error.code for error in validation.errors}


def test_invalid_analysis_does_not_emit_metrics_or_non_finite_values():
    result = analyze_capability(CapabilityInput(
        [5.0, 5.0, 5.0], Specification(0, 10, 5), "mm"
    ))

    assert result.metrics is None
    assert result.decision.status == "REVIEW"
    assert result.decision.reason_codes == ["INPUT_VALIDATION_FAILED"]
