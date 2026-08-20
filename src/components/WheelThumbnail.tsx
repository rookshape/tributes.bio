import { labelFontSize, radialLabel } from "../lib/wheelLabels";
import { labelColorForSlice, tintFromSlice } from "../lib/wheelPalette";
import type { SpinSlice } from "../lib/types";
import { WheelSliceGlow } from "./WheelSliceGlow";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 88;
const HUB = 17;

function point(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

/**
 * Non-interactive wheel for lists and cards. Mirrors what the overlay shows —
 * glass frame, pointer, plain hub — rather than the editor, which carries an
 * add-slice control that means nothing outside the editor.
 */
export function WheelThumbnail({
  slices,
  wheelHue,
  wheelTone,
  wheelGlow = true,
  className,
}: {
  slices: SpinSlice[];
  wheelHue?: number;
  wheelTone?: number;
  wheelGlow?: boolean;
  className?: string;
}) {
  const sliceAngle = 360 / Math.max(1, slices.length);
  const hubTint = slices[0] ? tintFromSlice(slices[0].color) : "#ffffff";
  const labelSize = labelFontSize(RADIUS, slices.length);

  return (
    <div className={`relative aspect-square ${className ?? ""}`}>
      <div className="absolute inset-[1%] rounded-full border border-white/70 bg-white/30 shadow-[0_4px_12px_rgba(15,23,32,0.07)]" />
      <svg
        aria-hidden="true"
        className="relative h-full w-full"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {slices.map((slice, index) => {
          const start = index * sliceAngle;
          const end = start + sliceAngle;
          const from = point(start, RADIUS);
          const to = point(end, RADIUS);

          const label = radialLabel(CENTER, RADIUS, start + sliceAngle / 2 - 90, slices.length);

          return (
            <g key={slice.id}>
              <path
                d={`M ${CENTER} ${CENTER} L ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${
                  sliceAngle > 180 ? 1 : 0
                } 1 ${to.x} ${to.y} Z`}
                fill={slice.color}
              />
              <text
                dominantBaseline="middle"
                fill={labelColorForSlice(slice.color)}
                fontSize={labelSize}
                fontWeight="700"
                textAnchor={label.anchor}
                transform={label.transform}
                x={label.x}
                y={label.y}
              >
                {slice.label}
              </text>
            </g>
          );
        })}
        <WheelSliceGlow
          center={CENTER}
          radius={RADIUS}
          slices={slices}
          wheelGlow={wheelGlow}
          wheelHue={wheelHue}
          wheelTone={wheelTone}
        />
        <circle cx={CENTER} cy={CENTER} fill="#ffffff" r={HUB} />
        <circle cx={CENTER} cy={CENTER} fill={hubTint} r={HUB * 0.84} />
        <path
          d={`M ${CENTER} 24 l -6 -12 h 12 Z`}
          fill="#ffffff"
          style={{ filter: "drop-shadow(0 2px 0 rgba(15,23,32,0.55))" }}
        />
      </svg>
    </div>
  );
}
