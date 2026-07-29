#!/usr/bin/env python3
"""Independent reference generator for Reliability Demonstration readiness.

This verification script is intentionally independent from production
JavaScript. SciPy is not required; the reference uses standard-library
probability recurrences plus bisection solvers.
"""

from __future__ import annotations

import csv
import argparse
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FIXTURE_DIR = ROOT / "fixtures"
BOOLEAN_TOLERANCE = 1e-10


def binom_cdf(k: int, n: int, p: float) -> float:
    k = math.floor(k)
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    if p == 0:
        return 1.0
    if p == 1:
        return 0.0
    if k + 1 <= n - k:
        term = math.exp(n * math.log1p(-p))
        total = term
        for i in range(k):
            term *= ((n - i) / (i + 1)) * (p / (1 - p))
            total += term
        return min(1.0, max(0.0, total))
    term = math.exp(n * math.log(p))
    upper = term
    for i in range(n, k + 1, -1):
        term *= (i / (n - i + 1)) * ((1 - p) / p)
        upper += term
    return min(1.0, max(0.0, 1 - upper))


def poisson_cdf(k: int, mean: float) -> float:
    k = math.floor(k)
    if k < 0:
        return 0.0
    if mean == 0:
        return 1.0
    term = math.exp(-mean)
    total = term
    for i in range(1, k + 1):
        term *= mean / i
        total += term
    if total > 0 and math.isfinite(total):
        return min(1.0, max(0.0, total))
    logs = [-mean + i * math.log(mean) - math.lgamma(i + 1) for i in range(k + 1)]
    m = max(logs)
    return math.exp(m + math.log(sum(math.exp(v - m) for v in logs)))


def bisect(fn, target: float, lower: float, upper: float, increasing: bool, tol: float = 1e-13) -> float:
    flo = fn(lower) - target
    fhi = fn(upper) - target
    if increasing:
        if not (flo <= 0 <= fhi):
            raise ValueError("root not bracketed")
    elif not (flo >= 0 >= fhi):
        raise ValueError("root not bracketed")
    for _ in range(240):
        mid = (lower + upper) / 2
        fmid = fn(mid) - target
        if abs(fmid) <= tol or abs(upper - lower) <= tol:
            return mid
        if increasing:
            if fmid < 0:
                lower = mid
            else:
                upper = mid
        else:
            if fmid > 0:
                lower = mid
            else:
                upper = mid
    raise ValueError("root did not converge")


def required_poisson_mean(c: int, confidence: float) -> float:
    target = 1 - confidence
    upper = max(1.0, -math.log(target) + c + 1)
    while poisson_cdf(c, upper) > target:
        upper *= 2
        if upper > 1e8:
            raise ValueError("unable to bracket poisson mean")
    return bisect(lambda value: poisson_cdf(c, value), target, 0.0, upper, increasing=False)


def binomial_plan(inputs: dict) -> dict:
    r = inputs["targetReliability"]
    cl = inputs["confidenceLevel"]
    c = inputs.get("allowableFailures", 0)
    max_sample_size = inputs.get("maxSampleSize", 1_000_000)
    n = c + 1
    while binom_cdf(c, n, 1 - r) > 1 - cl:
        n += 1
        if n > max_sample_size:
            raise ValueError("Unable to find a sample size within the current maximum limit.")
    prev = n - 1
    return {
        "requiredSampleSize": n,
        "targetReliability": r,
        "confidenceLevel": cl,
        "allowableFailures": c,
        "achievedConfidenceAtRequiredN": 1 - binom_cdf(c, n, 1 - r),
        "achievedConfidenceAtPreviousN": 0 if prev <= c else 1 - binom_cdf(c, prev, 1 - r),
        "minimalityVerified": prev <= c or binom_cdf(c, prev, 1 - r) > 1 - cl,
    }


def reliability_lower_bound(n: int, failures: int, confidence: float) -> float:
    successes = n - failures
    if successes == 0:
        return 0.0
    return bisect(lambda r: 1 - binom_cdf(failures, n, 1 - r), confidence, 0.0, 1.0, increasing=False)


def sample_gap(n: int, failures: int, target_reliability: float, confidence: float) -> dict:
    if reliability_lower_bound(n, failures, confidence) + BOOLEAN_TOLERANCE >= target_reliability:
        return {"additionalUnitsRequired": 0, "requiredTotalUnits": n}
    total = n + 1
    while reliability_lower_bound(total, failures, confidence) + BOOLEAN_TOLERANCE < target_reliability:
        total += 1
        if total > 1_000_000:
            raise ValueError("Unable to calculate additional units within the current maximum limit.")
    return {"additionalUnitsRequired": total - n, "requiredTotalUnits": total}


