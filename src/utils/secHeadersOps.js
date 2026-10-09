// ─── Security header checker ──────────────────────────────────────────────────
// Feed it a block of HTTP *response* headers and it reports which of the
// common browser-security headers are present, missing, or present-but-weak.
//
// This is deliberately separate from `linter.js`, which audits *request*
// headers (missing Content-Type, wildcard CORS, secrets over HTTP). Different
// input, different question.
//
// Pure — no I/O, no globals.

export const SECHEADERS_DESCRIPTION =
  "Check an HTTP response header block against the common security headers (CSP, HSTS, X-Frame-Options, …) — present, missing or misconfigured.";

// Parse a raw header block into a lowercase-keyed map. Tolerates a status line,
// blank lines, CRLF, and folded continuation lines.
export function parseHeaderBlock(raw) {
  if (typeof raw !== "string") return {};
  const out = {};
  let lastKey = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^HTTP\/\d/i.test(line)) continue; // status line
    if (/^[ \t]/.test(line) && lastKey) {
      out[lastKey] += " " + line.trim(); // folded continuation
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (!key) continue;
    out[key] = line.slice(idx + 1).trim();
    lastKey = key;
  }
  return out;
}

const ok = (name, value, note) => ({ name, status: "ok", value, note });
const missing = (name, note) => ({ name, status: "missing", value: null, note });
const weak = (name, value, note) => ({ name, status: "weak", value, note });

export function checkSecurityHeaders(raw) {
  const h = parseHeaderBlock(raw);

  const csp = h["content-security-policy"];
  const hsts = h["strict-transport-security"];
  const xfo = h["x-frame-options"];
  const xcto = h["x-content-type-options"];
  const ref = h["referrer-policy"];
  const pp = h["permissions-policy"] ?? h["feature-policy"];

  const checks = [];

  // ── Content-Security-Policy ──
  if (!csp) {
    checks.push(missing("Content-Security-Policy", "Mitigates XSS and injected content. The strongest single header here."));
  } else if (/\bunsafe-(inline|eval)\b/i.test(csp) || /(^|[\s;])\*([\s;]|$)/.test(csp)) {
    checks.push(weak("Content-Security-Policy", csp, "Contains 'unsafe-inline'/'unsafe-eval' or a wildcard — much of the protection is lost."));
  } else {
    checks.push(ok("Content-Security-Policy", csp, "Present and free of obvious wildcards/unsafe directives."));
  }

  // ── Strict-Transport-Security ──
  if (!hsts) {
    checks.push(missing("Strict-Transport-Security", "Forces HTTPS on future visits. Only meaningful over HTTPS."));
  } else {
    const m = /max-age\s*=\s*(\d+)/i.exec(hsts);
    const age = m ? Number(m[1]) : 0;
    const hasSub = /includeSubDomains/i.test(hsts);
    if (age < 15552000) {
      checks.push(weak("Strict-Transport-Security", hsts, `max-age is ${age}s — under the 180-day (15552000s) recommendation.`));
    } else if (!hasSub) {
      checks.push(weak("Strict-Transport-Security", hsts, "No includeSubDomains — subdomains aren't covered."));
    } else {
      checks.push(ok("Strict-Transport-Security", hsts, "Long max-age with includeSubDomains."));
    }
  }

  // ── X-Frame-Options ──
  if (!xfo) {
    checks.push(missing("X-Frame-Options", "Blocks clickjacking by refusing framing. Superseded by CSP frame-ancestors."));
  } else if (!/^(deny|sameorigin)$/i.test(xfo.trim())) {
    checks.push(weak("X-Frame-Options", xfo, "Should be DENY or SAMEORIGIN — anything else is ignored by browsers."));
  } else {
    checks.push(ok("X-Frame-Options", xfo, "Framing restricted."));
  }

  // ── X-Content-Type-Options ──
  if (!xcto) {
    checks.push(missing("X-Content-Type-Options", "Stops MIME sniffing. The fix is always `nosniff`."));
  } else if (xcto.trim().toLowerCase() !== "nosniff") {
    checks.push(weak("X-Content-Type-Options", xcto, "Only `nosniff` is valid."));
  } else {
    checks.push(ok("X-Content-Type-Options", xcto, "MIME sniffing disabled."));
  }

  // ── Referrer-Policy ──
  if (!ref) {
    checks.push(missing("Referrer-Policy", "Controls how much of the URL leaks to other origins."));
  } else if (/^(unsafe-url|no-referrer-when-downgrade)$/i.test(ref.trim())) {
    checks.push(weak("Referrer-Policy", ref, "This value leaks the full URL — prefer strict-origin-when-cross-origin or no-referrer."));
  } else {
    checks.push(ok("Referrer-Policy", ref, "Referrer leakage limited."));
  }

  // ── Permissions-Policy ──
  if (!pp) {
    checks.push(missing("Permissions-Policy", "Restricts powerful features (camera, geolocation, …) for the page and its frames."));
  } else {
    checks.push(ok("Permissions-Policy", pp, "Feature policy present."));
  }

  const summary = {
    total: checks.length,
    ok: checks.filter((c) => c.status === "ok").length,
    missing: checks.filter((c) => c.status === "missing").length,
    weak: checks.filter((c) => c.status === "weak").length,
  };

  return { headers: h, checks, summary };
}

// Plain-text rendering for the CLI / copy button.
export function formatSecurityReport(report) {
  const icon = { ok: "PASS", missing: "MISS", weak: "WEAK" };
  const pad = Math.max(...report.checks.map((c) => c.name.length));
  const lines = report.checks.map(
    (c) => `[${icon[c.status]}] ${c.name.padEnd(pad)}  ${c.note}`,
  );
  const s = report.summary;
  lines.push("", `${s.ok} ok · ${s.weak} weak · ${s.missing} missing`);
  return lines.join("\n");
}
