import type { RefObject } from "react";
import type { SpinSlice } from "../lib/types";
import {
  DEFAULT_WHEEL_APPEARANCE,
  isLightSlice,
  wheelSliceGlow,
} from "../lib/wheelPalette";

type WheelSliceGlowProps = {
  slices: SpinSlice[];
  wheelHue?: number;
  wheelTone?: number;
  wheelGlow?: boolean;
  /** Centre of the wheel in viewBox units. */
  center: number;
  /** Radius of the wheel face itself, which the glow never runs past. */
  radius: number;
  /** Optional ref on the rotating group — SpinWheel drives this each frame. */
  rotateRef?: RefObject<SVGGElement | null>;
  className?: string;
};

function point(center: number, angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function wedgePath(center: number, startAngle: number, endAngle: number, radius: number) {
  const start = point(center, startAngle, radius);
  const end = point(center, endAngle, radius);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

/**
 * A slow lift on the lighter alternating slices — the whole wedge breathes.
 *
 * Three earlier versions all failed the same way: they put the light somewhere
 * other than across the slice. Two blurred the wedge, which softens *edges* and
 * leaves the interior alone, in a colour no lighter than the slice beneath — so
 * the slice never changed and the only thing that lit up was the seam where the
 * blur crept onto its darker neighbours. The third dropped the blur but graded
 * the wash from hub to rim, which just moved the artefact: a bright arc banding
 * the outer end of every lit slice.
 *
 * The lesson each time was the same, so this version has nowhere left to put a
 * gradient or a blur. One flat fill, the exact shape of the wedge, and the only
 * thing that changes is its opacity.
 */
export function WheelSliceGlow({
  slices,
  wheelHue = DEFAULT_WHEEL_APPEARANCE.hue,
  wheelTone = DEFAULT_WHEEL_APPEARANCE.tone,
  wheelGlow = true,
  center,
  radius,
  rotateRef,
  className = "",
}: WheelSliceGlowProps) {
  if (!wheelGlow || slices.length < 2) return null;

  const appearance = { hue: wheelHue, tone: wheelTone };
  const glow = wheelSliceGlow(appearance);
  const sliceAngle = 360 / slices.length;

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${className}`}
      viewBox={`0 0 ${center * 2} ${center * 2}`}
    >
      <g ref={rotateRef} style={{ transformOrigin: "center" }}>
        {slices.map((slice, index) => {
          if (!isLightSlice(appearance, index, slices.length)) return null;

          const startAngle = index * sliceAngle;

          return (
            <path
              className="animate-wheel-glow"
              d={wedgePath(center, startAngle, startAngle + sliceAngle, radius)}
              fill={glow}
              key={slice.id}
            />
          );
        })}
      </g>
    </svg>
  );
}
