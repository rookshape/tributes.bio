import { Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { MAX_WHEEL_SLICES } from "../lib/spin";
import { LABEL_BASELINE_SHIFT, labelFontSize, radialLabel } from "../lib/wheelLabels";
import type { SpinSlice } from "../lib/types";
import { LABEL_OUTLINE, labelColorForSlice, tintFromSlice } from "../lib/wheelPalette";
import { WheelSliceGlow } from "./WheelSliceGlow";

type EditableSpinWheelProps = {
  slices: SpinSlice[];
  selectedSliceId: string;
  wheelHue: number;
  wheelTone: number;
  wheelGlow: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
};

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 188;
const HUB_RADIUS = 34;

function point(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

function wedgePath(startAngle: number, endAngle: number) {
  const start = point(startAngle, RADIUS);
  const end = point(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function EditableSpinWheel({
  slices,
  selectedSliceId,
  wheelHue,
  wheelTone,
  wheelGlow,
  onAdd,
  onSelect,
}: EditableSpinWheelProps) {
  const sliceAngle = 360 / slices.length;
  const hubTint = slices[0] ? tintFromSlice(slices[0].color) : "#ffffff";
  const labelSize = labelFontSize(RADIUS, slices.length);

  const selectWithKeyboard = (event: KeyboardEvent<SVGPathElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* Glass disc framing the wheel. */}
      <div className="absolute inset-[1%] rounded-full border border-white/70 bg-white/30 shadow-[0_6px_18px_rgba(15,23,32,0.07)] backdrop-blur-md" />
      <svg
        aria-label="Editable wheel. Select a slice to change it."
        className="relative h-full w-full"
        role="group"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <defs>
          <filter height="200%" id="hub-shadow" width="200%" x="-50%" y="-50%">
            <feDropShadow
              dx="0"
              dy="2"
              floodColor="#0f1720"
              floodOpacity="0.2"
              stdDeviation="3"
            />
          </filter>
          <filter height="200%" id="slice-lift" width="200%" x="-50%" y="-50%">
            <feDropShadow
              dx="0"
              dy="3"
              floodColor="#0f1720"
              floodOpacity="0.26"
              stdDeviation="5"
            />
          </filter>
        </defs>

        {slices.map((slice, index) => {
          const startAngle = index * sliceAngle;
          const endAngle = startAngle + sliceAngle;
          const labelPosition = radialLabel(
            CENTER,
            RADIUS,
            startAngle + sliceAngle / 2 - 90,
            slices.length,
          );
          const selected = slice.id === selectedSliceId;
          const path = wedgePath(startAngle, endAngle);

          return (
            <g key={slice.id}>
              {/* Selection lifts the slice with a shadow and a thin border;
                  the fill itself is left alone. */}
              <path
                aria-label={`Edit ${slice.label} slice`}
                className="cursor-pointer outline-none"
                d={path}
                fill={slice.color}
                filter={selected ? "url(#slice-lift)" : undefined}
                onClick={() => onSelect(slice.id)}
                onKeyDown={(event) => selectWithKeyboard(event, slice.id)}
                role="button"
                tabIndex={0}
              />
              {selected ? (
                <path
                  className="pointer-events-none animate-slice-pulse"
                  d={path}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ) : null}
              <text
                className="pointer-events-none select-none font-bold"
                dy={LABEL_BASELINE_SHIFT}
                fill={labelColorForSlice(slice.color)}
                paintOrder="stroke"
                stroke={LABEL_OUTLINE}
                strokeLinejoin="round"
                fontSize={labelSize}
                strokeWidth="2"
                textAnchor={labelPosition.anchor}
                transform={labelPosition.transform}
                x={labelPosition.x}
                y={labelPosition.y}
              >
                {slice.label}
              </text>
            </g>
          );
        })}

        {/* Over the slices, not under them: painted first it was covered by
            every wedge in turn and nothing of it ever reached the screen. */}
        <WheelSliceGlow
          center={CENTER}
          radius={RADIUS}
          slices={slices}
          wheelGlow={wheelGlow}
          wheelHue={wheelHue}
          wheelTone={wheelTone}
        />

        <circle cx={CENTER} cy={CENTER} fill="#ffffff" r={HUB_RADIUS} />
        {/* Inner disc, tinted towards the wheel's own hue. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          fill={hubTint}
          filter="url(#hub-shadow)"
          r={HUB_RADIUS * 0.84}
        />
      </svg>

      <button
        aria-label="Add two wheel slices"
        className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-content-muted transition-colors duration-fast hover:text-content disabled:opacity-40"
        disabled={slices.length + 2 > MAX_WHEEL_SLICES}
        onClick={onAdd}
        title="Add two slices"
        type="button"
      >
        <Plus size={20} strokeWidth={1.8} />
      </button>
    </div>
  );
}
