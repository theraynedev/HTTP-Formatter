import test from "node:test";
import assert from "node:assert/strict";
import { parseHeaderBlock, checkSecurityHeaders, formatSecurityReport } from "./secHeadersOps.js";

const GOOD = `HTTP/1.1 200 OK
Content-Type: text/html
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=()`;

test("parseHeaderBlock skips the status line and lowercases keys", () => {
  const h = parseHeaderBlock(GOOD);
  assert.equal(h["x-frame-options"], "DENY");
  assert.equal(h["content-type"], "text/html");
  assert.ok(!("http/1.1 200 ok" in h));
});

test("parseHeaderBlock joins folded continuation lines", () => {
  const h = parseHeaderBlock("X-Frame-Options: SAME\n  ORIGIN");
  assert.equal(h["x-frame-options"], "SAME ORIGIN");
});

test("parseHeaderBlock tolerates CRLF and blank lines", () => {
  const h = parseHeaderBlock("A: 1\r\n\r\nB: 2\r\n");
  assert.deepEqual(h, { a: "1", b: "2" });
});

test("a fully configured response reports everything ok", () => {
  const { summary, checks } = checkSecurityHeaders(GOOD);
  assert.equal(summary.total, 6);
  assert.equal(summary.ok, 6);
  assert.equal(summary.missing, 0);
  assert.equal(checks.every((c) => c.status === "ok"), true);
});

test("no headers at all → everything missing", () => {
  const { summary } = checkSecurityHeaders("");
  assert.equal(summary.missing, 6);
  assert.equal(summary.ok, 0);
});

test("a CSP with unsafe-inline is flagged weak, not ok", () => {
  const { checks } = checkSecurityHeaders("Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline'");
  const csp = checks.find((c) => c.name === "Content-Security-Policy");
  assert.equal(csp.status, "weak");
});

test("a short HSTS max-age is flagged weak", () => {
  const { checks } = checkSecurityHeaders("Strict-Transport-Security: max-age=60");
  assert.equal(checks.find((c) => c.name === "Strict-Transport-Security").status, "weak");
});

test("HSTS without includeSubDomains is flagged weak", () => {
  const { checks } = checkSecurityHeaders("Strict-Transport-Security: max-age=31536000");
  assert.match(checks.find((c) => c.name === "Strict-Transport-Security").note, /includeSubDomains/);
});

test("an invalid X-Frame-Options value is weak", () => {
  const { checks } = checkSecurityHeaders("X-Frame-Options: ALLOWALL");
  assert.equal(checks.find((c) => c.name === "X-Frame-Options").status, "weak");
});

test("every check carries a one-line explanation", () => {
  const { checks } = checkSecurityHeaders(GOOD);
  for (const c of checks) assert.ok(c.note && c.note.length > 10, c.name);
});

test("formatSecurityReport summarises counts", () => {
  const report = checkSecurityHeaders("X-Content-Type-Options: nosniff");
  const text = formatSecurityReport(report);
  assert.match(text, /\[PASS\] X-Content-Type-Options/);
  assert.match(text, /1 ok · 0 weak · 5 missing/);
});
