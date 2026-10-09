import test from "node:test";
import assert from "node:assert/strict";
import { generateUuidV4, generateUuidV7, generateUuids, parseUuid } from "./uuidOps.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("v4 has the right shape, version and variant", () => {
  const id = generateUuidV4();
  assert.match(id, UUID_RE);
  assert.equal(id[14], "4"); // version nibble
  assert.ok(["8", "9", "a", "b"].includes(id[19])); // RFC 4122 variant
});

test("v4 values differ between calls", () => {
  const set = new Set(generateUuids(4, 200));
  assert.equal(set.size, 200);
});

test("v7 encodes the timestamp in the first 48 bits", () => {
  const ms = 1700000000000;
  const id = generateUuidV7(ms);
  assert.match(id, UUID_RE);
  assert.equal(id[14], "7");
  const parsed = parseUuid(id);
  assert.equal(parsed.version, 7);
  assert.equal(parsed.timestampMs, ms);
});

test("v7 values sort in creation order", () => {
  const a = generateUuidV7(1700000000000);
  const b = generateUuidV7(1700000000001);
  assert.ok(a < b, `${a} should sort before ${b}`);
});

test("generateUuids clamps the count and defaults to v4", () => {
  assert.equal(generateUuids(4, 0).length, 1);
  assert.equal(generateUuids(4, 5).length, 5);
  assert.equal(generateUuids(7, 3)[0][14], "7");
  assert.equal(generateUuids(4, 99999).length, 1000);
});

test("parseUuid accepts braces and the urn:uuid: prefix", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(parseUuid(`{${id}}`).canonical, id);
  assert.equal(parseUuid(`urn:uuid:${id}`).canonical, id);
  assert.equal(parseUuid(id.toUpperCase()).canonical, id);
});

test("parseUuid reports the nil and max UUIDs", () => {
  assert.equal(parseUuid("00000000-0000-0000-0000-000000000000").nil, true);
  assert.equal(parseUuid("ffffffff-ffff-ffff-ffff-ffffffffffff").max, true);
});

test("parseUuid rejects malformed, empty and non-string input", () => {
  assert.equal(parseUuid("not-a-uuid").valid, false);
  assert.equal(parseUuid("550e8400-e29b-41d4-a716-44665544000").valid, false); // one char short
  assert.equal(parseUuid("").valid, false);
  assert.equal(parseUuid(null).valid, false);
  assert.match(parseUuid("nope").error, /8-4-4-4-12/);
});
