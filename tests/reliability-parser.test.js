import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDelimitedText, parseFile } from "../src/reliability/parser.js";

test("CSV parser reads headers and rows", () => {
  const parsed = parseDelimitedText("Sample ID,Time,Status\nS1,10,Failure\nS2,20,Censored", ",");
  assert.deepEqual(parsed.headers, ["Sample ID", "Time", "Status"]);
  assert.equal(parsed.rows[0].Time, "10");
});

test("TSV parser reads headers and rows", () => {
  const parsed = parseDelimitedText("Sample ID\tTime\tStatus\nS1\t10\tFailure\nS2\t20\tCensored", "\t");
  assert.deepEqual(parsed.headers, ["Sample ID", "Time", "Status"]);
  assert.equal(parsed.rows[1].Status, "Censored");
});

test("XLSX parser reads the example workbook", async () => {
  const buffer = await readFile(new URL("../examples/life-data-example.xlsx", import.meta.url));
  const parsed = await parseFile(new File([buffer], "life-data-example.xlsx"));
  assert.deepEqual(parsed.headers, ["Sample ID", "Time", "Status", "Failure Mode", "Test Condition"]);
  assert.equal(parsed.rows.length, 15);
});
