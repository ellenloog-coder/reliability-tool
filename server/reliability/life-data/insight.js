import {
  buildStructuredLifeDataInsight,
  interpretWeibull
} from "../../../src/reliability/insight-engine.js";

export function buildLifeDataInsight(validation, calculation, decision) {
  return {
    structured: buildStructuredLifeDataInsight({
      validation,
      calculation,
      decision
    }),
    compatibility: interpretWeibull({
      validation,
      calculation,
      decision
    })
  };
}