def binomial_evaluate(inputs: dict) -> dict:
    n = inputs["unitsTested"]
    d = inputs["observedFailures"]
    r = inputs["targetReliability"]
    cl = inputs["confidenceLevel"]
    lower = reliability_lower_bound(n, d, cl)
    achieved = 1 - binom_cdf(d, n, 1 - r)
    return {
        "unitsTested": n,
        "observedFailures": d,
        "observedSuccesses": n - d,
        "observedPassRate": (n - d) / n,
        "reliabilityLowerBound": lower,
        "targetReliability": r,
        "requiredConfidence": cl,
        "achievedConfidenceAtTarget": achieved,
        "demonstrated": lower + BOOLEAN_TOLERANCE >= r,
        "evidenceGap": sample_gap(n, d, r, cl),
    }


def target_to_mtbf(inputs: dict) -> dict:
    if inputs.get("targetDefinition") == "reliability":
        r = inputs["targetReliability"]
        mission = inputs["missionTime"]
        return {
            "targetDefinition": "reliability",
            "targetReliability": r,
            "missionTime": mission,
            "targetMTBF": -mission / math.log(r),
        }
    return {
        "targetDefinition": "mtbf",
        "targetReliability": None,
        "missionTime": inputs.get("missionTime"),
        "targetMTBF": inputs["targetMTBF"],
    }


def exponential_plan(inputs: dict) -> dict:
    target = target_to_mtbf(inputs)
    c = inputs.get("allowableFailures", 0)
    cl = inputs["confidenceLevel"]
    factor = required_poisson_mean(c, cl)
    total_time = factor * target["targetMTBF"]
    units = inputs.get("numberOfUnits")
    return {
        **target,
        "confidenceLevel": cl,
        "allowableFailures": c,
        "requiredExposureFactor": factor,
        "requiredTotalTestTime": total_time,
        "estimatedTimePerUnit": None if units in (None, "") else total_time / units,
        "achievedConfidence": 1 - poisson_cdf(c, factor),
        "chiSquareEquivalentQuantile": 2 * factor,
    }


def time_gap(total_time: float, failures: int, target_mtbf: float, confidence: float) -> dict:
    required = required_poisson_mean(failures, confidence) * target_mtbf
    return {
        "additionalTotalTestTimeRequired": max(0.0, required - total_time),
        "requiredTotalTestTime": required,
    }


def exponential_evaluate(inputs: dict) -> dict:
    target = target_to_mtbf(inputs)
    total_time = inputs["totalTestTime"]
    failures = inputs["observedFailures"]
    cl = inputs["confidenceLevel"]
    factor = required_poisson_mean(failures, cl)
    mtbf_lower = total_time / factor
    achieved = 1 - poisson_cdf(failures, total_time / target["targetMTBF"])
    reliability_lower = None
    if target.get("missionTime"):
        reliability_lower = math.exp(-target["missionTime"] / mtbf_lower)
    return {
        **target,
        "totalTestTime": total_time,
        "observedFailures": failures,
        "mtbfPointEstimate": None if failures == 0 else total_time / failures,
        "mtbfLowerBound": mtbf_lower,
        "requiredConfidence": cl,
        "achievedConfidenceAtTarget": achieved,
        "reliabilityLowerBoundAtMissionTime": reliability_lower,
        "demonstrated": mtbf_lower + max(BOOLEAN_TOLERANCE, abs(target["targetMTBF"]) * BOOLEAN_TOLERANCE) >= target["targetMTBF"],
        "pointEstimateNotEstimable": failures == 0,
        "evidenceGap": time_gap(total_time, failures, target["targetMTBF"], cl),
        "requiredExposureFactor": factor,
        "chiSquareEquivalentQuantile": 2 * factor,
    }


def fixture(fixture_id: str, method: str, workflow: str, inputs: dict, expected_status: str = "ok", warnings=None, reference_method="python-standard-library"):
    return {
        "fixtureId": fixture_id,
        "method": method,
        "workflow": workflow,
        "inputs": inputs,
        "expectedStatus": expected_status,
        "expectedWarnings": warnings or [],
        "referenceMethod": reference_method,
    }


