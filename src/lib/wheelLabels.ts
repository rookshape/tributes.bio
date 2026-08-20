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

/** What limits the type is the width of the slice where the label sits. */
export function labelFontSize(faceRadius: number, sliceCount: number) {
  const ratio = sliceCount > 12 ? 0.108 : sliceCount > 8 ? 0.12 : 0.14;

  return faceRadius * ratio;
}

/**
 * `angleDeg` is the slice's centre in screen terms — 0 pointing right — so
 * callers pass `sliceCentre - 90`.
 */
export function radialLabel(center: number, faceRadius: number, angleDeg: number) {
  const radius = faceRadius * LABEL_RADIUS_FRACTION;
  const radians = (angleDeg * Math.PI) / 180;
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
