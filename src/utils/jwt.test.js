import test from "node:test";
import assert from "node:assert/strict";
import { decodeJwt, encodeJwt, verifyJwt, inspectJwt, formatDuration, extractAuthHeader } from "./jwt.js";

// The canonical jwt.io HS256 sample — a fixed reference to check our HMAC
// implementation against, independent of our own encoder.
const REF_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const REF_SECRET = "your-256-bit-secret";

// ─── Decode ───────────────────────────────────────────────────────────────────

test("decodes the reference token", () => {
  const d = decodeJwt(REF_TOKEN);
  assert.equal(d.header.alg, "HS256");
  assert.equal(d.payload.sub, "1234567890");
  assert.equal(d.payload.name, "John Doe");
  assert.equal(d.alg, "HS256");
});

test("strips a Bearer prefix", () => {
  assert.equal(decodeJwt(`Bearer ${REF_TOKEN}`).payload.name, "John Doe");
});

test("returns null for malformed, empty and non-string input", () => {
  assert.equal(decodeJwt("abc.def"), null);
  assert.equal(decodeJwt("not-a-jwt"), null);
  assert.equal(decodeJwt("a.b.c"), null); // not base64url JSON
  assert.equal(decodeJwt(""), null);
  assert.equal(decodeJwt(null), null);
});

// ─── Encode ───────────────────────────────────────────────────────────────────

test("encode → decode round-trips the claims", async () => {
  const res = await encodeJwt({
    payload: { sub: "42", role: "admin" },
    secret: "hunter2",
    alg: "HS256",
  });
  assert.equal(res.ok, true);
  const d = decodeJwt(res.token);
  assert.equal(d.payload.sub, "42");
  assert.equal(d.header.typ, "JWT");
  assert.equal(d.header.alg, "HS256");
});

test("an encoded token verifies with the same secret", async () => {
  const { token } = await encodeJwt({ payload: { a: 1 }, secret: "s3cret" });
  const v = await verifyJwt(token, "s3cret");
  assert.equal(v.valid, true);
});

test("alg none produces an empty signature", async () => {
  const res = await encodeJwt({ payload: { a: 1 }, alg: "none" });
  assert.equal(res.ok, true);
  assert.ok(res.token.endsWith("."));
  assert.equal(decodeJwt(res.token).signature, "");
});

test("encode rejects a non-object payload and a missing secret", async () => {
  assert.equal((await encodeJwt({ payload: "nope", secret: "x" })).ok, false);
  assert.equal((await encodeJwt({ payload: [1, 2], secret: "x" })).ok, false);
  const noSecret = await encodeJwt({ payload: { a: 1 }, secret: "" });
  assert.equal(noSecret.ok, false);
  assert.match(noSecret.error, /secret is required/);
});

test("encode rejects an unsupported algorithm", async () => {
  const res = await encodeJwt({ payload: { a: 1 }, secret: "x", alg: "RS256" });
  assert.equal(res.ok, false);
  assert.match(res.error, /Unsupported algorithm/);
});

// ─── Verify ───────────────────────────────────────────────────────────────────

test("verifies the reference token against its known secret", async () => {
  const v = await verifyJwt(REF_TOKEN, REF_SECRET);
  assert.equal(v.valid, true);
  assert.equal(v.alg, "HS256");
});

test("a wrong secret fails verification", async () => {
  const v = await verifyJwt(REF_TOKEN, "wrong-secret");
  assert.equal(v.valid, false);
  assert.match(v.reason, /does not match/);
});

test("a tampered payload fails verification", async () => {
  const [h, , s] = REF_TOKEN.split(".");
  const tampered = `${h}.${Buffer.from(JSON.stringify({ sub: "999" })).toString("base64url")}.${s}`;
  const v = await verifyJwt(tampered, REF_SECRET);
  assert.equal(v.valid, false);
});

test("an alg:none token can never verify", async () => {
  const { token } = await encodeJwt({ payload: { a: 1 }, alg: "none" });
  const v = await verifyJwt(token, "anything");
  assert.equal(v.valid, false);
  assert.match(v.reason, /none/);
});

test("verify never throws on malformed input", async () => {
  const v = await verifyJwt("garbage", "x");
  assert.equal(v.valid, false);
  assert.equal(typeof v.reason, "string");
});

// ─── Inspect / flags ──────────────────────────────────────────────────────────

test("inspect flags alg:none and a missing exp", async () => {
  const { token } = await encodeJwt({ payload: { a: 1 }, alg: "none" });
  const res = inspectJwt(token);
  assert.equal(res.ok, true);
  const messages = res.flags.map((f) => f.message).join(" ");
  assert.match(messages, /alg is "none"/);
  assert.match(messages, /No exp claim/);
});

test("inspect flags an expired token", () => {
  const payload = Buffer.from(JSON.stringify({ exp: 1000000000 })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
  const res = inspectJwt(token);
  assert.equal(res.flags.some((f) => f.level === "error" && /Expired/.test(f.message)), true);
});

test("inspect on garbage reports an error rather than throwing", () => {
  const res = inspectJwt("nope");
  assert.equal(res.ok, false);
  assert.match(res.error, /three dot-separated/);
  assert.deepEqual(res.flags, []);
});

// ─── Helpers preserved for JwtPanel ───────────────────────────────────────────

test("formatDuration and extractAuthHeader still behave", () => {
  assert.equal(formatDuration(-1), "Expired");
  assert.equal(formatDuration(90), "1m 30s");
  assert.equal(formatDuration(3600), "1h 0m");
  assert.equal(
    extractAuthHeader(["Content-Type: application/json", "Authorization: Bearer abc"]),
    "Bearer abc",
  );
  assert.equal(extractAuthHeader(["Content-Type: text/plain"]), null);
});
