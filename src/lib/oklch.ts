/**
 * OKLCH → sRGB.
 *
 * HSL is not perceptually uniform: holding saturation and lightness fixed while
 * sweeping the hue produces colors of wildly different apparent lightness and
 * colorfulness — yellows and cyans wash out, blues and violets go heavy. That
 * is what made stretches of a hue slider look wrong.
 *
 * OKLCH fixes lightness perceptually, so every hue at the same L and C reads
 * with the same weight. sRGB cannot reach the same chroma at every hue though,
 * so chroma is reduced until the color fits in gamut rather than being clipped,
 * which would otherwise flatten whole stretches of the slider.
 */

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Linear sRGB channels for an OKLCH color. May fall outside [0, 1]. */
function oklchToLinearSrgb(lightness: number, chroma: number, hue: number) {
  const hueRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function inGamut(channels: number[]) {
  return channels.every((channel) => channel >= -0.0001 && channel <= 1.0001);
}

function encodeGamma(channel: number) {
  const value = clamp(channel, 0, 1);
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

/**
 * The highest chroma this hue can hold at this lightness inside sRGB.
 * Binary search, because the gamut boundary has no closed form.
 */
export function maxChroma(lightness: number, hue: number) {
  let low = 0;
  let high = 0.4;

  for (let step = 0; step < 18; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb(lightness, mid, hue))) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/** An OKLCH color as a hex string, with chroma reduced to fit sRGB. */
export function oklchToHex(lightness: number, chroma: number, hue: number) {
  const l = clamp(lightness, 0, 1);
  const h = ((hue % 360) + 360) % 360;
  const c = Math.min(chroma, maxChroma(l, h));
  const channels = oklchToLinearSrgb(l, c, h).map((channel) =>
    Math.round(encodeGamma(channel) * 255),
  );

  return `#${channels
    .map((channel) => clamp(channel, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** `rgb(r g b / a)` for a hex color, for gradient stops that need alpha. */
export function hexWithAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
