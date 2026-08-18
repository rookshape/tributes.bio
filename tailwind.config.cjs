/** @type {import('tailwindcss').Config} */

// Every color is stored as a bare RGB triplet in a CSS variable so Tailwind's
// opacity modifiers (`bg-surface/60`) keep working, and so a themed wrapper
// could repaint a subtree later. See src/styles.css for the values.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          sunken: token("surface-sunken"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        content: {
          DEFAULT: token("content"),
          muted: token("content-muted"),
          subtle: token("content-subtle"),
        },
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          contrast: token("accent-contrast"),
        },
        positive: token("positive"),
        caution: token("caution"),
        critical: token("critical"),
      },
      borderRadius: {
        control: "10px",
        card: "14px",
        panel: "18px",
      },
      boxShadow: {
        // Deliberately shallow. Separation comes from hairline borders, not depth.
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        focus: "0 0 0 3px rgb(var(--accent) / 0.32)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        micro: ["11px", { lineHeight: "16px", letterSpacing: "0.04em" }],
        caption: ["12px", { lineHeight: "16px" }],
        detail: ["13px", { lineHeight: "20px" }],
        body: ["14px", { lineHeight: "22px" }],
        lead: ["16px", { lineHeight: "26px" }],
        title: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        headline: ["26px", { lineHeight: "34px", letterSpacing: "-0.015em" }],
        display: ["38px", { lineHeight: "44px", letterSpacing: "-0.022em" }],
        hero: ["56px", { lineHeight: "60px", letterSpacing: "-0.03em" }],
        "hero-lg": ["76px", { lineHeight: "80px", letterSpacing: "-0.035em" }],
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        exit: "var(--ease-exit)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "slice-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.95" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-base) var(--ease-standard) both",
        "rise-in": "rise-in var(--duration-slow) var(--ease-standard) both",
        "scale-in": "scale-in var(--duration-base) var(--ease-standard) both",
        shimmer: "shimmer 1.6s linear infinite",
        "slice-pulse": "slice-pulse 3.2s var(--ease-standard) infinite",
      },
    },
  },
  plugins: [],
};
