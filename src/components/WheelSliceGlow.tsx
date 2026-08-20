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
  /** Unique per instance: two wheels in one document would share gradient ids. */
  filterId: string;
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
 * Two earlier versions got this wrong in the same way. Both blurred the wedge,
 * which softens *edges* and leaves the interior untouched, and both used a glow
 * colour no lighter than the slice beneath. The result was a slice that never
 * changed and a pair of bright seams where the blur crept onto the darker
 * neighbours either side — light in exactly the places it should not have been.
 *
 * So: no blur. Each lit wedge is painted edge to edge, clipped to nothing but
 * its own shape, and only its opacity animates. The wash is a radial gradient
 * because a flat fill reads as a paint chip; carrying more of it at the rim
 * than at the hub is how a lamp behind the wheel would actually fall.
 */
export function WheelSliceGlow({
  slices,
  wheelHue = DEFAULT_WHEEL_APPEARANCE.hue,
  wheelTone = DEFAULT_WHEEL_APPEARANCE.tone,
  wheelGlow = true,
  center,
  radius,
  rotateRef,
  filterId,
  className = "",
}: WheelSliceGlowProps) {
  if (!wheelGlow || slices.length < 2) return null;

  const appearance = { hue: wheelHue, tone: wheelTone };
  const glow = wheelSliceGlow(appearance);
  const sliceAngle = 360 / slices.length;
  const gradientId = `${filterId}-wash`;

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${className}`}
      viewBox={`0 0 ${center * 2} ${center * 2}`}
    >
      <defs>
        <radialGradient
          cx={center}
          cy={center}
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          r={radius}
        >
          <stop offset="0%" stopColor={glow} stopOpacity="0.35" />
          <stop offset="55%" stopColor={glow} stopOpacity="0.8" />
          <stop offset="100%" stopColor={glow} stopOpacity="1" />
        </radialGradient>
      </defs>
      <g ref={rotateRef} style={{ transformOrigin: "center" }}>
        {slices.map((slice, index) => {
          if (!isLightSlice(appearance, index, slices.length)) return null;

          const startAngle = index * sliceAngle;

          return (
            <path
              className="animate-wheel-glow"
              d={wedgePath(center, startAngle, startAngle + sliceAngle, radius)}
              fill={`url(#${gradientId})`}
              key={slice.id}
            />
          );
        })}
      </g>
    </svg>
  );
}
