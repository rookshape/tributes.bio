/**
 * Public page theming.
 *
 * A creator sets two values — a hue and a light/dark tone — and every other
 * color on the page is derived from them in OKLCH, so every hue lands at the
 * same perceived lightness instead of some washing out and others going heavy.
 * Chroma is clamped to a pastel band and the hue slider is stepped rather than
 * continuous, so there is no setting that produces a harsh or unreadable page.
 *
 * Glass surfaces are not fixed per theme. They read the lightness of the
 * background behind them and pick their own tint and opacity, the way a system
 * material adapts to whatever it sits on. That keeps link buttons legible even
 * at mid-tones, where neither a white nor a black frosting works on its own.
 */

import { hexWithAlpha, oklchToHex } from "./oklch";

export type PageAppearance = {
  /** 0–345 in 15° steps. */
  hue: number;
  /** 0 = lightest, 100 = darkest. */
  tone: number;
};

export const HUE_STEP = 15;
export const HUE_MAX = 360 - HUE_STEP;
export const TONE_STEP = 5;

export const DEFAULT_APPEARANCE: PageAppearance = { hue: 210, tone: 15 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export function normalizeHue(value: unknown) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_APPEARANCE.hue;
  return clamp(Math.round(raw / HUE_STEP) * HUE_STEP, 0, HUE_MAX);
}

export function normalizeTone(value: unknown) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_APPEARANCE.tone;
  return clamp(Math.round(raw / TONE_STEP) * TONE_STEP, 0, 100);
}

export function normalizeAppearance(value: unknown): PageAppearance {
  const source = (value ?? {}) as Partial<PageAppearance>;
  return { hue: normalizeHue(source.hue), tone: normalizeTone(source.tone) };
}

/** Perceptual lightness at the top of the gradient, 0–1, for a given tone. The
 *  dark end stops short of black to leave room for the drop beneath it. */
function topLightness(tone: number) {
  return lerp(0.98, 0.36, tone / 100);
}

/** Chroma stays inside a pastel band at both ends of the tone range. */
function backgroundChroma(tone: number) {
  return lerp(0.055, 0.045, tone / 100);
}

export type PageTheme = {
  hue: number;
  tone: number;
  /** Full-page CSS background. */
  background: string;
  /** Perceptual lightness of the surface buttons sit on, 0–1. */
  surfaceLightness: number;
  text: string;
  /** Whether content over the background should read as dark-on-light. */
  scheme: "light" | "dark";
  accent: string;
  accentText: string;
};

/** Both ends share the base hue; the gradient reads through brightness alone. */
const GRADIENT_LIGHTNESS_DROP = 0.26;

export function derivePageTheme(appearance: unknown): PageTheme {
  const { hue, tone } = normalizeAppearance(appearance);
  const chroma = backgroundChroma(tone);
  const top = topLightness(tone);
  const bottom = clamp(top - GRADIENT_LIGHTNESS_DROP, 0.08, 1);
  // Buttons sit in the region the top color holds, so contrast decisions are
  // weighted towards it rather than taking a flat midpoint.
  const surfaceLightness = top * 0.85 + bottom * 0.15;
  const scheme: "light" | "dark" = surfaceLightness > 0.62 ? "light" : "dark";

  const topColor = oklchToHex(top, chroma, hue);
  const bottomColor = oklchToHex(bottom, chroma, hue);
  const fadingTop = (alpha: number) => hexWithAlpha(topColor, alpha);

  // Eased alpha stops rather than a single hard falloff, so the blend reads as
  // one long ramp instead of a visible edge. The last stop fades to the top
  // color at zero alpha, not `transparent` — fading to `transparent` would
  // interpolate through transparent black and grey out the middle.
  const falloff = [
    `${topColor} 0%`,
    `${topColor} 32%`,
    `${fadingTop(0.92)} 48%`,
    `${fadingTop(0.72)} 62%`,
    `${fadingTop(0.44)} 76%`,
    `${fadingTop(0.18)} 89%`,
    `${fadingTop(0)} 100%`,
  ].join(", ");

  return {
    hue,
    tone,
    // The lighter shade is an ellipse centred above the page, so it reaches
    // furthest down through the middle. The darker shade is left banking up the
    // left and right edges and dipping at the centre.
    background: `radial-gradient(160% 125% at 50% -25%, ${falloff}), ${bottomColor}`,
    surfaceLightness,
    // Text is a deep or pale version of the page's own hue, never black or
    // white, so labels sit in the same color family as the background.
    text:
      scheme === "light"
        ? oklchToHex(0.3, 0.07, hue)
        : oklchToHex(0.95, 0.03, hue),
    scheme,
    accent:
      scheme === "light"
        ? oklchToHex(0.55, 0.15, hue)
        : oklchToHex(0.8, 0.13, hue),
    accentText:
      scheme === "light"
        ? oklchToHex(0.98, 0.02, hue)
        : oklchToHex(0.25, 0.06, hue),
  };
}

/**
 * Frosting for buttons and cards. Mid-tone backgrounds get a more opaque
 * surface, because a barely-there tint has nothing to contrast against there.
 */
export function glassSurface(theme: PageTheme) {
  const midness = 1 - Math.abs(theme.surfaceLightness - 0.62) / 0.62;

  return theme.scheme === "light"
    ? {
        backgroundColor: `rgba(255, 255, 255, ${(0.5 + 0.32 * midness).toFixed(3)})`,
        borderColor: "rgba(255, 255, 255, 0.9)",
        color: theme.text,
      }
    : {
        backgroundColor: `rgba(255, 255, 255, ${(0.12 + 0.16 * midness).toFixed(3)})`,
        borderColor: `rgba(255, 255, 255, ${(0.24 + 0.14 * midness).toFixed(3)})`,
        color: theme.text,
      };
}

/** A slightly stronger frosting, for the surface a form sits on. */
export function glassPanelSurface(theme: PageTheme) {
  const surface = glassSurface(theme);
  return { backgroundColor: surface.backgroundColor, borderColor: surface.borderColor };
}

/** Preview swatch for a hue/tone pair, used by the sliders. */
export function swatchFor(hue: number, tone: number) {
  return oklchToHex(topLightness(tone), backgroundChroma(tone), hue);
}

/** Gradient showing every hue available at the current tone. */
export function hueTrack(tone: number) {
  const stops: string[] = [];
  for (let hue = 0; hue <= HUE_MAX; hue += HUE_STEP) {
    stops.push(`${swatchFor(hue, tone)} ${(hue / HUE_MAX) * 100}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** Gradient from lightest to darkest at the current hue. */
export function toneTrack(hue: number) {
  const stops: string[] = [];
  for (let tone = 0; tone <= 100; tone += 20) {
    stops.push(`${swatchFor(hue, tone)} ${tone}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
