"""Pure Python Process Capability Backend MVP."""

import math
import statistics
from typing import Any, Dict, Optional

from ..rules.default_rule import RULE_ENGINE_VERSION
from ..rules.rule_engine import evaluate_capability_rules
from ..schemas.models import (
    CapabilityAnalysis,
    CapabilityInput,
    CapabilityMetrics,
    DecisionResult,
)
from ..validation.capability_validation import validate_capability_input

ENGINE_NAME = "capability"
ENGINE_VERSION = "mvp-1.0"


def _normal_cdf(z_value: float) -> float:
    return 0.5 * (1.0 + math.erf(z_value / math.sqrt(2.0)))


def _ppm_below(limit: Optional[float], mean: float, deviation: float) -> Optional[float]:
    if limit is None:
        return None
    return _normal_cdf((limit - mean) / deviation) * 1_000_000.0


def _ppm_above(limit: Optional[float], mean: float, deviation: float) -> Optional[float]:
    if limit is None:
        return None
    return (1.0 - _normal_cdf((limit - mean) / deviation)) * 1_000_000.0


def _summary(value: CapabilityInput) -> Dict[str, Any]:
    return {
        "sample_size": len(value.measurement_data) if isinstance(value.measurement_data, list) else 0,
        "unit": value.unit,
        "lsl": value.specification.lsl,
        "usl": value.specification.usl,
        "target": value.specification.target,
    }


def analyze_capability(value: CapabilityInput) -> CapabilityAnalysis:
    validation = validate_capability_input(value)
    if not validation.is_valid:
        return CapabilityAnalysis(
            status="INVALID_INPUT",
            input_summary=_summary(value),
            metrics=None,
            validation=validation,
            decision=DecisionResult(
                status="REVIEW",
                rule_set="default",
                rule_version=RULE_ENGINE_VERSION,
                matched_rules=[],
                reason_codes=["INPUT_VALIDATION_FAILED"],
                threshold=None,
                actual=None,
            ),
            engine={"name": ENGINE_NAME, "version": ENGINE_VERSION},
        )

    data = [float(item) for item in value.measurement_data]
    mean = statistics.fmean(data)
    deviation = statistics.stdev(data)
    lsl, usl = value.specification.lsl, value.specification.usl

    cpu = (usl - mean) / (3.0 * deviation) if usl is not None else None
    cpl = (mean - lsl) / (3.0 * deviation) if lsl is not None else None
    cpk = min(metric for metric in (cpu, cpl) if metric is not None)
    cp = (usl - lsl) / (6.0 * deviation) if lsl is not None and usl is not None else None

    ppm_below = _ppm_below(lsl, mean, deviation)
    ppm_above = _ppm_above(usl, mean, deviation)
    ppm_total = (ppm_below or 0.0) + (ppm_above or 0.0)

    metrics = CapabilityMetrics(
        sample_size=len(data),
        mean=mean,
        standard_deviation=deviation,
        cp=cp,
        cpu=cpu,
        cpl=cpl,
        cpk=cpk,
        pp=cp,
        ppu=cpu,
        ppl=cpl,
        ppk=cpk,
        ppm_below_lsl=ppm_below,
        ppm_above_usl=ppm_above,
        ppm_total=ppm_total,
        variation_method={
            "cp_cpk": "sample_standard_deviation",
            "pp_ppk": "sample_standard_deviation_proxy",
        },
    )
    return CapabilityAnalysis(
        status="COMPLETED",
        input_summary=_summary(value),
        metrics=metrics,
        validation=validation,
        decision=evaluate_capability_rules(cpk, value.rule_context),
        engine={"name": ENGINE_NAME, "version": ENGINE_VERSION},
    )
