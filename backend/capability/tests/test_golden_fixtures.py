import json
import math
from pathlib import Path

import pytest

from backend.capability.engine.capability_engine import analyze_capability
from backend.capability.schemas.models import CapabilityInput

FIXTURE_DIR = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize(
    "fixture_name",
    [
        "normal-case.json",
        "shifted-mean-case.json",
        "low-capability-case.json",
        "invalid-data-case.json",
    ],
)
def test_golden_fixture(fixture_name):
    fixture = json.loads((FIXTURE_DIR / fixture_name).read_text(encoding="utf-8"))
    result = analyze_capability(CapabilityInput.from_dict(fixture["input"]))
    expected = fixture["expected"]

    assert result.status == expected["status"]
    assert result.decision.status == expected["decision"]
    if result.metrics is None:
        assert result.validation.status == expected["validation_status"]
        assert set(expected["error_codes"]).issubset(
            {error.code for error in result.validation.errors}
        )
        return

    for metric in ("mean", "standard_deviation", "cp", "cpk", "ppm_total"):
        assert math.isclose(
            getattr(result.metrics, metric),
            expected[metric],
            rel_tol=1e-9,
            abs_tol=1e-12,
        )
    if "pp" in expected:
        assert math.isclose(result.metrics.pp, expected["pp"], rel_tol=1e-9)
        assert math.isclose(result.metrics.ppk, expected["ppk"], rel_tol=1e-9)
