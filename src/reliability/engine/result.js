import {
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_ENGINE_VERSION,
  RELIABILITY_FIXTURE_VERSION
} from "./contract.js";

export {
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_ENGINE_VERSION,
  RELIABILITY_FIXTURE_VERSION
};

export function validationEnvelope(validation, extra = {}) {
  const errors = [...(validation?.errors || [])];
  const warnings = [...(validation?.warnings || [])];
  return {
    status: errors.length ? "INVALID" : warnings.length ? "WARNING" : "VALID",
    errors,
    warnings,
    ...extra
  };
}

export function engineMetadata(module) {
  return {
    engineVersion: RELIABILITY_ENGINE_VERSION,
    contractVersion: RELIABILITY_CONTRACT_VERSION,
    fixtureVersion: RELIABILITY_FIXTURE_VERSION,
    module
  };
}

export function calculationFailure(error) {
  return {
    status: "ERROR",
    error: {
      code: "CALCULATION_ERROR",
      message: error instanceof Error ? error.message : String(error)
    }
  };
}
