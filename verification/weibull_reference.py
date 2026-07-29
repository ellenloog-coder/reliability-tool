#!/usr/bin/env python3
"""Independent Weibull 2P reference calculations for Life Data verification.

The browser implementation solves the Weibull score equation with bisection.
This reference uses profiled log-likelihood maximization over log(beta) with
golden-section search, so it is intentionally independent of the JS root solver.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "verification" / "fixtures" / "life-data-fixtures.json"
EXPECTED_PATH = ROOT / "verification" / "fixtures" / "expected-results.json"
REPORT_MD_PATH = ROOT / "verification" / "verification-report.md"


def stable_sum_exp(values):
    max_value = max(values)
    return math.exp(max_value) * sum(math.exp(v - max_value) for v in values)


def eta_for_beta(records, beta):
    failures = [r for r in records if r["status"] == "failure"]
    if not failures:
        raise ValueError("zero_failure")
    scale = max(r["time"] for r in records)
    scaled_logs = [math.log(r["time"] / scale) for r in records]
    sum_scaled_beta = sum(math.exp(beta * value) for value in scaled_logs)
    eta_scaled = (sum_scaled_beta / len(failures)) ** (1.0 / beta)
    return eta_scaled * scale


def log_likelihood(records, beta, eta):
    total = 0.0
    for record in records:
        z = (record["time"] / eta) ** beta
        if record["status"] == "failure":
            total += math.log(beta) - math.log(eta) + (beta - 1.0) * math.log(record["time"] / eta) - z
        else:
            total -= z
    return total


def profile_log_likelihood(records, log_beta):
    beta = math.exp(log_beta)
    eta = eta_for_beta(records, beta)
    return log_likelihood(records, beta, eta)


def fit_weibull_reference(records):
    failures = [r for r in records if r["status"] == "failure"]
    if not failures:
        raise ValueError("zero_failure")
    if len({r["time"] for r in records}) < 2:
        raise ValueError("identical_times")
    if any((not math.isfinite(r["time"])) or r["time"] <= 0 for r in records):
        raise ValueError("invalid_time")

    lo = math.log(0.05)
    hi = math.log(50.0)
    inv_phi = (math.sqrt(5.0) - 1.0) / 2.0
    inv_phi_sq = (3.0 - math.sqrt(5.0)) / 2.0
    c = lo + inv_phi_sq * (hi - lo)
    d = lo + inv_phi * (hi - lo)
    fc = profile_log_likelihood(records, c)
    fd = profile_log_likelihood(records, d)
    iterations = 0
    for iterations in range(1, 800):
        if abs(hi - lo) < 1e-12:
            break
        if fc < fd:
            lo = c
            c = d
            fc = fd
            d = lo + inv_phi * (hi - lo)
            fd = profile_log_likelihood(records, d)
        else:
            hi = d
            d = c
            fd = fc
            c = lo + inv_phi_sq * (hi - lo)
            fc = profile_log_likelihood(records, c)
    beta = math.exp((lo + hi) / 2.0)
    eta = eta_for_beta(records, beta)
    return {
        "beta": beta,
        "eta": eta,
        "converged": True,
        "iterations": iterations,
        "logLikelihood": log_likelihood(records, beta, eta),
    }


def bx(x, beta, eta):
    return eta * (-math.log(1.0 - x)) ** (1.0 / beta)


def reliability_at(time, beta, eta):
    return math.exp(-((time / eta) ** beta))


def calculate_expected(fixture):
    records = fixture.get("records")
    if not records:
        return {
            "name": fixture["name"],
            "description": fixture["description"],
            "expectError": fixture.get("expectError"),
            "rawRows": fixture.get("rawRows", []),
        }
    result = {
        "name": fixture["name"],
        "description": fixture["description"],
        "records": records,
        "failureCount": sum(1 for r in records if r["status"] == "failure"),
        "censoredCount": sum(1 for r in records if r["status"] == "censored"),
        "missionTime": fixture["missionTime"],
    }
    try:
        fit = fit_weibull_reference(records)
    except ValueError as exc:
        result["expectError"] = str(exc)
        return result
    beta = fit["beta"]
    eta = fit["eta"]
    rt = reliability_at(fixture["missionTime"], beta, eta)
    result.update(
        {
            "expected": {
                **fit,
                "b1": bx(0.01, beta, eta),
                "b5": bx(0.05, beta, eta),
                "b10": bx(0.10, beta, eta),
                "b50": bx(0.50, beta, eta),
                "missionReliability": rt,
                "missionFailureProbability": 1.0 - rt,
            }
        }
    )
    return result


def main():
    fixtures = json.loads(FIXTURE_PATH.read_text())
    expected = [calculate_expected(fixture) for fixture in fixtures]
    EXPECTED_PATH.write_text(json.dumps(expected, indent=2) + "\n")
    normal = [item for item in expected if "expected" in item]
    invalid = [item for item in expected if "expected" not in item]
    REPORT_MD_PATH.write_text(
        "\n".join(
            [
                "# Life Data Numerical Verification Reference",
                "",
                "Reference implementation: Python profile log-likelihood maximization over log(beta) using golden-section search.",
                "",
                f"Fixtures: {len(expected)} total, {len(normal)} normal numerical fixtures, {len(invalid)} invalid/error fixtures.",
                "",
                "Production browser code does not depend on Python, R, SciPy, or remote services.",
                "",
            ]
        )
    )
    print(f"Wrote {EXPECTED_PATH}")
    print(f"Wrote {REPORT_MD_PATH}")


if __name__ == "__main__":
    main()
