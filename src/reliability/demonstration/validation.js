export function validateDemoInputs(state, ui = key => key) {
  const errors = [];
  const warnings = [];
  const input = state.inputs;
  if (!validProbability(input.confidenceLevel)) errors.push(ui("demoConfidenceInvalid"));
  if (state.method === "sample") {
    if (!validProbability(input.targetReliability)) errors.push(ui("demoReliabilityInvalid"));
    if (!nonNegativeInteger(input.allowableFailures)) errors.push(ui("demoAllowableFailuresInvalid"));
    if (input.missionTime && !positiveNumber(input.missionTime)) errors.push(ui("missionTimeInvalid"));
    if (state.workflow === "evaluate") {
      if (!positiveInteger(input.unitsTested)) errors.push(ui("demoUnitsInvalid"));
      if (!nonNegativeInteger(input.observedFailures)) errors.push(ui("demoObservedFailuresInvalid"));
      if (positiveInteger(input.unitsTested) && nonNegativeInteger(input.observedFailures) && Number(input.observedFailures) > Number(input.unitsTested)) errors.push(ui("demoFailuresGreaterThanUnits"));
    } else if (!input.missionTime) {
      warnings.push(ui("demoMissionOptionalMissing"));
    }
  } else {
    if (!nonNegativeInteger(input.allowableFailures)) errors.push(ui("demoAllowableFailuresInvalid"));
    if (state.targetDefinition === "reliability") {
      if (!validProbability(input.targetReliability)) errors.push(ui("demoReliabilityInvalid"));
      if (!positiveNumber(input.missionTime)) errors.push(ui("missionTimeInvalid"));
    } else if (!positiveNumber(input.targetMTBF)) errors.push(ui("targetMtbfInvalid"));
    if (state.workflow === "plan") {
      if (input.numberOfUnits && !positiveInteger(input.numberOfUnits)) errors.push(ui("demoUnitsOptionalInvalid"));
    } else {
      if (!positiveNumber(input.totalTestTime)) errors.push(ui("demoTotalTestTimeInvalid"));
      if (!nonNegativeInteger(input.observedFailures)) errors.push(ui("demoObservedFailuresInvalid"));
    }
  }
  return { errors: unique(errors), warnings: unique(warnings) };
}

export function normalizePercentInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return number > 1 ? number / 100 : number;
}

function validProbability(value) {
  const number = normalizePercentInput(value);
  return Number.isFinite(number) && number > 0 && number < 1;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}
