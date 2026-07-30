export const ABSOLUTE_TOLERANCE = 1e-12;
export const RELATIVE_TOLERANCE = 1e-10;

export function compareParity(
  expected,
  actual,
  {
    path = "$",
    differences = [],
    numericDifferences = []
  } = {}
) {
  if (typeof expected === "number" && typeof actual === "number") {
    const absoluteDifference = Math.abs(expected - actual);
    const denominator = Math.max(
      Math.abs(expected),
      Math.abs(actual),
      Number.MIN_VALUE
    );
    const relativeDifference = absoluteDifference / denominator;
    numericDifferences.push({
      path,
      reference: expected,
      backend: actual,
      absoluteDifference,
      relativeDifference
    });
    if (
      absoluteDifference > ABSOLUTE_TOLERANCE
      && relativeDifference > RELATIVE_TOLERANCE
    ) {
      differences.push({
        category: "numeric",
        path,
        reference: expected,
        backend: actual,
        absoluteDifference,
        relativeDifference,
        absoluteTolerance: ABSOLUTE_TOLERANCE,
        relativeTolerance: RELATIVE_TOLERANCE
      });
    }
    return { differences, numericDifferences };
  }

  if (
    expected === null
    || actual === null
    || typeof expected !== "object"
    || typeof actual !== "object"
  ) {
    if (!Object.is(expected, actual)) {
      differences.push({
        category: classify(path, expected, actual),
        path,
        reference: expected,
        backend: actual
      });
    }
    return { differences, numericDifferences };
  }

  if (Array.isArray(expected) !== Array.isArray(actual)) {
    differences.push({
      category: "null/missing",
      path,
      reference: expected,
      backend: actual
    });
    return { differences, numericDifferences };
  }
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      differences.push({
        category: classify(path, expected, actual),
        path,
        reference: `array length ${expected.length}`,
        backend: `array length ${actual.length}`
      });
      return { differences, numericDifferences };
    }
    expected.forEach((item, index) => compareParity(
      item,
      actual[index],
      {
        path: `${path}[${index}]`,
        differences,
        numericDifferences
      }
    ));
    return { differences, numericDifferences };
  }

  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (expectedKeys.join("\0") !== actualKeys.join("\0")) {
    differences.push({
      category: "null/missing",
      path,
      reference: expectedKeys,
      backend: actualKeys
    });
    return { differences, numericDifferences };
  }
  for (const key of expectedKeys) {
    compareParity(expected[key], actual[key], {
      path: `${path}.${key}`,
      differences,
      numericDifferences
    });
  }
  return { differences, numericDifferences };
}

export function formatParityFailure(fixtureId, differences) {
  return [
    `Fixture ${fixtureId} failed Shadow Parity:`,
    ...differences.map(item => JSON.stringify(item))
  ].join("\n");
}

function classify(path, expected, actual) {
  if (expected === null || actual === null) return "null/missing";
  if (path.includes(".validation")) return "validation";
  if (path.includes(".decision.status")) return "decision";
  if (path.includes("reasonCodes")) return "reason-code";
  if (path.includes(".insight")) return "insight";
  if (path.includes(".charts")) return "chart-derived";
  if (path.includes(".report_payload")) return "report-payload";
  if (path.includes(".input")) return "input-normalization";
  return "contract";
}
