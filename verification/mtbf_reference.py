#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path

FAILURE_VALUES = {
    "fail", "failed", "failure", "event", "breakdown", "1", "yes",
    "失效", "故障", "失败",
}

CENSORED_VALUES = {
    "censored", "censor", "suspended", "suspend", "survived", "operating",
    "no failure", "right censored", "0", "no", "截尾", "删失", "未失效",
    "正常运行", "仍在运行",
}


def normalize_status(value):
    text = str(value or "").strip().lower()
    if text in FAILURE_VALUES:
        return "failure"
    if text in CENSORED_VALUES:
        return "censored"
    return None


def summarize_fixture(fixture):
    if fixture["inputMode"] == "summary":
        return {
            "totalExposure": fixture.get("totalExposure"),
            "failureCount": fixture.get("failureCount"),
            "censoredCount": fixture.get("censoredCount"),
            "totalUnits": fixture.get("totalUnits"),
            "missionTime": fixture.get("missionTime"),
            "targetMTBF": fixture.get("targetMTBF"),
            "timeUnit": fixture.get("timeUnit"),
            "errors": [],
        }

    total_exposure = 0.0
    failure_count = 0
    censored_count = 0
    errors = []
    records = 0
    for index, row in enumerate(fixture.get("rows", []), start=2):
        try:
            exposure = float(row.get("exposureTime"))
        except (TypeError, ValueError):
            errors.append(f"Row {index}: invalid Exposure Time")
            continue
        if not math.isfinite(exposure) or exposure <= 0:
            errors.append(f"Row {index}: invalid Exposure Time")
            continue
        status = normalize_status(row.get("status"))
        if status is None:
            errors.append(f"Row {index}: unrecognized Status")
            continue
        total_exposure += exposure
        records += 1
        if status == "failure":
            failure_count += 1
        else:
            censored_count += 1
    return {
        "totalExposure": total_exposure,
        "failureCount": failure_count,
        "censoredCount": censored_count,
        "totalUnits": records,
        "missionTime": fixture.get("missionTime"),
        "targetMTBF": fixture.get("targetMTBF"),
        "timeUnit": fixture.get("timeUnit"),
        "errors": errors,
    }


def validate_summary(summary):
    errors = list(summary.get("errors", []))
    total_exposure = summary.get("totalExposure")
    failure_count = summary.get("failureCount")
    mission_time = summary.get("missionTime")
    target = summary.get("targetMTBF")
    if not isinstance(total_exposure, (int, float)) or not math.isfinite(total_exposure) or total_exposure <= 0:
        errors.append("Total Time on Test must be a finite positive number.")
    if not isinstance(failure_count, int) or failure_count < 0:
        errors.append("Failure Count must be a non-negative integer.")
    if not isinstance(mission_time, (int, float)) or not math.isfinite(mission_time) or mission_time <= 0:
        errors.append("Mission Time must be a finite positive number.")
    if target is not None and (not isinstance(target, (int, float)) or not math.isfinite(target) or target <= 0):
        errors.append("Target MTBF must be a finite positive number.")
    return errors


def compare_target(observed_mtbf, target):
    if target is None:
        return "Target not provided"
    if observed_mtbf is None:
        return "Not Estimable"
    return "Meets Target" if observed_mtbf >= target else "Below Target"


def expected_for_fixture(fixture):
    summary = summarize_fixture(fixture)
    errors = validate_summary(summary)
    warnings = []
    if errors:
        return {
            "id": fixture["id"],
            "inputMode": fixture["inputMode"],
            "valid": False,
            "errors": errors,
            "expectedWarnings": warnings,
        }

    total_exposure = float(summary["totalExposure"])
    failure_count = int(summary["failureCount"])
    mission_time = float(summary["missionTime"])
    target = summary.get("targetMTBF")
    if failure_count == 0:
        warnings.append("zero-failure-not-estimable")
        return {
            "id": fixture["id"],
            "inputMode": fixture["inputMode"],
            "valid": True,
            "timeUnit": summary["timeUnit"],
            "totalExposure": total_exposure,
            "failureCount": 0,
            "censoredCount": summary["censoredCount"],
            "totalUnits": summary["totalUnits"],
            "missionTime": mission_time,
            "targetMTBF": target,
            "failureRate": None,
            "mtbf": None,
            "missionReliability": None,
            "missionFailureProbability": None,
            "targetResult": "Not Estimable" if target is not None else "Target not provided",
            "expectedWarnings": warnings,
        }

    failure_rate = failure_count / total_exposure
    mtbf = total_exposure / failure_count
    reliability = math.exp(-failure_rate * mission_time)
    return {
        "id": fixture["id"],
        "inputMode": fixture["inputMode"],
        "valid": True,
        "timeUnit": summary["timeUnit"],
        "totalExposure": total_exposure,
        "failureCount": failure_count,
        "censoredCount": summary["censoredCount"],
        "totalUnits": summary["totalUnits"],
        "missionTime": mission_time,
        "targetMTBF": target,
        "failureRate": failure_rate,
        "mtbf": mtbf,
        "missionReliability": reliability,
        "missionFailureProbability": 1 - reliability,
        "targetResult": compare_target(mtbf, target),
        "expectedWarnings": warnings,
    }


def main():
    root = Path(__file__).resolve().parent
    fixtures_path = root / "fixtures" / "mtbf-fixtures.json"
    output_path = root / "fixtures" / "mtbf-expected-results.json"
    fixtures = json.loads(fixtures_path.read_text(encoding="utf-8"))
    expected = [expected_for_fixture(fixture) for fixture in fixtures]
    if "--write" in sys.argv:
        output_path.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(expected, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
