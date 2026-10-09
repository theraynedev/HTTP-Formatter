import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronRight, ChevronDown, Copy3, Check, Crosshairs } from "reicon-react";
import { jsonType, isContainer } from "../../utils/jsonOps";

// ─── Tree node ────────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  expanded,
  onToggle,
  loadChildren,
}) {
  const container = isContainer(node.value);
  // Lazy: children are only built when the node is expanded. This is the
  // single biggest perf win for large JSON — without it, building the tree
  // for a multi-MB document walks the whole tree even when only the first
  // level is visible.
  const lazyChildren = useMemo(
    () => (node.__loaded ? node.children : null),
    [node],
  );
  const hasChildren =
    container &&
    (node.__loaded
      ? node.children.length > 0
      : node.__childCount > 0);
  const isOpen = expanded.has(node.path);
  const selected = selectedPath === node.path;

  // Type-specific value preview (shown in the gutter)
  const preview = useMemo(() => formatPreview(node), [node]);

  const handleClick = () => {
    onSelect(node);
    if (hasChildren) {
      // Trigger lazy materialisation on first expansion.
      if (container && !node.__loaded) loadChildren?.(node);
      onToggle(node.path);
    }
  };

  return (
    <div className="text-xs font-mono">
      <div
        onClick={handleClick}
        className={`group flex items-center gap-1.5 py-1 pr-2 rounded-control hover:bg-surface-raised cursor-pointer transition ${
          selected ? "bg-surface-raised ring-1 ring-line" : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {/* Expand chevron (placeholder width when leaf) */}
        <span className="w-3 h-3 inline-flex items-center justify-center shrink-0 text-fg-subtle">
          {hasChildren ? (
            isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : null}
        </span>

        {/* Key */}
        <span
          className={`shrink-0 ${Array.isArray(node.value) ? "text-warning" : node.key === "$" ? "text-fg" : "text-info"}`}
        >
          {node.key}
        </span>

        {/* Index marker for arrays */}
        {Array.isArray(node.value) && node.key !== "$" && (
          <span className="text-fg-subtle shrink-0">[]</span>
        )}

        {/* Separator */}
        <span className="text-fg-subtle">:</span>

        {/* Type + preview */}
        <span className={`shrink-0 ${TYPE_COLOR[node.type]}`}>{node.type}</span>
        {preview && (
          <span className="text-fg-subtle truncate min-w-0">{preview}</span>
        )}
      </div>

      {/* Selected-row action strip */}
      {selected && (
        <div
          className="flex items-center gap-2 my-1 py-1.5 px-2 rounded-control border border-line bg-surface"
          style={{ marginLeft: `${depth * 14 + 4}px` }}
        >
          <Crosshairs size={11} className="text-fg-subtle shrink-0" />
          <code className="text-xs font-mono text-fg truncate flex-1 min-w-0">
            {node.path === "$" ? "(root)" : node.path}
          </code>
          <CopyPathButton path={node.path === "$" ? "$" : node.path} />
        </div>
      )}

      {/* Children (lazy — only materialised when expanded) */}
      {hasChildren && isOpen && lazyChildren && (
        <div>
          {lazyChildren.map((child) => (
            <TreeNode
              key={`${child.path}-${child.key}`}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
              loadChildren={loadChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatPreview(node) {
  const v = node.value;
  if (v === null) return "null";
  if (typeof v === "string") return `"${truncate(v, 40)}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `[${v.length} item${v.length !== 1 ? "s" : ""}]`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    return `{${truncate(keys.join(", "), 40)}}`;
  }
  return "";
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

const TYPE_COLOR = {
  string: "text-success",
  boolean: "text-accent-text",
  number: "text-accent-text",
  null: "text-fg-subtle",
  object: "text-info",
  array: "text-warning",
  undefined: "text-fg-subtle",
};

// ─── Copy path button ─────────────────────────────────────────────────────────

function CopyPathButton({ path }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handle();
      }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-chip border border-line bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-fg text-2xs font-medium transition shrink-0"
    >
      {copied ? <Check size={10} className="text-success" /> : <Copy3 size={10} />}
      {copied ? "Copied" : "Copy path"}
    </button>
  );
}

// ─── Main JsonTree ────────────────────────────────────────────────────────────

