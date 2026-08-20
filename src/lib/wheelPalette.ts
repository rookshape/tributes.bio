/**
 * Wheel color system.
 *
 * The creator sets a hue and a light/dark tone, exactly like the bio page, and
 * the wheel alternates between two shades derived from them. Slice labels are a
 * monochrome shade of the slice they sit on, so the wheel reads as one material
 * at overlay size without any per-slice color picking.
 */

import { hexWithAlpha, maxChroma, oklchToHex } from "./oklch";

export type WheelAppearance = {
  /** 0–345 in 15° steps. */
  hue: number;
  /** 0 = lightest, 100 = darkest. */
  tone: number;
  /** Soft animated halo on the lighter alternating slices. */
  glow?: boolean;
};

export const WHEEL_HUE_STEP = 15;
export const WHEEL_HUE_MAX = 360 - WHEEL_HUE_STEP;
export const WHEEL_TONE_STEP = 5;

export const DEFAULT_WHEEL_APPEARANCE: WheelAppearance = {
  hue: 210,
  tone: 20,
  glow: true,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export function normalizeWheelHue(value: unknown) {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_WHEEL_APPEARANCE.hue;
  return clamp(Math.round(raw / WHEEL_HUE_STEP) * WHEEL_HUE_STEP, 0, WHEEL_HUE_MAX);
}

export function normalizeWheelTone(value: unknown) {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_WHEEL_APPEARANCE.tone;
  return clamp(Math.round(raw / WHEEL_TONE_STEP) * WHEEL_TONE_STEP, 0, 100);
}

/** Glow is on by default; only an explicit false turns it off. */
export function normalizeWheelGlow(value: unknown) {
  return value !== false;
}

/**
 * The two alternating shades. Saturation stays inside a pastel band so no
 * tone setting produces a harsh wheel.
 */
/** Lightness of the lighter of the two alternating slices. */
function lightSliceLightness(tone: number) {
  return lerp(0.93, 0.52, tone / 100);
}

export function wheelTones(appearance: WheelAppearance): [string, string] {
  const hue = normalizeWheelHue(appearance.hue);
  const tone = normalizeWheelTone(appearance.tone);
  const chroma = lerp(0.075, 0.058, tone / 100);
  const lightA = lightSliceLightness(tone);
  const lightB = clamp(lightA - 0.07, 0.1, 1);

  return [oklchToHex(lightA, chroma, hue), oklchToHex(lightB, chroma, hue)];
}

/**
 * The color for the slice at `index`. With an odd slice count the first and
 * last would otherwise touch and share a shade, so the final slice borrows the
 * opposite one.
 */
export function sliceColor(appearance: WheelAppearance, index: number, total: number) {
  const tones = wheelTones(appearance);
  if (total > 2 && total % 2 === 1 && index === total - 1) return tones[1];
  return tones[index % 2];
}

/** Colors for a whole wheel, in slice order. */
export function sliceColors(appearance: WheelAppearance, total: number) {
  return Array.from({ length: total }, (_, index) =>
    sliceColor(appearance, index, total),
  );
}

/**
 * Whether a slice wears the lighter of the two alternating shades. Matches
 * sliceColor so glow lands on the pale wedges only.
 */
export function isLightSlice(appearance: WheelAppearance, index: number, total: number) {
  if (total > 2 && total % 2 === 1 && index === total - 1) return false;
  return index % 2 === 0;
}

/**
 * Halo colour for the lighter slices — a touch brighter than the slice itself
 * so the glow reads as light behind the wedge rather than as a second fill.
 */
/**
 * The colour the lit slices are washed with.
 *
 * It has to be measurably lighter than the slice underneath or the glow does
 * nothing where it is meant to. The first version derived its own lightness
 * curve and landed within 0.005 of the light slice's, so the wash was invisible
 * on the slice and the only place it showed was where the blur crept onto the
 * dark neighbours — reading as a glowing seam between slices rather than a lit
 * slice. Deriving it from the slice's own lightness keeps the lift guaranteed.
 */
export function wheelSliceGlow(appearance: WheelAppearance) {
  const hue = normalizeWheelHue(appearance.hue);
  const tone = normalizeWheelTone(appearance.tone);
  const lightness = Math.min(0.97, lightSliceLightness(tone) + 0.11);
  const chroma = lerp(0.075, 0.06, tone / 100);

  return oklchToHex(
    lightness,
    Math.min(maxChroma(lightness, hue), chroma),
    hue,
  );
}

/**
 * Lettering set into the white rim.
 *
 * Kept pale and low-contrast so it reads as part of the bezel rather than as a
 * caption printed on top of it.
 */
export function wheelRimInk(appearance: WheelAppearance) {
  const hue = normalizeWheelHue(appearance.hue);
  const tone = normalizeWheelTone(appearance.tone);
  // Barely tinted, and mostly independent of tone: the rim stays white however
  // dark the slices get, so lettering that tracked the slices would drift out
  // of step with what it is actually sitting on.
  const lightness = lerp(0.82, 0.76, tone / 100);
  const chroma = 0.014;

  return oklchToHex(
    lightness,
    Math.min(maxChroma(lightness, hue), chroma),
    hue,
  );
}

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb) {
  const channel = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string) {
  const { r, g, b } = parseHex(hex);
  const linear = [r, g, b].map((raw) => {
    const channel = raw / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function mix(hex: string, target: Rgb, amount: number) {
  const { r, g, b } = parseHex(hex);
  return toHex({
    r: r + (target.r - r) * amount,
    g: g + (target.g - g) * amount,
    b: b + (target.b - b) * amount,
  });
}

/**
 * Labels are always a near-white tinted with the slice's own hue — never dark,
 * at any tone. On pale slices the thin outline below carries legibility instead.
 */
export function labelColorForSlice(sliceHex: string) {
  return mix(sliceHex, { r: 255, g: 255, b: 255 }, 0.88);
}

/** Soft dark outline that keeps near-white labels legible on pale slices. */
export const LABEL_OUTLINE = "rgba(15, 23, 32, 0.26)";

/** A very pale version of a slice color, for the wheel hub and glass tints. */
export function tintFromSlice(sliceHex: string, amount = 0.9) {
  return mix(sliceHex, { r: 255, g: 255, b: 255 }, amount);
}

/** A saturated version of the wheel's hue, for progress fills. */
export function wheelAccent(appearance: WheelAppearance) {
  return oklchToHex(0.62, 0.15, normalizeWheelHue(appearance.hue));
}

/** Readable text over the wheel's glass panels, kept in the wheel's own hue. */
export function wheelInk(appearance: WheelAppearance) {
  return oklchToHex(0.32, 0.05, normalizeWheelHue(appearance.hue));
}

/**
 * Light frosted glass for overlay panels and the wheel frame, tinted a little
 * towards the wheel's hue so the pieces read as one set.
 */
export function wheelGlass(appearance: WheelAppearance, opacity = 0.58) {
  const hue = normalizeWheelHue(appearance.hue);
  return {
    backgroundColor: hexWithAlpha(oklchToHex(0.97, 0.02, hue), opacity),
    borderColor: "rgba(255, 255, 255, 0.85)",
  };
}

/** Hairline between slices, derived from the slice color rather than fixed white. */
export function sliceLineColor(sliceHex: string) {
  return relativeLuminance(sliceHex) > 0.45
    ? mix(sliceHex, { r: 0, g: 0, b: 0 }, 0.12)
    : mix(sliceHex, { r: 255, g: 255, b: 255 }, 0.18);
}

/** Gradient showing every hue available at the current tone. */
export function wheelHueTrack(tone: number) {
  const stops: string[] = [];
  for (let hue = 0; hue <= WHEEL_HUE_MAX; hue += WHEEL_HUE_STEP) {
    stops.push(
      `${wheelTones({ hue, tone })[0]} ${(hue / WHEEL_HUE_MAX) * 100}%`,
    );
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** Gradient from lightest to darkest at the current hue. */
export function wheelToneTrack(hue: number) {
  const stops: string[] = [];
  for (let tone = 0; tone <= 100; tone += 20) {
    stops.push(`${wheelTones({ hue, tone })[0]} ${tone}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