FIXTURES = [
    fixture("sample_plan_r90_cl90_c0", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.90, "allowableFailures": 0, "missionTime": 100}),
    fixture("sample_plan_r90_cl95_c0", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.95, "allowableFailures": 0}),
    fixture("sample_plan_r95_cl90_c0", "sample", "plan", {"targetReliability": 0.95, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("sample_plan_r95_cl95_c0", "sample", "plan", {"targetReliability": 0.95, "confidenceLevel": 0.95, "allowableFailures": 0}),
    fixture("sample_plan_r99_cl90_c0", "sample", "plan", {"targetReliability": 0.99, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("sample_plan_r99_cl95_c0", "sample", "plan", {"targetReliability": 0.99, "confidenceLevel": 0.95, "allowableFailures": 0}),
    fixture("sample_plan_r90_cl90_c1", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.90, "allowableFailures": 1}),
    fixture("sample_plan_r90_cl90_c2", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.90, "allowableFailures": 2}),
    fixture("sample_plan_r95_cl95_c1", "sample", "plan", {"targetReliability": 0.95, "confidenceLevel": 0.95, "allowableFailures": 1}),
    fixture("sample_plan_r90_cl99_c0", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.99, "allowableFailures": 0}),
    fixture("sample_plan_r90_cl80_c0", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.80, "allowableFailures": 0}),
    fixture("sample_plan_r999_cl90_c0", "sample", "plan", {"targetReliability": 0.999, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("sample_plan_r70_cl90_c0", "sample", "plan", {"targetReliability": 0.70, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("sample_plan_r90_cl90_c5", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.90, "allowableFailures": 5}),
    fixture("sample_plan_max_guard", "sample", "plan", {"targetReliability": 0.99999, "confidenceLevel": 0.999, "allowableFailures": 0, "maxSampleSize": 100}, "error"),
    fixture("sample_plan_invalid_reliability", "sample", "plan", {"targetReliability": 1.0, "confidenceLevel": 0.90, "allowableFailures": 0}, "error"),
    fixture("sample_plan_invalid_confidence", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 1.0, "allowableFailures": 0}, "error"),
    fixture("sample_plan_invalid_allowable_failures", "sample", "plan", {"targetReliability": 0.90, "confidenceLevel": 0.90, "allowableFailures": 1.5}, "error"),
    fixture("sample_eval_n22_d0", "sample", "evaluate", {"unitsTested": 22, "observedFailures": 0, "targetReliability": 0.90, "confidenceLevel": 0.90}),
    fixture("sample_eval_n29_d0", "sample", "evaluate", {"unitsTested": 29, "observedFailures": 0, "targetReliability": 0.90, "confidenceLevel": 0.95}),
    fixture("sample_eval_n100_d0", "sample", "evaluate", {"unitsTested": 100, "observedFailures": 0, "targetReliability": 0.95, "confidenceLevel": 0.90}),
    fixture("sample_eval_n100_d1", "sample", "evaluate", {"unitsTested": 100, "observedFailures": 1, "targetReliability": 0.95, "confidenceLevel": 0.90}),
    fixture("sample_eval_n100_d5", "sample", "evaluate", {"unitsTested": 100, "observedFailures": 5, "targetReliability": 0.90, "confidenceLevel": 0.90}),
    fixture("sample_eval_all_failed", "sample", "evaluate", {"unitsTested": 10, "observedFailures": 10, "targetReliability": 0.90, "confidenceLevel": 0.90}),
    fixture("sample_eval_n1_d0", "sample", "evaluate", {"unitsTested": 1, "observedFailures": 0, "targetReliability": 0.10, "confidenceLevel": 0.90}),
    fixture("sample_eval_target_equals_lower", "sample", "evaluate", {"unitsTested": 22, "observedFailures": 0, "targetReliability": math.exp(math.log(0.1) / 22), "confidenceLevel": 0.90}),
    fixture("sample_eval_target_below_lower", "sample", "evaluate", {"unitsTested": 22, "observedFailures": 0, "targetReliability": 0.899, "confidenceLevel": 0.90}),
    fixture("sample_eval_target_above_lower", "sample", "evaluate", {"unitsTested": 22, "observedFailures": 0, "targetReliability": 0.902, "confidenceLevel": 0.90}),
    fixture("sample_eval_gap_zero", "sample", "evaluate", {"unitsTested": 30, "observedFailures": 0, "targetReliability": 0.90, "confidenceLevel": 0.90}),
    fixture("sample_eval_gap_positive", "sample", "evaluate", {"unitsTested": 10, "observedFailures": 0, "targetReliability": 0.90, "confidenceLevel": 0.90}),
    fixture("sample_eval_failures_gt_units", "sample", "evaluate", {"unitsTested": 5, "observedFailures": 6, "targetReliability": 0.90, "confidenceLevel": 0.90}, "error"),
    fixture("sample_eval_units_zero", "sample", "evaluate", {"unitsTested": 0, "observedFailures": 0, "targetReliability": 0.90, "confidenceLevel": 0.90}, "error"),
    fixture("sample_eval_failures_decimal", "sample", "evaluate", {"unitsTested": 5, "observedFailures": 1.2, "targetReliability": 0.90, "confidenceLevel": 0.90}, "error"),
    fixture("time_plan_mtbf_cl90_c0", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_mtbf_cl95_c0", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.95, "allowableFailures": 0}),
    fixture("time_plan_mtbf_cl90_c1", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 1}),
    fixture("time_plan_mtbf_cl90_c2", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 2}),
    fixture("time_plan_reliability_mission", "time", "plan", {"targetDefinition": "reliability", "targetReliability": 0.90, "missionTime": 100, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_r90_mission", "time", "plan", {"targetDefinition": "reliability", "targetReliability": 0.90, "missionTime": 500, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_r95_mission", "time", "plan", {"targetDefinition": "reliability", "targetReliability": 0.95, "missionTime": 500, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_units_10", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 0, "numberOfUnits": 10}),
    fixture("time_plan_units_1", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 0, "numberOfUnits": 1}),
    fixture("time_plan_units_100", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 0, "numberOfUnits": 100}),
    fixture("time_plan_very_large_mtbf", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1_000_000_000, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_very_small_mtbf", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 0.001, "confidenceLevel": 0.90, "allowableFailures": 0}),
    fixture("time_plan_invalid_mtbf", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 0, "confidenceLevel": 0.90, "allowableFailures": 0}, "error"),
    fixture("time_plan_invalid_mission", "time", "plan", {"targetDefinition": "reliability", "targetReliability": 0.90, "missionTime": 0, "confidenceLevel": 0.90, "allowableFailures": 0}, "error"),
    fixture("time_plan_invalid_allowable", "time", "plan", {"targetDefinition": "mtbf", "targetMTBF": 1000, "confidenceLevel": 0.90, "allowableFailures": 1.2}, "error"),
    fixture("time_eval_zero_failure", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 2302.585092994046, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_one_failure", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 4000, "observedFailures": 1, "confidenceLevel": 0.90}),
    fixture("time_eval_three_failures", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 8000, "observedFailures": 3, "confidenceLevel": 0.90}),
    fixture("time_eval_many_failures", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 50000, "observedFailures": 20, "confidenceLevel": 0.90}),
    fixture("time_eval_target_demonstrated", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 3000, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_target_not_demonstrated", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 1000, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_target_equals_lower", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 2302.585092994046, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_reliability_mission", "time", "evaluate", {"targetDefinition": "reliability", "targetReliability": 0.90, "missionTime": 100, "totalTestTime": 2302.585092994046, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_zero_point_not_estimable", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 2302.585092994046, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_gap_zero", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 3000, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_gap_positive", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 1000, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_very_large_exposure", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1_000_000, "totalTestTime": 5_000_000_000, "observedFailures": 3, "confidenceLevel": 0.90}),
    fixture("time_eval_very_small_exposure", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 0.001, "totalTestTime": 0.01, "observedFailures": 0, "confidenceLevel": 0.90}),
    fixture("time_eval_invalid_total_exposure", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 0, "observedFailures": 0, "confidenceLevel": 0.90}, "error"),
    fixture("time_eval_invalid_observed_failures", "time", "evaluate", {"targetDefinition": "mtbf", "targetMTBF": 1000, "totalTestTime": 1000, "observedFailures": -1, "confidenceLevel": 0.90}, "error"),
]


