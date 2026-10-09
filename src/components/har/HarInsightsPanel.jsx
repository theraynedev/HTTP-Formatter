import { useMemo } from "react";
import { Globe, Clock, Data, AlertCircle } from "reicon-react";
import MethodBadge from "../MethodBadge.jsx";
import {
  formatDuration,
  formatBytes,
  statusColor,
} from "../../utils/harOps";

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, right }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <h2 className="text-xs font-semibold tracking-label uppercase text-fg-subtle">
        {label}
      </h2>
      {right}
      <span className="flex-1 h-px bg-surface-raised" />
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
        {label}
      </p>
      <p className="text-2xl font-mono text-fg font-medium mt-1 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-2xs text-fg-subtle mt-1 font-mono">{sub}</p>
      )}
    </div>
  );
}

// ─── Bar row ────────────────────────────────────────────────────────────────────

function DistBar({ rows, total }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        return (
          <div key={r.label} className="grid grid-cols-[60px_1fr_60px] items-center gap-2">
            <span className={`text-2xs font-mono font-medium ${r.color ?? "text-fg"}`}>
              {r.label}
            </span>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div
                className={`h-full ${r.bar ?? "bg-surface"}`}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <span className="text-2xs font-mono text-fg-muted tabular-nums text-right">
              {r.count} ({pct.toFixed(0)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function HarInsightsPanel({ insights, entries, onSelect }) {
  if (!insights || insights.total === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center">
        <Data size={20} className="mx-auto text-fg-subtle mb-2" />
        <p className="text-xs text-fg-subtle">No data to analyze.</p>
      </div>
    );
  }

  const statusRows = ["2xx", "3xx", "1xx", "4xx", "5xx"]
    .filter((s) => insights.statusDistribution[s] > 0)
    .map((s) => ({
      label: s,
      count: insights.statusDistribution[s],
      color: statusColor(parseInt(s, 10) * 100),
      bar:
        s === "2xx"
          ? "bg-success/60"
          : s === "3xx"
            ? "bg-info/60"
            : s === "4xx"
              ? "bg-warning/60"
              : s === "5xx"
                ? "bg-danger/60"
                : "bg-surface-raised/60",
    }));

  const methodRows = Object.entries(insights.methodDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => ({ label: m, count: c, bar: "bg-surface" }));

  const hostRows = insights.hosts.slice(0, 8).map((h) => ({
    label: h.host,
    count: h.count,
    bar: "bg-surface",
  }));

  return (
    <div className="space-y-6">
      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Entries"
          value={insights.total}
          sub={insights.errored.length > 0 ? `${insights.errored.length} errors` : "all ok"}
        />
        <StatCard
          label="Total time"
          value={formatDuration(insights.totalTime)}
          sub={`avg ${formatDuration(insights.avgTime)}`}
        />
        <StatCard
          label="Total size"
          value={formatBytes(insights.totalBytes)}
          sub={`avg ${formatBytes(insights.avgBytes)}`}
        />
        <StatCard
          label="Hosts"
          value={insights.hosts.length}
          sub={
            insights.hosts.length > 0
              ? insights.hosts[0].host
              : "—"
          }
        />
      </div>

      {/* ── Status distribution ── */}
      <section>
        <SectionHeader label="Status Distribution" />
        <div className="rounded-card border border-line bg-surface p-4">
          <DistBar rows={statusRows} total={insights.total} />
        </div>
      </section>

      {/* ── Method + Hosts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <SectionHeader label="Methods" />
          <div className="rounded-card border border-line bg-surface p-4">
            <DistBar rows={methodRows} total={insights.total} />
          </div>
        </section>
        <section>
          <SectionHeader label="Top Hosts" />
          <div className="rounded-card border border-line bg-surface p-4">
            <DistBar rows={hostRows} total={insights.total} />
          </div>
        </section>
      </div>

      {/* ── Hosts table (size + time) ── */}
      {insights.hosts.length > 0 && (
        <section>
          <SectionHeader label="Hosts Detail" />
          <div className="rounded-card border border-line bg-surface overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface">
                <tr>
                  <Th>Requests</Th>
                  <Th right>Total Time</Th>
                  <Th right>Total Size</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {insights.hosts.map((h) => (
                  <tr key={h.host} className="hover:bg-surface-raised transition">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Globe size={11} className="text-fg-subtle" />
                        <span className="font-mono text-fg truncate">{h.host}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-fg tabular-nums">
                      {h.count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-fg tabular-nums">
                      {formatDuration(h.totalTime)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-fg tabular-nums">
                      {formatBytes(h.totalBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Slow requests ── */}
      {insights.slow.length > 0 && (
        <section>
          <SectionHeader
            label="Slowest Requests"
            right={
              <span className="text-2xs text-fg-subtle font-mono">top 10</span>
            }
          />
          <div className="rounded-card border border-line bg-surface overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface">
                <tr>
                  <Th>Method</Th>
                  <Th>URL</Th>
                  <Th right>Status</Th>
                  <Th right>Time</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {insights.slow.map((e) => (
                  <tr
                    key={e.index}
                    className="hover:bg-surface-raised transition cursor-pointer"
                    onClick={() => onSelect?.(e.index)}
                  >
                    <td className="px-3 py-2"><MethodBadge method={e.method} size="xs" /></td>
                    <td className="px-3 py-2 font-mono text-fg truncate max-w-0">{e.url}</td>
                    <td className={`px-3 py-2 text-right font-mono font-medium tabular-nums ${statusColor(e.status)}`}>
                      {e.status}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-fg tabular-nums">
                      {formatDuration(e.totalTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Errors ── */}
      {insights.errored.length > 0 && (
        <section>
          <SectionHeader
            label="Failed Requests"
            right={
              <span className="text-2xs text-danger font-mono font-medium">
                {insights.errored.length}
              </span>
            }
          />
          <div className="rounded-card border border-danger/20 bg-danger/[0.04] overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-danger/[0.06]">
                <tr>
                  <Th>Method</Th>
                  <Th>URL</Th>
                  <Th right>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-danger/10">
                {insights.errored.slice(0, 50).map((e) => (
                  <tr
                    key={e.index}
                    className="hover:bg-danger/[0.04] transition cursor-pointer"
                    onClick={() => onSelect?.(e.index)}
                  >
                    <td className="px-3 py-2"><MethodBadge method={e.method} size="xs" /></td>
                    <td className="px-3 py-2 font-mono text-fg truncate max-w-0">{e.url}</td>
                    <td className={`px-3 py-2 text-right font-mono font-medium tabular-nums ${statusColor(e.status)}`}>
                      {e.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-3 py-2 text-2xs tracking-label uppercase font-medium text-fg-subtle ${className}`}
    >
      {children}
    </th>
  );
}