import { readFileSync } from "node:fs";

export const expectedFixtures = JSON.parse(
  readFileSync(new URL("../verification/fixtures/expected-results.json", import.meta.url), "utf8")
);

export function fixture(name) {
  const item = expectedFixtures.find(entry => entry.name === name);
  if (!item) throw new Error(`Missing fixture ${name}`);
  return item;
}

export function relError(actual, expected) {
  return expected === 0 ? Math.abs(actual - expected) : Math.abs(actual - expected) / Math.abs(expected);
}
