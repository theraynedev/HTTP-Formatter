import test from "node:test";
import assert from "node:assert/strict";
import { parseTimestamp, convertTimestamp, convertBatch, relativeTime, formatInZone } from "./timeOps.js";

test("10 digits → seconds", () => {
  const r = parseTimestamp("1700000000");
  assert.equal(r.ok, true);
  assert.equal(r.unit, "seconds");
  assert.equal(r.ms, 1700000000000);
});

test("13 digits → milliseconds", () => {
  const r = parseTimestamp("1700000000000");
  assert.equal(r.unit, "milliseconds");
  assert.equal(r.ms, 1700000000000);
});

test("16 digits → microseconds, 19 digits → nanoseconds", () => {
  assert.equal(parseTimestamp("1700000000000000").unit, "microseconds");
  assert.equal(parseTimestamp("1700000000000000").ms, 1700000000000);
  assert.equal(parseTimestamp("1700000000000000000").unit, "nanoseconds");
  assert.equal(parseTimestamp("1700000000000000000").ms, 1700000000000);
});

test("a fractional value is treated as seconds", () => {
  const r = parseTimestamp("1700000000.5");
  assert.equal(r.unit, "seconds");
  assert.equal(r.ms, 1700000000500);
});

test("convertTimestamp renders ISO, UTC and a chosen zone", () => {
  const r = convertTimestamp("1700000000", { timeZone: "Asia/Tokyo" });
  assert.equal(r.ok, true);
  assert.equal(r.iso, "2023-11-14T22:13:20.000Z");
  assert.equal(r.seconds, 1700000000);
  assert.match(r.custom, /2023/);
  assert.equal(r.customZone, "Asia/Tokyo");
});

test("invalid, empty and non-string input return an error, never throw", () => {
  assert.equal(parseTimestamp("hello").ok, false);
  assert.match(parseTimestamp("").error, /Empty/);
  assert.equal(parseTimestamp(null).ok, false);
  assert.equal(convertTimestamp("nope").ok, false);
  assert.match(convertTimestamp("nope").error, /timestamp/);
});

test("absurdly large values are rejected as out of range", () => {
  assert.equal(parseTimestamp("9".repeat(30)).ok, false);
});

test("'now' is accepted as a convenience", () => {
  const r = parseTimestamp("now");
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.ms - Date.now()) < 5000);
});

test("relativeTime reads both directions", () => {
  const now = 1700000000000;
  assert.equal(relativeTime(now + 3600000, now), "in 1 hour");
  assert.equal(relativeTime(now - 86400000, now), "1 day ago");
  assert.equal(relativeTime(now + 500, now), "just now");
});

test("convertBatch handles a pasted block, skipping blanks", () => {
  const rows = convertBatch("1700000000\n\n1700000000000\nnot-a-number");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ok, true);
  assert.equal(rows[1].ok, true);
  assert.equal(rows[2].ok, false);
});

test("convertBatch on empty input → empty list", () => {
  assert.deepEqual(convertBatch(""), []);
  assert.deepEqual(convertBatch("   \n  "), []);
});

test("formatInZone survives an unknown timezone", () => {
  assert.equal(formatInZone(0, "Not/AZone"), null);
});
