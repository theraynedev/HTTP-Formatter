import test from "node:test";
import assert from "node:assert/strict";
import { identifyHash, formatHashCandidates } from "./hashIdOps.js";

const algos = (input) => identifyHash(input).map((c) => c.algo);

test("32 hex → MD5 first, NTLM alongside", () => {
  const res = identifyHash("5d41402abc4b2a76b9719d911017c592");
  assert.equal(res[0].algo, "MD5");
  assert.equal(res[0].confidence, "high");
  assert.ok(algos("5d41402abc4b2a76b9719d911017c592").includes("NTLM"));
});

test("40 hex → SHA-1", () => {
  assert.equal(identifyHash("da39a3ee5e6b4b0d3255bfef95601890afd80709")[0].algo, "SHA-1");
});

test("64 hex → SHA-256", () => {
  assert.equal(
    identifyHash("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")[0].algo,
    "SHA-256",
  );
});

test("128 hex → SHA-512", () => {
  assert.equal(identifyHash("a".repeat(128))[0].algo, "SHA-512");
});

test("uppercase hex is still recognised", () => {
  assert.equal(identifyHash("5D41402ABC4B2A76B9719D911017C592")[0].algo, "MD5");
});

test("bcrypt / argon2 / sha512crypt are matched by prefix", () => {
  assert.equal(identifyHash("$2b$12$abcdefghijklmnopqrstuv")[0].algo, "bcrypt");
  assert.equal(identifyHash("$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$abc")[0].algo, "Argon2");
  assert.equal(identifyHash("$6$rounds=5000$salt$hash")[0].algo, "sha512crypt");
  assert.equal(identifyHash("$5$salt$hash")[0].algo, "sha256crypt");
});

test("DES crypt shape (13 chars) is recognised", () => {
  assert.equal(identifyHash("abcdefghijklm")[0].algo, "DES(Unix) crypt");
});

test("results are ranked high → medium → low", () => {
  const order = { high: 0, medium: 1, low: 2 };
  const res = identifyHash("5d41402abc4b2a76b9719d911017c592");
  for (let i = 1; i < res.length; i++) {
    assert.ok(order[res[i - 1].confidence] <= order[res[i].confidence]);
  }
});

test("unrecognised input → empty list, and the formatter says so", () => {
  assert.deepEqual(identifyHash("not-a-hash"), []);
  assert.match(formatHashCandidates([]), /No match/);
});

test("empty and non-string input → empty list", () => {
  assert.deepEqual(identifyHash(""), []);
  assert.deepEqual(identifyHash("   "), []);
  assert.deepEqual(identifyHash(null), []);
});

test("formatHashCandidates renders one line per candidate", () => {
  const text = formatHashCandidates(identifyHash("5d41402abc4b2a76b9719d911017c592"));
  assert.equal(text.split("\n").length, identifyHash("5d41402abc4b2a76b9719d911017c592").length);
  assert.match(text, /MD5/);
});
