import math

from backend.capability.engine.capability_engine import analyze_capability
from backend.capability.schemas.models import CapabilityInput, Specification


def capability_input(data, lsl=9.5, usl=10.5, target=10.0, unit="mm"):
    return CapabilityInput(data, Specification(lsl, usl, target), unit)


def test_centered_process_calculates_mean_standard_deviation_and_indices():
    result = analyze_capability(capability_input([9.9, 10.0, 10.1, 10.0, 10.0]))

    assert result.status == "COMPLETED"
    assert result.metrics is not None
    assert result.metrics.mean == 10.0
    assert math.isclose(result.metrics.standard_deviation, 0.0707106781186545)
    assert math.isclose(result.metrics.cp, 2.357022603955167)
    assert math.isclose(result.metrics.cpk, 2.357022603955167)
    assert result.metrics.pp == result.metrics.cp
    assert result.metrics.ppk == result.metrics.cpk
    assert result.decision.status == "PASS"


def test_shifted_mean_reduces_cpk_without_changing_spread_formula():
    result = analyze_capability(capability_input([10.2, 10.25, 10.3, 10.35, 10.4]))

    assert result.metrics is not None
    assert result.metrics.cp > result.metrics.cpk
    assert math.isclose(result.metrics.cpk, result.metrics.cpu)
    assert result.metrics.ppm_above_usl > result.metrics.ppm_below_lsl
    assert result.decision.status == "FAIL"


def test_one_sided_specification_returns_available_indices_only():
    result = analyze_capability(capability_input(
        [9.8, 9.9, 10.0, 10.1, 10.2], lsl=None, usl=10.5
    ))

    assert result.status == "COMPLETED"
    assert result.metrics.cp is None
    assert result.metrics.cpl is None
    assert result.metrics.cpk == result.metrics.cpu
    assert result.metrics.ppm_below_lsl is None
    assert "ONE_SIDED_SPECIFICATION" in {
        warning.code for warning in result.validation.warnings
    }


def test_result_is_structured_and_versioned():
    result = analyze_capability(capability_input([9.9, 10.0, 10.1]))
    payload = result.to_dict()

    assert payload["engine"] == {"name": "capability", "version": "mvp-1.0"}
    assert payload["decision"]["rule_version"] == "2.0.0"
    assert payload["decision"]["matched_rules"]
    assert payload["metrics"]["variation_method"]["pp_ppk"] == "sample_standard_deviation_proxy"
