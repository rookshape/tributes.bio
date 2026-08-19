/**
 * Overlay appearance, kept separate from the wheel's.
 *
 * The wheel's colors belong to the wheel — a creator swaps wheels mid-stream
 * and the slices change with them. The goal bar, running total, and queue are
 * scene furniture that should stay put, so they carry their own theme and
 * default to plain white rather than borrowing whatever hue the current wheel
 * happens to use.
 *
 * The wheel's own palette stays pastel by design, because twelve saturated
 * slices next to each other is a mess. These panels are single surfaces, so
 * they can take full-strength color — hence the vivid switch.
 */

import { hexWithAlpha, maxChroma, oklchToHex } from "./oklch";

export type OverlayAppearance = {
  /** 0–345 in 15° steps. */
  hue: number;
  /** 0 = white panel with dark text, 100 = dark panel with light text. */
  tone: number;
  /** Full-strength color instead of the pastel band. */
  vivid: boolean;
  /** Marker riding the tip of the goal bar's fill. */
  goalShape: GoalShape;
  /** Rainbow fill instead of a single color. */
  goalRainbow: boolean;
};

export type GoalShape = "circle" | "star" | "heart" | "diamond" | "none";

export const OVERLAY_HUE_STEP = 15;
export const OVERLAY_HUE_MAX = 360 - OVERLAY_HUE_STEP;
export const OVERLAY_TONE_STEP = 5;

export const DEFAULT_OVERLAY_APPEARANCE: OverlayAppearance = {
  // Matches the product's own accent rather than the wheel's default.
  hue: 255,
  tone: 0,
  vivid: false,
  goalShape: "circle",
  goalRainbow: false,
};

