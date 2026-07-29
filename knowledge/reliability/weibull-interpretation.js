export const weibullInterpretationConfig = {
  lowerRandomLimit: 0.9,
  upperRandomLimit: 1.1,
  rules: {
    decreasing: {
      result: "Decreasing failure-rate behavior",
      meaning: "Possible early-life failure pattern.",
      possibleConsiderations: ["manufacturing variation", "process defects", "screening weakness"],
      limitations: "The Weibull shape parameter does not confirm the physical failure mechanism."
    },
    random: {
      result: "Approximately constant failure-rate behavior",
      meaning: "Random failure pattern may be present.",
      possibleConsiderations: [],
      limitations: "The result does not confirm that all failures are random or independent."
    },
    increasing: {
      result: "Increasing failure-rate behavior",
      meaning: "Potential wear-out pattern.",
      possibleConsiderations: ["aging", "fatigue", "material degradation"],
      limitations: "Physical failure analysis is required to confirm the mechanism."
    }
  }
};
