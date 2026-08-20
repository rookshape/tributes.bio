/**
 * Where a slice's label sits and how it is turned.
 *
 * Shared because three components draw the same wheel — the live one, the
 * editor's, and the list thumbnail — and a thumbnail whose labels are laid out
 * differently from the wheel it stands for is not a preview of anything.
 *
 * Labels run down the slice rather than across it. Upright labels only ever
 * fitted because six slices left an eighth of the face each; the arc a label
 * has to fit across shrinks as slices are added, while the spoke it can run
 * down does not.
 */

/**
 * Labels are hung off the rim and grow inward, so this is where one *ends*
 * rather than where it is centred. A label centred at mid-radius grows both
 * ways and a long one ("$5 + spin") pushes its outer half over the rim.
 */
const LABEL_RADIUS_FRACTION = 0.88;

/**
 * Above this many slices, labels run down the slice instead of across it.
 *
 * Radial labels exist because upright ones collide once the wheel is busy — the
 * arc a label has to fit across shrinks with every slice added. But they cost
 * something: at six slices the ones at the sides come out level while the ones
 * on the diagonals sit at sixty degrees, and a wheel with room to spare reads
 * as tilted for no reason. Under the threshold there is room, so they stay
 * upright.
 */
const UPRIGHT_MAX_SLICES = 8;

/** Where an upright label sits, as a share of the face. */
const UPRIGHT_RADIUS_FRACTION = 0.66;

/** What limits the type is the width of the slice where the label sits. */
export function labelFontSize(faceRadius: number, sliceCount: number) {
  const ratio = sliceCount > 12 ? 0.108 : sliceCount > 8 ? 0.12 : 0.14;

  return faceRadius * ratio;
}

/**
 * `angleDeg` is the slice's centre in screen terms — 0 pointing right — so
 * callers pass `sliceCentre - 90`.
 */
export function radialLabel(
  center: number,
  faceRadius: number,
  angleDeg: number,
  sliceCount: number,
) {
  const radians = (angleDeg * Math.PI) / 180;

  if (sliceCount <= UPRIGHT_MAX_SLICES) {
    const upright = faceRadius * UPRIGHT_RADIUS_FRACTION;

    return {
      x: center + upright * Math.cos(radians),
      y: center + upright * Math.sin(radians),
      transform: undefined,
      anchor: "middle" as const,
    };
  }

  const radius = faceRadius * LABEL_RADIUS_FRACTION;
  const x = center + radius * Math.cos(radians);
  const y = center + radius * Math.sin(radians);

  // Past the vertical the text would run right to left, so it is turned around
  // and anchored from the other end to stay in the same place.
  const wrapped = ((angleDeg % 360) + 360) % 360;
  const flipped = wrapped > 90 && wrapped < 270;

  return {
    x,
    y,
    transform: `rotate(${flipped ? angleDeg + 180 : angleDeg} ${x} ${y})`,
    anchor: flipped ? ("start" as const) : ("end" as const),
  };
}

/**
 * The same placement, but centred rather than anchored.
 *
 * `text-anchor: end` is what made a radial label grow inward from the rim, and
 * relying on it meant relying on the browser applying an attribute set after
 * render — which Safari did not, so every label grew outward across the rim
 * instead. Given the text's own length there is no need to ask: the midpoint
 * can be worked out, and a label centred on it lands in exactly the same place
 * in every browser.
 */
export function centredSliceLabel(
  center: number,
  faceRadius: number,
  angleDeg: number,
  sliceCount: number,
  textLength: number,
) {
  const radians = (angleDeg * Math.PI) / 180;

  if (sliceCount <= UPRIGHT_MAX_SLICES) {
    const upright = faceRadius * UPRIGHT_RADIUS_FRACTION;

    return {
      x: center + upright * Math.cos(radians),
      y: center + upright * Math.sin(radians),
      rotation: null,
    };
  }

  // Half the text in from where it would have been anchored, which is where its
  // middle sits when it runs from the rim toward the hub.
  const radius = faceRadius * LABEL_RADIUS_FRACTION - textLength / 2;
  const x = center + radius * Math.cos(radians);
  const y = center + radius * Math.sin(radians);
  const wrapped = ((angleDeg % 360) + 360) % 360;
  const flipped = wrapped > 90 && wrapped < 270;

  return {
    x,
    y,
    rotation: flipped ? angleDeg + 180 : angleDeg,
  };
}

/**
 * Vertical centring that every browser actually does.
 *
 * `dominant-baseline: middle` is the obvious way to centre a line of SVG text
 * on its point, and Safari has never supported it reliably — it put the
 * baseline on the point instead, so the glyphs sat above it. On a rotated
 * label "above the baseline" points across the slice rather than up the page,
 * which is what threw every label sideways over its own wedge boundary. A `dy`
 * in ems is understood everywhere and does the same job.
 */
export const LABEL_BASELINE_SHIFT = "0.35em";