export const GOAL_SHAPES: { id: GoalShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "star", label: "Star" },
  { id: "heart", label: "Heart" },
  { id: "diamond", label: "Diamond" },
  { id: "none", label: "None" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export function normalizeOverlayHue(value: unknown) {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_OVERLAY_APPEARANCE.hue;
  return clamp(Math.round(raw / OVERLAY_HUE_STEP) * OVERLAY_HUE_STEP, 0, OVERLAY_HUE_MAX);
}

export function normalizeOverlayTone(value: unknown) {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_OVERLAY_APPEARANCE.tone;
  return clamp(Math.round(raw / OVERLAY_TONE_STEP) * OVERLAY_TONE_STEP, 0, 100);
}

export function isGoalShape(value: unknown): value is GoalShape {
  return GOAL_SHAPES.some((shape) => shape.id === value);
}

/** Panel lightness at which the ink flips from dark to light. */
const INK_CROSSOVER = 0.62;

/**
 * How dark the panel itself sits, 0 = white.
 *
 * The slider steps over the middle of the range on purpose. A panel around
 * 0.5–0.75 lightness is a bad background for any text — neither near-white nor
 * near-black clears 4.5:1 against it — so instead of handing a creator a
 * setting that quietly produces unreadable overlays, the scale runs light,
 * jumps the dead band, and continues dark.
 */
function panelLightness(tone: number) {
  return tone <= 50
    ? lerp(0.99, 0.78, tone / 50)
    : lerp(0.46, 0.22, (tone - 50) / 50);
}

/**
 * Panel surface. At tone 0 this is plain white with the faintest hue in it —
 * the default is meant to disappear against any stream.
 */
export function overlaySurface(appearance: OverlayAppearance, opacity = 0.82) {
  const hue = normalizeOverlayHue(appearance.hue);
  const tone = normalizeOverlayTone(appearance.tone);
  const lightness = panelLightness(tone);
  // A tinted panel takes more chroma as it darkens, or dark tones read as grey.
  const ceiling = maxChroma(lightness, hue);
  const chroma = Math.min(
    ceiling,
    appearance.vivid ? lerp(0.04, 0.13, tone / 100) : lerp(0.005, 0.05, tone / 100),
  );

  // A translucent panel takes on whatever is behind it, and a mid-lightness
  // panel over unknown footage can land either side of the ink's crossover —
  // which is exactly the middle of the slider a creator is most likely to pick.
  // Panels near that point are made almost opaque so the ink choice holds; the
  // light and dark ends stay frosted, where the composite is unambiguous.
  const ambiguity = Math.max(0, 1 - Math.abs(lightness - INK_CROSSOVER) / 0.3);
  const effectiveOpacity = opacity + (0.98 - opacity) * ambiguity;

  return {
    backgroundColor: hexWithAlpha(oklchToHex(lightness, chroma, hue), effectiveOpacity),
    borderColor:
      lightness > INK_CROSSOVER
        ? "rgba(255, 255, 255, 0.85)"
        : "rgba(255, 255, 255, 0.22)",
  };
}

/**
 * The panel colour with no alpha.
 *
 * The cabinet is built from overlapping pieces, and translucent ones compound
 * where they meet — every overlap draws its own seam. The pieces are painted
 * solid and the whole group is faded instead.
 */
export function overlaySurfaceSolid(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const tone = normalizeOverlayTone(appearance.tone);
  const lightness = panelLightness(tone);
  const chroma = Math.min(
    maxChroma(lightness, hue),
    appearance.vivid ? lerp(0.04, 0.13, tone / 100) : lerp(0.005, 0.05, tone / 100),
  );

  return oklchToHex(lightness, chroma, hue);
}

/**
 * Text that stays readable as the panel darkens under it.
 *
 * The switch is driven by the panel's own lightness rather than a tone number,
 * and both inks sit near the ends of the range. A fixed midpoint left the
 * middle of the slider — a mid-grey panel still using dark text — under 4:1,
 * which is exactly where a creator dragging the slider ends up.
 */
export function overlayInk(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const lightness = panelLightness(normalizeOverlayTone(appearance.tone));

  return lightness > INK_CROSSOVER
    ? oklchToHex(0.2, appearance.vivid ? 0.04 : 0.02, hue)
    : oklchToHex(0.98, 0.012, hue);
}

/** The color that carries progress fills, pips, and highlights. */
export function overlayAccent(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const lightness = appearance.vivid ? 0.65 : 0.7;
  const chroma = Math.min(
    maxChroma(lightness, hue),
    appearance.vivid ? 0.26 : 0.12,
  );

  return oklchToHex(lightness, chroma, hue);
}

/**
 * The digit face on the running total's display.
 *
 * Neon and LED read as a hot near-white core with the colour thrown around it,
 * not as a coloured core — colouring the glyph itself just makes it look
 * blurred. The accent does the glowing; this keeps the edges crisp.
 */
export function overlayDigit(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  return oklchToHex(0.97, Math.min(maxChroma(0.97, hue), 0.045), hue);
}

/**
 * The face of a screen: light and tinted, so it lifts off a near-white cabinet
 * rather than sinking into it, and stays light whatever tone the cabinet takes.
 */
export function overlayScreen(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const lightness = 0.9;
  return oklchToHex(
    lightness,
    Math.min(maxChroma(lightness, hue), appearance.vivid ? 0.13 : 0.07),
    hue,
  );
}

/**
 * Figures on that face: a deep shade of the same hue. Kept off pure darkness
 * and given real chroma so it reads as the colour rather than as black — there
 * is contrast to spare against a face this light.
 */
export function overlayScreenInk(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const lightness = 0.4;
  return oklchToHex(
    lightness,
    Math.min(maxChroma(lightness, hue), appearance.vivid ? 0.2 : 0.13),
    hue,
  );
}

/**
 * The glow that travels across an idle slot. Lighter than the accent on
 * purpose — full-strength accent against a pale face reads as a solid blob
 * sliding past rather than as light moving under glass.
 */
export function overlayGlow(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const lightness = 0.82;
  return oklchToHex(
    lightness,
    Math.min(maxChroma(lightness, hue), appearance.vivid ? 0.17 : 0.11),
    hue,
  );
}

/** Deep inset behind the running total's digits, so they read like a display. */
export function overlayDisplay(appearance: OverlayAppearance) {
  const hue = normalizeOverlayHue(appearance.hue);
  const tone = normalizeOverlayTone(appearance.tone);

  return oklchToHex(lerp(0.22, 0.14, tone / 100), appearance.vivid ? 0.06 : 0.03, hue);
}

/**
 * The most saturated form of a hue, and the lightness it lives at.
 *
 * Hues do not share a brightness. Yellow at full strength sits near the top of
 * the lightness range and blue near the bottom, so a rainbow drawn at one fixed
 * lightness drags yellow down into olive and flattens green to a dull sage.
 * Searching each hue for the lightness that carries the most chroma — the cusp
 * of the gamut — gives a rainbow where every band is as bright as that hue can
 * actually be.
 */
const cuspCache = new Map<number, { lightness: number; chroma: number }>();

function hueCusp(hue: number) {
  const key = Math.round(hue);
  const cached = cuspCache.get(key);
  if (cached) return cached;

  let best = { lightness: 0.7, chroma: 0 };
  for (let lightness = 0.35; lightness <= 0.95; lightness += 0.02) {
    const chroma = maxChroma(lightness, hue);
    if (chroma > best.chroma) best = { lightness, chroma };
  }

  cuspCache.set(key, best);
  return best;
}

/** One band of the rainbow, honouring the vivid switch. */
function rainbowColor(hue: number, vivid: boolean) {
  const cusp = hueCusp(hue);

  if (vivid) {
    return oklchToHex(cusp.lightness, cusp.chroma * 0.95, hue);
  }

  // Pastel keeps each hue's own lightness and pulls it towards white, rather
  // than flattening every band onto one lightness.
  const lightness = cusp.lightness + (1 - cusp.lightness) * 0.34;
  return oklchToHex(lightness, Math.min(maxChroma(lightness, hue), cusp.chroma * 0.55), hue);
}

/** Every hue at once, for the goal bar's rainbow fill. */
export function rainbowFill(vivid: boolean) {
  const stops: string[] = [];

  for (let hue = 0; hue <= 360; hue += 20) {
    stops.push(`${rainbowColor(hue % 360, vivid)} ${(hue / 360) * 100}%`);
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * The colour the goal bar's fill has reached at a given progress, so the marker
 * riding the tip can take the colour it is actually sitting on.
 */
export function rainbowColorAt(progress: number, vivid: boolean) {
  const clamped = Math.min(1, Math.max(0, progress));
  return rainbowColor((clamped * 360) % 360, vivid);
}

/** The two colours the marker wears: where it sits, and where it is heading. */
export function markerColors(appearance: OverlayAppearance, progress: number) {
  if (!appearance.goalRainbow) {
    const accent = overlayAccent(appearance);
    return { from: accent, to: accent };
  }

  return {
    from: rainbowColorAt(progress, appearance.vivid),
    // A little way further along the bar, so the marker carries a hint of the
    // colour it is moving towards rather than reading as one flat chip.
    to: rainbowColorAt(progress + 0.09, appearance.vivid),
  };
}

/**
 * Halo behind the marker, only worn while the total is climbing. A permanent
 * glow reads as a lamp sitting behind the shape; a brief one reads as the bar
 * having just moved.
 */
export function markerGlow(color: string) {
  return `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 8px ${color}aa)`;
}

/** Gradient showing every hue available at the current tone. */
export function overlayHueTrack(appearance: OverlayAppearance) {
  const stops: string[] = [];
  for (let hue = 0; hue <= OVERLAY_HUE_MAX; hue += OVERLAY_HUE_STEP) {
    stops.push(
      `${overlayAccent({ ...appearance, hue })} ${(hue / OVERLAY_HUE_MAX) * 100}%`,
    );
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** Gradient from the lightest panel to the darkest at the current hue. */
export function overlayToneTrack(appearance: OverlayAppearance) {
  const stops: string[] = [];
  for (let tone = 0; tone <= 100; tone += 10) {
    const lightness = panelLightness(tone);
    const chroma = Math.min(
      maxChroma(lightness, appearance.hue),
      appearance.vivid ? lerp(0.04, 0.13, tone / 100) : lerp(0.005, 0.05, tone / 100),
    );
    stops.push(`${oklchToHex(lightness, chroma, appearance.hue)} ${tone}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * Marker shapes for the tip of the goal bar, drawn in a 24-unit box. The star
 * and heart use rounded joins so they read as soft at overlay size rather than
 * as spiky clip art.
 */
export const GOAL_SHAPE_PATHS: Record<Exclude<GoalShape, "none">, string> = {
  circle: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z",
  star: "M12 3.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2 6.8 19.1 8 13.3 3.6 9.3l5.9-.7L12 3.2Z",
  heart:
    "M12 20.2S3.8 15.1 3.8 9.6a4.4 4.4 0 0 1 8.2-2.3 4.4 4.4 0 0 1 8.2 2.3c0 5.5-8.2 10.6-8.2 10.6Z",
  diamond: "M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z",
};
