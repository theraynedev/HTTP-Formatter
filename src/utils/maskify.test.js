// ─── maskify tests ────────────────────────────────────────────────────────────
// Zero-dependency: uses the Node built-in test runner + assert.
//   node --test src/utils/maskify.test.js
//   npm test

import test from "node:test";
import assert from "node:assert/strict";
import { maskify, MASKIFY_TOKENS, MASKIFY_DESCRIPTION } from "./maskify.js";

// ─── The three examples from the spec ─────────────────────────────────────────

test("spec example: 32-char MD5-style hash", () => {
  assert.equal(
    maskify("1ad48fdf34741318af03a706fe72a42d"),
    "?d?l?l?d?d?l?l?l?d?d?d?d?d?d?d?d?l?l?d?d?l?d?d?d?l?l?d?d?l?d?d?l",
  );
});

test("spec example: hyphenated UUID", () => {
  assert.equal(
    maskify("feac42ff-ca8a-4747-a0a2-9802df7888cc"),
    "?l?l?l?l?d?d?l?l-?l?l?d?l-?d?d?d?d-?l?d?l?d-?d?d?d?d?l?l?d?d?d?d?l?l",
  );
});

test("spec example: hash with trailing -0", () => {
  assert.equal(
    maskify("c868823ce7ef4751b7c747fb06a59a42-a3ac7545091b177d-0"),
    "?l?d?d?d?d?d?d?l?l?d?l?l?d?d?d?d?l?d?l?d?d?d?l?l?d?d?l?d?d?l?d?d-?l?d?l?l?d?d?d?d?d?d?d?l?d?d?d?l-?d",
  );
});

// ─── Digits ───────────────────────────────────────────────────────────────────

test("digits only → every character is ?d", () => {
  assert.equal(maskify("0123456789"), "?d".repeat(10));
});

test("digits mixed among letters keep their class", () => {
  assert.equal(maskify("a1B2c3"), "?l?d?u?d?l?d");
});

// ─── Letters (mixed case) ─────────────────────────────────────────────────────

test("lowercase only → every character is ?l", () => {
  assert.equal(maskify("abcdefghijklmnopqrstuvwxyz"), "?l".repeat(26));
});

test("uppercase only → every character is ?u", () => {
  assert.equal(maskify("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), "?u".repeat(26));
});

test("mixed-case letters map independently", () => {
  assert.equal(maskify("aAzZ"), "?l?u?l?u");
});

// ─── Symbols / hyphens / underscores mixed in ─────────────────────────────────

test("symbols, hyphens, underscores and spaces pass through literally", () => {
  assert.equal(maskify("a-b_c.d@e f"), "?l-?l_?l.?l@?l ?l");
});

test("a leading and trailing symbol are preserved", () => {
  assert.equal(maskify("-ab-"), "-?l?l-");
});

test("repeated separators keep their positions", () => {
  assert.equal(maskify("12__34"), "?d?d__?d?d");
});

test("a literal '?' is preserved verbatim (documented ambiguity)", () => {
  // "?" is punctuation, so it passes through — even though that makes it
  // indistinguishable from the start of a token in the output.
  assert.equal(maskify("?"), "?");
});

// ─── Empty / non-string input ─────────────────────────────────────────────────

test("empty string → empty string", () => {
  assert.equal(maskify(""), "");
});

test("non-string input is treated as empty (defensive)", () => {
  assert.equal(maskify(null), "");
  assert.equal(maskify(undefined), "");
  assert.equal(maskify(123456), "");
  assert.equal(maskify({}), "");
});

// ─── Realistic hash / UUID examples ───────────────────────────────────────────

test("64-char SHA-256 hex digest", () => {
  const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const expected = digest
    .split("")
    .map((c) => (/[0-9]/.test(c) ? "?d" : "?l"))
    .join("");
  assert.equal(maskify(digest), expected);
  // 64 chars in → 64 tokens out (no separators present).
  assert.equal(maskify(digest).length, 64 * 2);
});

test("uppercase hex digest classifies as ?u/?d", () => {
  assert.equal(maskify("DEADBEEF00"), "?u?u?u?u?u?u?u?u?d?d");
});

test("UUID v4 keeps its four hyphens", () => {
  const out = maskify("550e8400-e29b-41d4-a716-446655440000");
  assert.equal(
    out,
    "?d?d?d?l?d?d?d?d-?l?d?d?l-?d?d?l?d-?l?d?d?d-?d?d?d?d?d?d?d?d?d?d?d?d",
  );
  assert.equal((out.match(/-/g) ?? []).length, 4);
});

// ─── Unicode ──────────────────────────────────────────────────────────────────

test("accented letters are left untouched (not classified as letters)", () => {
  assert.equal(maskify("café"), "?l?l?lé"); // é is U+00E9 — outside a-z
});

test("emoji survive as a single literal unit (no surrogate splitting)", () => {
  assert.equal(maskify("🙂a"), "🙂?l");
  assert.equal(maskify("a🙂b"), "?l🙂?l");
});

test("non-ASCII digits are literals, not ?d", () => {
  assert.equal(maskify("٣a"), "٣?l"); // Arabic-Indic three
  assert.equal(maskify("３a"), "３?l"); // full-width three
});

test("CJK and mixed scripts pass through", () => {
  assert.equal(maskify("密码123"), "密码?d?d?d");
});

// ─── Purity / invariants ──────────────────────────────────────────────────────

test("is pure — repeated calls on the same input are identical", () => {
  const input = "Ab-12_x";
  assert.equal(maskify(input), maskify(input));
});

test("pure-ASCII input yields one unit per input code point", () => {
  const input = "aZ0-_ .@!#";
  const out = maskify(input);
  // Every token is exactly two chars; every literal is one.
  const units = out.replace(/\?[dlu]/g, "*").length;
  assert.equal(units, input.length);
});

test("MASKIFY_TOKENS exposes the canonical token strings", () => {
  assert.deepEqual(MASKIFY_TOKENS, { digit: "?d", lower: "?l", upper: "?u" });
  assert.equal(typeof MASKIFY_DESCRIPTION, "string");
  assert.ok(MASKIFY_DESCRIPTION.includes("?d/?l/?u"));
});