def validate_inputs(item: dict) -> None:
    inputs = item["inputs"]
    if "targetReliability" in inputs and not (0 < inputs["targetReliability"] < 1):
        raise ValueError("Target Reliability must be greater than 0 and less than 1.")
    if "confidenceLevel" in inputs and not (0 < inputs["confidenceLevel"] < 1):
        raise ValueError("Confidence Level must be greater than 0 and less than 1.")
    if "allowableFailures" in inputs:
        c = inputs["allowableFailures"]
        if not isinstance(c, int) or c < 0:
            raise ValueError("Allowable Failures must be a non-negative integer.")
    if item["method"] == "sample" and item["workflow"] == "evaluate":
        n = inputs["unitsTested"]
        d = inputs["observedFailures"]
        if not isinstance(n, int) or n <= 0:
            raise ValueError("Units Tested must be a positive integer.")
        if not isinstance(d, int) or d < 0:
            raise ValueError("Observed Failures must be a non-negative integer.")
        if d > n:
            raise ValueError("Observed Failures cannot be greater than Units Tested.")
    if item["method"] == "time":
        if inputs.get("targetDefinition") == "mtbf" and inputs.get("targetMTBF", 1) <= 0:
            raise ValueError("Target MTBF must be a finite positive number.")
        if inputs.get("targetDefinition") == "reliability" and inputs.get("missionTime", 0) <= 0:
            raise ValueError("Mission Time must be a finite positive number.")
        if item["workflow"] == "evaluate":
            if inputs.get("totalTestTime", 0) <= 0:
                raise ValueError("Total Test Time must be a finite positive number.")
            d = inputs["observedFailures"]
            if not isinstance(d, int) or d < 0:
                raise ValueError("Observed Failures must be a non-negative integer.")


