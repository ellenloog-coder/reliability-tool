export function createDecisionResult({
  status,
  reasonCodes,
  requirement,
  actualValue,
  existingDecision
}) {
  return {
    status,
    reasonCodes: [...reasonCodes],
    requirement,
    actualValue,
    /**
     * @deprecated RELIABILITY_LEGACY_BOUNDARY
     * Compatibility-only projection for unchanged page and report consumers.
     * New consumers must use status, reasonCodes, requirement, and actualValue.
     */
    existingDecision
  };
}
