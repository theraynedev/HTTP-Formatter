import test from "node:test";
import assert from "node:assert/strict";
import { maskToken, maskTokenRuns, DEFAULT_VISIBLE } from "./redactOps.js";

test("masks everything but the last N (default 4)", () => {
  assert.equal(maskToken("sk_live_abcd1234"), "************1234");
  assert.equal(DEFAULT_VISIBLE, 4);
});

test("honours a custom visible count", () => {
  assert.equal(maskToken("abcdefghij", { visible: 2 }), "********ij");
  assert.equal(maskToken("abcdefghij", { visible: 0 }), "**********");
});

test("keepStart preserves a non-secret type prefix", () => {
  assert.equal(maskToken("sk_live_abcd1234", { visible: 4, keepStart: 8 }), "sk_live_****1234");
});

test("a custom mask character works", () => {
  assert.equal(maskToken("abcdef", { visible: 2, maskChar: "•" }), "••••ef");
});

test("visible >= length leaves the string untouched (nothing to mask)", () => {
  assert.equal(maskToken("abc", { visible: 4 }), "abc");
  assert.equal(maskToken("abc", { visible: 3 }), "abc");
});

test("empty and non-string input → empty string", () => {
  assert.equal(maskToken(""), "");
  assert.equal(maskToken(null), "");
  assert.equal(maskToken(undefined), "");
  assert.equal(maskToken(12345), "");
});

test("never returns a longer string than it was given", () => {
  const inputs = ["a", "ab", "abc", "abcd", "abcde", "sk_live_abcd1234"];
  for (const s of inputs) {
    for (const visible of [0, 1, 4, 8, 99]) {
      assert.ok(maskToken(s, { visible }).length <= s.length, `${s} / ${visible}`);
    }
  }
});

test("maskTokenRuns redacts token-shaped runs inside a blob", () => {
  const env = "API_KEY=sk_live_abcdefghijklmnop\nPORT=8080\nNAME=prod";
  const out = maskTokenRuns(env);
  assert.ok(out.includes("API_KEY=********************mnop"), out);
  assert.ok(out.includes("PORT=8080")); // short values untouched
  assert.ok(out.includes("NAME=prod")); // the key name is never masked
});

test("maskTokenRuns leaves empty input alone", () => {
  assert.equal(maskTokenRuns(""), "");
  assert.equal(maskTokenRuns(null), "");
});
