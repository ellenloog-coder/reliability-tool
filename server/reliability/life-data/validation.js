import { validateRows } from "../../../src/reliability/validation.js";

export function validateLifeDataInput(engineInput) {
  const validation = validateRows(
    engineInput.rows,
    engineInput.mapping,
    engineInput.settings
  );
  return {
    raw: validation,
    structured: {
      status: validation.errors.length
        ? "INVALID"
        : validation.warnings.length
          ? "WARNING"
          : "VALID",
      errors: [...validation.errors],
      warnings: [...validation.warnings],
      counts: {
        total: validation.totalCount,
        failures: validation.failureCount,
        censored: validation.censoredCount
      },
      records: validation.records
    },
    issues: [
      ...validation.errors.map(message => issue("ERROR", message)),
      ...validation.warnings.map(message => issue("WARNING", message))
    ]
  };
}

function issue(severity, message) {
  return {
    severity,
    code: validationCode(message),
    message
  };
}

function validationCode(message) {
  const rules = [
    [/invalid Time/, "INVALID_TIME"],
    [/unrecognized Status/, "UNRECOGNIZED_STATUS"],
    [/No valid records/, "NO_VALID_RECORDS"],
    [/No valid Time/, "NO_VALID_TIME"],
    [/No recognizable Status/, "NO_RECOGNIZABLE_STATUS"],
    [/identical/, "IDENTICAL_TIMES"],
    [/without observed failures/, "ZERO_FAILURES"],
    [/Limited failure information/, "LIMITED_FAILURE_INFORMATION"],
    [/No right-censored observations/, "NO_RIGHT_CENSORING"],
    [/Time unit was not set/, "DEFAULT_TIME_UNIT"],
    [/Unsupported time unit/, "UNSUPPORTED_TIME_UNIT"],
    [/Duplicate Sample ID/, "DUPLICATE_SAMPLE_ID"],
    [/control characters/, "SAMPLE_ID_CONTROL_CHARACTERS"]
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1]
    || "VALIDATION_MESSAGE";
}
