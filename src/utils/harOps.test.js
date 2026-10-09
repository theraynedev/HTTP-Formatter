import test from "node:test";
import assert from "node:assert/strict";

import { historyEntryToHar, historyToHar, parseHarFile } from "./harOps.js";

const ENTRY = {
  id: "e1",
  name: "POST /v2/orders",
  customName: null,
  url: "https://api.example.com/v2/orders?page=2&limit=50",
  baseUrl: "https://api.example.com/v2/orders",
  queryParams: [
    { key: "page", value: "2", enabled: true },
    { key: "limit", value: "50", enabled: true },
    { key: "debug", value: "1", enabled: false },
  ],
  method: "post",
  headers: [
    "Content-Type: application/json",
    "Authorization: Bearer sk_live_abc",
    "X-Trace: a:b:c",
  ],
  payload: '{"sku":"A-1","qty":2}',
  bodyIsJson: true,
  raw: "curl -X POST ...",
  timestamp: "2026-10-09T07:00:00.000Z",
  size: 1234,
  headersSize: 321,
};

test("historyEntryToHar builds a HAR 1.2 document with one entry", () => {
  const har = historyEntryToHar(ENTRY);
  assert.equal(har.log.version, "1.2");
  assert.equal(har.log.entries.length, 1);
  assert.equal(har.log.creator.name, "HTTP Formatter History");
});

test("historyEntryToHar upper-cases the method and keeps the url", () => {
  const e = historyEntryToHar(ENTRY).log.entries[0];
  assert.equal(e.request.method, "POST");
  assert.equal(e.request.url, "https://api.example.com/v2/orders?page=2&limit=50");
});

test("historyEntryToHar splits headers on the FIRST colon only", () => {
  const headers = historyEntryToHar(ENTRY).log.entries[0].request.headers;
  assert.deepEqual(headers[0], {
    name: "Content-Type",
    value: "application/json",
  });
  assert.deepEqual(headers[2], { name: "X-Trace", value: "a:b:c" });
});

test("historyEntryToHar keeps a header that has no colon", () => {
  const har = historyEntryToHar({ ...ENTRY, headers: ["WeirdHeader"] });
  assert.deepEqual(har.log.entries[0].request.headers, [
    { name: "WeirdHeader", value: "" },
  ]);
});

test("historyEntryToHar drops disabled query params and maps key/value", () => {
  const qs = historyEntryToHar(ENTRY).log.entries[0].request.queryString;
  assert.deepEqual(qs, [
    { name: "page", value: "2" },
    { name: "limit", value: "50" },
  ]);
});

test("historyEntryToHar emits postData with the JSON mime type for a JSON body", () => {
  const pd = historyEntryToHar(ENTRY).log.entries[0].request.postData;
  assert.equal(pd.mimeType, "application/json");
  assert.equal(pd.text, '{"sku":"A-1","qty":2}');
});

test("historyEntryToHar emits a text mime type for a non-JSON body", () => {
  const har = historyEntryToHar({ ...ENTRY, bodyIsJson: false });
  assert.equal(har.log.entries[0].request.postData.mimeType, "text/plain");
});

test("historyEntryToHar omits postData entirely when there is no payload", () => {
  const har = historyEntryToHar({ ...ENTRY, payload: "" });
  assert.equal(har.log.entries[0].request.postData, undefined);
  assert.equal(har.log.entries[0].request.bodySize, 0);
});

test("historyEntryToHar converts the timestamp to ISO 8601", () => {
  const e = historyEntryToHar(ENTRY).log.entries[0];
  assert.equal(e.startedDateTime, "2026-10-09T07:00:00.000Z");
});

test("historyEntryToHar tolerates a missing or unparseable timestamp", () => {
  assert.equal(historyEntryToHar({ ...ENTRY, timestamp: undefined }).log.entries[0].startedDateTime, null);
  assert.equal(historyEntryToHar({ ...ENTRY, timestamp: "not-a-date" }).log.entries[0].startedDateTime, null);
});

test("historyEntryToHar carries the response sizes it has and defaults the rest", () => {
  const withSizes = historyEntryToHar(ENTRY).log.entries[0].response;
  assert.equal(withSizes.content.size, 1234);
  assert.equal(withSizes.headersSize, 321);

  const without = historyEntryToHar({
    ...ENTRY,
    size: undefined,
    headersSize: undefined,
  }).log.entries[0].response;
  assert.equal(without.content.size, 0);
  assert.equal(without.headersSize, -1);
});

