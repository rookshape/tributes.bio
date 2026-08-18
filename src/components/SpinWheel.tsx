import { useEffect, useRef } from "react";
import { Wheel } from "spin-wheel/dist/spin-wheel-esm.js";
import type { SpinSlice } from "../lib/types";
import { LABEL_OUTLINE, labelColorForSlice, tintFromSlice } from "../lib/wheelPalette";

export type SpinAnimation = {
  id: string;
  selectedIndex: number;
  startedAtMs: number;
  durationMs: number;
};

type SpinWheelProps = {
  slices: SpinSlice[];
  animation?: SpinAnimation | null;
  onRest?: () => void;
};

/** Label placement inside the 100-unit overlay viewBox. */
const LABEL_CENTER = 50;
const LABEL_RADIUS = 33;

export function SpinWheel({ slices, animation, onRest }: SpinWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<Wheel | null>(null);
  const playedSpinIdRef = useRef<string | null>(null);
  const onRestRef = useRef(onRest);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const pointerRef = useRef<HTMLDivElement>(null);

  onRestRef.current = onRest;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || slices.length < 2) {
      return;
    }

    const wheel = new Wheel(container, {
      items: slices.map((slice) => ({
        label: slice.label,
        backgroundColor: slice.color,
        // The canvas draws no text: it builds its font string as
        // `${size}px ${family}`, which cannot express a weight, and it rotates
        // every label with its slice so half of them end up upside down.
        // Labels are drawn in the SVG layer below instead.
        labelColor: "transparent",
        value: slice.id,
      })),
      borderColor: "rgba(15,23,32,0.10)",
      borderWidth: 1,
      isInteractive: false,
      lineColor: "rgba(15,23,32,0.09)",
      lineWidth: 1,
      pointerAngle: 0,
      radius: 0.94,
      onRest: () => onRestRef.current?.(),
    });

    wheelRef.current = wheel;

    if (animation) {
      const elapsed = Math.max(0, Date.now() - animation.startedAtMs);
      const remaining = Math.max(0, animation.durationMs - elapsed);
      wheel.spinToItem(animation.selectedIndex, remaining, true, remaining ? 5 : 0, 1);
      playedSpinIdRef.current = animation.id;
    }

    return () => {
      wheel.remove();
      wheelRef.current = null;
    };
  }, [slices]);

  // Keep the upright labels following the wheel's rotation. Positions are
  // written straight to the DOM so this does not re-render every frame.
  useEffect(() => {
    if (slices.length < 2) return;

    let frame = 0;
    let previousRotation = wheelRef.current?.rotation ?? 0;
    const sliceAngle = 360 / slices.length;

    const followRotation = () => {
      const rotation = wheelRef.current?.rotation ?? 0;

      // The pointer is a flapper resting on the rim: each slice boundary that
      // passes under it knocks it aside, and it springs back. Driving it from
      // the wheel's own rotation means it naturally slows and settles with the
      // wheel instead of running on a timer of its own.
      const pointer = pointerRef.current;

      if (pointer) {
        const degreesPerFrame = Math.abs(rotation - previousRotation);
        const intoSlice = (((rotation / sliceAngle) % 1) + 1) % 1;
        // Full deflection right as a boundary passes, decaying across the slice.
        const kick = Math.max(0, 1 - intoSlice / 0.45);
        // Fades out as the wheel slows so the pointer comes to rest upright.
        const speed = Math.min(1, degreesPerFrame / 5);
        pointer.style.transform = `translateX(-50%) rotate(${13 * kick * speed}deg)`;
      }

      previousRotation = rotation;

      labelRefs.current.forEach((label, index) => {
        if (!label) return;
        const angle = rotation + (index + 0.5) * sliceAngle - 90;
        const radians = (angle * Math.PI) / 180;
        label.setAttribute(
          "x",
          String(LABEL_CENTER + LABEL_RADIUS * Math.cos(radians)),
        );
        label.setAttribute(
          "y",
          String(LABEL_CENTER + LABEL_RADIUS * Math.sin(radians)),
        );
      });

      frame = window.requestAnimationFrame(followRotation);
    };

    frame = window.requestAnimationFrame(followRotation);
    return () => window.cancelAnimationFrame(frame);
  }, [slices]);

  useEffect(() => {
    const wheel = wheelRef.current;

    if (!wheel || !animation || playedSpinIdRef.current === animation.id) {
      return;
    }

    const elapsed = Math.max(0, Date.now() - animation.startedAtMs);
    const remaining = Math.max(0, animation.durationMs - elapsed);
    wheel.spinToItem(animation.selectedIndex, remaining, true, remaining ? 5 : 0, 1);
    playedSpinIdRef.current = animation.id;
  }, [animation]);

  const tint = slices[0] ? tintFromSlice(slices[0].color) : "#ffffff";

  return (
    <div className="relative aspect-square w-full" aria-label="Spin wheel">
      {/* Glass disc framing the wheel, kept narrow so the pointer clears it. */}
      <div className="absolute inset-[2%] rounded-full border border-white/70 bg-white/30 shadow-[0_6px_18px_rgba(15,23,32,0.08)] backdrop-blur-md" />
      {/* Long enough that its tip reaches past the rim into the slice below. */}
      <div
        className="absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[26px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_3px_rgba(15,23,32,0.3)]"
        ref={pointerRef}
        // Pivots where it is pinned to the rim, like a real flapper.
        style={{ transformOrigin: "50% 0" }}
      />
      <div className="absolute inset-[5%]" ref={containerRef} />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5%] z-[5]"
        viewBox="0 0 100 100"
      >
        {slices.map((slice, index) => (
          <text
            dominantBaseline="middle"
            fill={labelColorForSlice(slice.color)}
            fontSize="6.5"
            fontWeight="700"
            paintOrder="stroke"
            stroke={LABEL_OUTLINE}
            strokeLinejoin="round"
            strokeWidth="1"
            key={slice.id}
            ref={(element) => {
              labelRefs.current[index] = element;
            }}
            textAnchor="middle"
          >
            {slice.label}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white">
        {/* Inner disc, tinted towards the wheel's own hue. */}
        <span
          className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_3px_10px_rgba(15,23,32,0.18)]"
          style={{ backgroundColor: tint }}
        />
      </div>
    </div>
  );
}
