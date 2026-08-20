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
 * A slow lift on the lighter alternating slices.
 *
 * It lightens the wedge rather than haloing it: the pale colour is laid over
 * the slice and its opacity breathes, so at peak the slice simply reads a shade
 * brighter. An outward halo was the first attempt and it spilled past the rim
 * as a row of soft blobs sitting on the white — the wheel is a hard-edged disc,
 * so anything escaping its edge reads as a mistake rather than as light.
 *
 * Everything is clipped to the wheel face for that reason, and the blur is only
 * wide enough to keep the wedge edges from looking like a second set of slices.
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
  const clipId = `${filterId}-clip`;

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${className}`}
      viewBox={`0 0 ${center * 2} ${center * 2}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={center} cy={center} r={radius} />
        </clipPath>
        <filter filterUnits="userSpaceOnUse" height={center * 2} id={filterId} width={center * 2} x="0" y="0">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g ref={rotateRef} style={{ transformOrigin: "center" }}>
          {slices.map((slice, index) => {
            if (!isLightSlice(appearance, index, slices.length)) return null;

            const startAngle = index * sliceAngle;

            return (
              <path
                className="animate-wheel-glow"
                // Drawn a shade past the face and clipped back to it, so the
                // blur has something to eat into at the rim instead of fading
                // the wedge out before it gets there.
                d={wedgePath(center, startAngle, startAngle + sliceAngle, radius * 1.06)}
                fill={glow}
                filter={`url(#${filterId})`}
                key={slice.id}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
