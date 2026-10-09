import test from "node:test";
import assert from "node:assert/strict";
import { urlEncode, urlEncodeTwice, urlDecode, decodeUntilStable, parseQuery } from "./urlOps.js";

test("component-encodes by default", () => {
  assert.equal(urlEncode("a b&c=d"), "a%20b%26c%3Dd");
  assert.equal(urlEncode("café"), "caf%C3%A9");
});

test("keepReserved leaves URL structure intact (encodeURI)", () => {
  assert.equal(urlEncode("https://x.test/a b?q=1&r=2", { keepReserved: true }), "https://x.test/a%20b?q=1&r=2");
});

test("double encoding encodes the percent signs too", () => {
  assert.equal(urlEncodeTwice("a b"), "a%2520b");
});

test("decodes a normal string", () => {
  assert.deepEqual(urlDecode("a%20b%26c%3Dd"), { ok: true, text: "a b&c=d", passes: 1 });
});

test("malformed percent-encoding returns an error, never throws", () => {
  const res = urlDecode("100%");
  assert.equal(res.ok, false);
  assert.match(res.error, /Malformed percent-encoding/);
  assert.equal(res.text, "100%");
});

test("decodeUntilStable peels repeated layers", () => {
  const res = decodeUntilStable("a%2520b");
  assert.equal(res.ok, true);
  assert.equal(res.text, "a b");
  assert.equal(res.passes, 2);
});

test("decodeUntilStable stops at the guard instead of looping forever", () => {
  // A string that keeps changing but never becomes %-free is impossible, but a
  // deep nest should still be capped by maxPasses.
  const res = decodeUntilStable("a%2525252520b", { maxPasses: 2 });
  assert.equal(res.ok, true);
  assert.equal(res.passes, 2);
  assert.equal(res.capped, true);
});

test("empty input → empty, no passes", () => {
  assert.deepEqual(decodeUntilStable(""), { ok: true, text: "", passes: 0, capped: false });
  assert.deepEqual(urlDecode(""), { ok: true, text: "", passes: 0 });
});

test("parseQuery splits and decodes, tolerating a leading ?", () => {
  assert.deepEqual(parseQuery("?a=1&b=hello%20world&flag"), [
    { key: "a", value: "1" },
    { key: "b", value: "hello world" },
    { key: "flag", value: "" },
  ]);
});

test("parseQuery treats + as a space", () => {
  assert.deepEqual(parseQuery("q=hello+world"), [{ key: "q", value: "hello world" }]);
});