def expected_for(item: dict) -> dict:
    try:
        validate_inputs(item)
        if item["method"] == "sample" and item["workflow"] == "plan":
            outputs = binomial_plan(item["inputs"])
        elif item["method"] == "sample":
            outputs = binomial_evaluate(item["inputs"])
        elif item["workflow"] == "plan":
            outputs = exponential_plan(item["inputs"])
        else:
            outputs = exponential_evaluate(item["inputs"])
        return {"status": "ok", "outputs": outputs, "validationErrors": []}
    except Exception as exc:
        return {"status": "error", "outputs": {}, "validationErrors": [str(exc)]}


def build_expected() -> list[dict]:
    expected = []
    for item in FIXTURES:
        result = expected_for(item)
        expected.append({
            "fixtureId": item["fixtureId"],
            "expectedStatus": item["expectedStatus"],
            "referenceMethod": item["referenceMethod"],
            **result,
        })
    return expected


def verify_golden() -> None:
    fixture_path = FIXTURE_DIR / "demonstration-fixtures.json"
    expected_path = FIXTURE_DIR / "demonstration-expected-results.json"
    stored_fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
    stored_expected = json.loads(expected_path.read_text(encoding="utf-8"))
    generated_expected = build_expected()

    if stored_fixtures != FIXTURES:
        raise SystemExit(
            "Demonstration fixtures differ from the independent reference definitions. "
            "Run `npm run update-golden:demonstration` only after an intentional review."
        )
    if stored_expected != generated_expected:
        raise SystemExit(
            "Demonstration expected results differ from the independent reference. "
            "Run `npm run update-golden:demonstration` only after an intentional review."
        )

    print(f"Demonstration reference verification: {len(FIXTURES)}/{len(FIXTURES)} fixtures match")


def update_golden() -> None:
    expected = build_expected()
    FIXTURE_DIR.mkdir(exist_ok=True)

    (FIXTURE_DIR / "demonstration-fixtures.json").write_text(json.dumps(FIXTURES, indent=2), encoding="utf-8")
    (FIXTURE_DIR / "demonstration-expected-results.json").write_text(json.dumps(expected, indent=2), encoding="utf-8")

    smoke_rows = [
        {
            "case": item["fixtureId"],
            "status": result["status"],
            "primary_value": primary_value(result["outputs"]),
        }
        for item, result in zip(FIXTURES[:8], [expected_for(item) for item in FIXTURES[:8]])
    ]
    with (ROOT / "demonstration-reference-output.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["case", "status", "primary_value"])
        writer.writeheader()
        writer.writerows(smoke_rows)

    print(f"Demonstration golden files updated: {len(FIXTURES)} fixtures")


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify or explicitly update Demonstration golden reference files.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--verify", action="store_true", help="Read and compare golden files without writing.")
    mode.add_argument("--update-golden", action="store_true", help="Explicitly rewrite approved golden files.")
    args = parser.parse_args()

    if args.verify:
        verify_golden()
    else:
        update_golden()


def primary_value(outputs: dict):
    for key in ["requiredSampleSize", "reliabilityLowerBound", "requiredTotalTestTime", "mtbfLowerBound"]:
        if key in outputs:
            return outputs[key]
    return ""


if __name__ == "__main__":
    main()
