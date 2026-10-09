/**
 * Design tokens — Violet Issue.
 *
 * Every colour is a CSS custom property holding space-separated RGB channels,
 * so Tailwind's opacity modifiers (`bg-accent/10`, `border-line`) keep working
 * in both themes. The values themselves live in src/index.css.
 *
 * Rule: never hardcode a colour in a component. `bg-white/5` and `text-gray-500`
 * are dark-only and were exactly what broke light mode.
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Elevation — layered backgrounds, never shadows
        canvas: token("--c-canvas"),
        surface: {
          DEFAULT: token("--c-surface"),
          raised: token("--c-surface-raised"),
          overlay: token("--c-surface-overlay"),
        },
        // Borders — subtle dividers and panel edges
        line: {
          DEFAULT: token("--c-line"),
          strong: token("--c-line-strong"),
        },
        // Text — three steps, that is all the system allows
        fg: {
          DEFAULT: token("--c-fg"),
          muted: token("--c-fg-muted"),
          subtle: token("--c-fg-subtle"),
        },
        // Accent — strictly an accent; never a large background fill.
        // `accent` = fill (dark enough for white text on it),
        // `accent-text` = readable accent for text/icons on a surface.
        accent: {
          DEFAULT: token("--c-accent"),
          hover: token("--c-accent-hover"),
          text: token("--c-accent-text"),
        },
        // Functional colour
        info: token("--c-info"),
        success: token("--c-success"),
        warning: token("--c-warning"),
        danger: token("--c-danger"),
        mutation: token("--c-mutation"),
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },

      // The spec's scale: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32 / 40.
      // Optimised for a 14px base, where Inter renders with maximum clarity.
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.5" }],
        lg: ["16px", { lineHeight: "1.45" }],
        xl: ["20px", { lineHeight: "1.35" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
        "3xl": ["32px", { lineHeight: "1.25" }],
        "4xl": ["40px", { lineHeight: "1.2" }],
      },

      // 4px chips · 6px controls · 8px cards · 12px modals
      borderRadius: {
        chip: "4px",
        control: "6px",
        card: "8px",
        panel: "12px",
      },

      // No heavy shadows — depth comes from layered backgrounds. Only modals
      // get a shadow, plus the accent glow behind focused/selected elements.
      boxShadow: {
        pop: "0 24px 48px rgb(0 0 0 / 0.4)",
        glow: "0 0 24px rgb(var(--c-glow) / 0.15)",
      },

      letterSpacing: {
        tight: "-0.03em",
        label: "0.05em",
      },

      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "toast-in": "toast-in 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
