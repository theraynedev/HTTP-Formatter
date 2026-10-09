// ─── Skeleton ─────────────────────────────────────────────────────────────────
// Neutral placeholders for content that isn't ready yet. They reuse the same
// layered surfaces as the real content so the swap is quiet, and the only
// motion is Tailwind's `animate-pulse` — no spinners, no shadows (depth in this
// design system comes from layered backgrounds, not elevation).
//
// Wrap a group in <SkeletonGroup> so assistive tech announces the wait once
// instead of reading every grey bar.

export function SkeletonGroup({ label = "Loading…", className = "", children }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A single grey block. Size it with the usual width/height utilities. */
export function Skeleton({ className = "" }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-control bg-surface-raised ${className}`} />
  );
}

/** A paragraph's worth of lines; the last one is short so it reads as text. */
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-chip bg-surface-raised"
          style={{ width: i === lines - 1 ? "62%" : `${100 - (i % 3) * 8}%` }}
        />
      ))}
    </div>
  );
}

/** Stand-in for a stacked list of cards (History). */
export function SkeletonCards({ count = 3, className = "" }) {
  return (
    <div aria-hidden="true" className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-0 rounded-card border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 animate-pulse rounded-chip bg-surface-raised" />
            <div className="h-3.5 w-40 max-w-[60%] animate-pulse rounded-chip bg-surface-raised" />
            <div className="ml-auto h-6 w-20 animate-pulse rounded-control bg-surface-raised" />
          </div>
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded-chip bg-surface-raised" />
          <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded-chip bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}

/** Stand-in for a fixed-width column of rows (entry lists, tables). */
export function SkeletonRows({ rows = 6, className = "" }) {
  return (
    <div aria-hidden="true" className={`divide-y divide-line ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <div className="h-4 w-[52px] shrink-0 animate-pulse rounded-chip bg-surface-raised" />
          <div className="h-3.5 w-[40px] shrink-0 animate-pulse rounded-chip bg-surface-raised" />
          <div
            className="h-3.5 animate-pulse rounded-chip bg-surface-raised"
            style={{ width: `${58 - (i % 3) * 10}%` }}
          />
          <div className="ml-auto h-3 w-[46px] shrink-0 animate-pulse rounded-chip bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}