export default function JsonTree({ value, onSelectPath }) {
  // Root node is shallow: we know its type, value, and path, but children are
  // NOT eagerly built. They're materialised on demand when the user opens a
  // node (via loadChildren). For a 10MB JSON this turns O(total nodes) into
  // O(visible nodes).
  const [tree, setTree] = useState(() => buildShallowRoot(value));
  const [expanded, setExpanded] = useState(() => initialExpanded(value));
  const [selectedPath, setSelectedPath] = useState(null);

  // Rebuild the shallow tree whenever the underlying value changes. We don't
  // need to walk the whole subtree — just the first level.
  useEffect(() => {
    setTree(buildShallowRoot(value));
    // Reset expansion: old paths may not exist in the new document.
    setExpanded(initialExpanded(value));
  }, [value]);

  const loadChildren = useCallback((node) => {
    setTree((root) => replaceNode(root, node.path, materialize(node)));
  }, []);

  const handleToggle = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelect = (node) => {
    setSelectedPath(node.path);
    onSelectPath?.(node.path === "$" ? "$" : node.path);
  };

  if (!tree) return null;

  return (
    <div className="font-mono">
      <TreeNode
        node={tree}
        depth={0}
        selectedPath={selectedPath}
        onSelect={handleSelect}
        expanded={expanded}
        onToggle={handleToggle}
        loadChildren={loadChildren}
      />
    </div>
  );
}

// ─── Shallow root: first level only ───────────────────────────────────────────

function buildShallowRoot(value) {
  if (value === undefined || value === null) return null;
  const container = isContainer(value);
  return {
    key: "$",
    path: "$",
    type: jsonType(value),
    value,
    // __loaded is false until the user expands the node. We still know the
    // child count so the chevron can render correctly.
    __loaded: !container,
    __childCount: container ? shallowCount(value) : 0,
    children: container
      ? buildShallowChildren(value, "$", Array.isArray(value))
      : [],
  };
}

function buildShallowChildren(value, basePath, isArr) {
  // Build one level deep — but tag every child as not-yet-loaded so its
  // grandchildren won't be processed until expansion.
  const entries = isArr ? value.entries() : Object.entries(value);
  let i = 0;
  const out = [];
  for (const [k, v] of entries) {
    const isContainerVal = isContainer(v);
    const childPath = isArr
      ? `${basePath}[${i}]`
      : /^[A-Za-z_$][\w$]*$/.test(k)
        ? `${basePath}.${k}`
        : `${basePath}["${k}"]`;
    out.push({
      key: isArr ? String(i) : k,
      path: childPath,
      type: jsonType(v),
      value: v,
      __loaded: !isContainerVal,
      __childCount: isContainerVal ? shallowCount(v) : 0,
      children: isContainerVal ? buildShallowChildren(v, childPath, Array.isArray(v)) : [],
    });
    i++;
  }
  return out;
}

function shallowCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

// Walk the tree (which has shallow children) and replace the matching node with
// its fully-materialised version. Lazy: only fires for paths the user opens.
function replaceNode(root, targetPath, replacement) {
  if (root.path === targetPath) return replacement;
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((c) => replaceNode(c, targetPath, replacement)),
  };
}

// Materialise the *immediate* children of a node. Nested containers stay
// lazy (tagged __loaded: false) until the user clicks into them — that's the
// whole point of lazy expansion. We only "load" the first level below the
// clicked node so its row count and previews are real.
function materialize(node) {
  if (!isContainer(node.value)) return node;
  return {
    ...node,
    __loaded: true,
    children: buildFullChildren(node.value, node.path),
  };
}

function buildFullChildren(value, basePath) {
  const isArr = Array.isArray(value);
  const entries = isArr ? value.entries() : Object.entries(value);
  let i = 0;
  const out = [];
  for (const [k, v] of entries) {
    const isContainerVal = isContainer(v);
    const childPath = isArr
      ? `${basePath}[${i}]`
      : /^[A-Za-z_$][\w$]*$/.test(k)
        ? `${basePath}.${k}`
        : `${basePath}["${k}"]`;
    // Nested containers stay lazy until opened; primitives are fully built.
    if (isContainerVal) {
      const childCount = shallowCount(v);
      out.push({
        key: isArr ? String(i) : k,
        path: childPath,
        type: jsonType(v),
        value: v,
        __loaded: false,
        __childCount: childCount,
        children: buildShallowChildren(v, childPath, Array.isArray(v)),
      });
    } else {
      out.push({
        key: isArr ? String(i) : k,
        path: childPath,
        type: jsonType(v),
        value: v,
        __loaded: true,
        __childCount: 0,
        children: [],
      });
    }
    i++;
  }
  return out;
}

function initialExpanded(value) {
  const open = new Set(["$"]);
  if (Array.isArray(value)) {
    const cap = Math.min(value.length, 50);
    for (let i = 0; i < cap; i++) open.add(`$[${i}]`);
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const cap = Math.min(keys.length, 50);
    for (let i = 0; i < cap; i++) {
      const k = keys[i];
      const childPath = /^[A-Za-z_$][\w$]*$/.test(k)
        ? `$.${k}`
        : `$["${k}"]`;
      open.add(childPath);
    }
  }
  return open;
}