test("historyEntryToHar never invents a response body or status", () => {
  const res = historyEntryToHar(ENTRY).log.entries[0].response;
  assert.equal(res.status, 0);
  assert.deepEqual(res.headers, []);
  assert.equal(res.content.text, undefined);
});

test("historyEntryToHar returns null for non-entry input", () => {
  assert.equal(historyEntryToHar(null), null);
  assert.equal(historyEntryToHar(undefined), null);
  assert.equal(historyEntryToHar("nope"), null);
  assert.equal(historyEntryToHar(42), null);
});

test("historyEntryToHar copes with an entry that has no headers or query params", () => {
  const har = historyEntryToHar({ method: "GET", url: "https://x.test/" });
  assert.deepEqual(har.log.entries[0].request.headers, []);
  assert.deepEqual(har.log.entries[0].request.queryString, []);
  assert.equal(har.log.entries[0].request.method, "GET");
});

test("the synthesised document round-trips through the HAR parser", () => {
  // This is the contract that matters: whatever the Analyzer receives has to be
  // consumable by its own parser.
  const text = JSON.stringify(historyEntryToHar(ENTRY));
  const result = parseHarFile(text);
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.entries.length, 1);

  const e = result.entries[0];
  assert.equal(e.method, "POST");
  assert.equal(e.url, ENTRY.url);
  assert.equal(e.host, "api.example.com");
  assert.equal(e.path, "/v2/orders?page=2&limit=50");
  assert.equal(e.requestBody, '{"sku":"A-1","qty":2}');
  assert.equal(e.requestContentType, "application/json");
  assert.equal(e.responseSize, 1234);
  assert.deepEqual(e.requestHeaders, ENTRY.headers);
});

test("a round-tripped entry survives filtering by method and host", () => {
  const result = parseHarFile(JSON.stringify(historyEntryToHar(ENTRY)));
  const e = result.entries[0];
  assert.equal(e.method, "POST");
  assert.equal(e.host, "api.example.com");
});

// ─── historyToHar — whole-history export ──────────────────────────────────────

const ENTRY_B = {
  ...ENTRY,
  id: "e2",
  url: "https://cdn.example.com/app.js",
  baseUrl: "https://cdn.example.com",
  method: "GET",
  queryParams: [],
  headers: ["Host: cdn.example.com"],
  payload: "",
  bodyIsJson: false,
  size: 4096,
  headersSize: 128,
};

test("historyToHar bundles every entry into one document", () => {
  const doc = historyToHar([ENTRY, ENTRY_B]);
  assert.equal(doc.log.version, "1.2");
  assert.equal(doc.log.entries.length, 2);
  assert.equal(doc.log.entries[0].request.method, "POST");
  assert.equal(doc.log.entries[1].request.method, "GET");
});

test("historyToHar returns null for an empty or invalid list", () => {
  assert.equal(historyToHar([]), null);
  assert.equal(historyToHar(null), null);
  assert.equal(historyToHar(undefined), null);
  assert.equal(historyToHar("nope"), null);
});

test("historyToHar skips entries that cannot be converted", () => {
  const doc = historyToHar([ENTRY, null, "junk", undefined]);
  assert.equal(doc.log.entries.length, 1);
});

test("an exported history round-trips through parseHarFile intact", () => {
  // The contract that matters: what History exports has to be readable by the
  // Analyzer and by the Formatter's HAR import.
  const text = JSON.stringify(historyToHar([ENTRY, ENTRY_B]));
  const result = parseHarFile(text);
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.entries.length, 2);

  const [a, b] = result.entries;
  assert.equal(a.method, "POST");
  assert.equal(a.host, "api.example.com");
  assert.equal(a.requestBody, '{"sku":"A-1","qty":2}');
  assert.equal(a.requestContentType, "application/json");
  assert.equal(b.method, "GET");
  assert.equal(b.host, "cdn.example.com");
  assert.equal(b.requestBody, "");
});

test("an exported history is still valid HAR 1.2 with a log root", () => {
  const doc = historyToHar([ENTRY]);
  assert.ok(doc.log, "has a log root");
  assert.equal(typeof doc.log.creator.name, "string");
  assert.ok(Array.isArray(doc.log.entries));
  // Every entry carries the fields the HAR spec requires.
  for (const e of doc.log.entries) {
    assert.ok(e.request, "entry has a request");
    assert.ok(e.response, "entry has a response");
    assert.equal(typeof e.request.method, "string");
    assert.equal(typeof e.request.url, "string");
  }
});
