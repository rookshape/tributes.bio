import { useEffect, useId, useRef } from "react";
import { Wheel } from "spin-wheel/dist/spin-wheel-esm.js";
import type { SpinSlice } from "../lib/types";
import {
  LABEL_OUTLINE,
  labelColorForSlice,
  tintFromSlice,
  wheelRimInk,
} from "../lib/wheelPalette";
import { WheelSliceGlow } from "./WheelSliceGlow";

export type SpinAnimation = {
  id: string;
  selectedIndex: number;
  startedAtMs: number;
  durationMs: number;
};

type SpinWheelProps = {
  slices: SpinSlice[];
  /** Set into the rim, curved down each side. */
  name?: string;
  /** Hue and tone the rim lettering takes its colour from. */
  wheelHue?: number;
  wheelTone?: number;
  /** Soft animated halo on the lighter alternating slices. */
  wheelGlow?: boolean;
  animation?: SpinAnimation | null;
  onRest?: () => void;
  /** Fires as each slice boundary passes the pointer, for the tick sound. */
  onTick?: () => void;
};

/** Label placement inside the 100-unit overlay viewBox. */
const LABEL_CENTER = 50;
/**
 * Labels are hung off the rim and run inward, so this is where each one *ends*
 * rather than where it is centred. A label centred at mid-radius grows in both
 * directions and a long one ("$5 + spin") pushes its outer half over the rim;
 * anchored at the rim it can only ever grow towards the hub, where there is
 * room.
 */
const LABEL_RADIUS = 41;

export function SpinWheel({
  slices,
  animation,
  name,
  wheelHue = 210,
  wheelTone = 20,
  wheelGlow = true,
  onRest,
  onTick,
}: SpinWheelProps) {
  // Stable per instance: two arcs in one document would otherwise collide.
  const rimId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<Wheel | null>(null);
  const playedSpinIdRef = useRef<string | null>(null);
  const onRestRef = useRef(onRest);
  const onTickRef = useRef(onTick);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const pointerRef = useRef<HTMLDivElement>(null);
  const glowRotateRef = useRef<SVGGElement>(null);
  const glowFilterId = useId().replace(/:/g, "");

  onRestRef.current = onRest;
  onTickRef.current = onTick;

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
    let previousIntoSlice = 0;
    const sliceAngle = 360 / slices.length;

    const followRotation = () => {
      const rotation = wheelRef.current?.rotation ?? 0;

      // The pointer is a flapper resting on the rim: each slice boundary that
      // passes under it knocks it aside, and it springs back. Driving it from
      // the wheel's own rotation means it naturally slows and settles with the
      // wheel instead of running on a timer of its own.
      const pointer = pointerRef.current;

      const degreesPerFrame = Math.abs(rotation - previousRotation);
      const intoSlice = (((rotation / sliceAngle) % 1) + 1) % 1;

      if (pointer) {
        // Full deflection right as a boundary passes, decaying across the slice.
        const kick = Math.max(0, 1 - intoSlice / 0.45);
        // Fades out as the wheel slows so the pointer comes to rest upright.
        const speed = Math.min(1, degreesPerFrame / 5);
        pointer.style.transform = `translateX(-50%) rotate(${13 * kick * speed}deg)`;
      }

      // The phase wrapping is the boundary crossing the pointer, so the ticks
      // land on the same events that deflect it and slow down with the wheel.
      if (degreesPerFrame > 0 && intoSlice < previousIntoSlice) {
        onTickRef.current?.();
      }

      previousIntoSlice = intoSlice;
      previousRotation = rotation;

      if (glowRotateRef.current) {
        glowRotateRef.current.style.transform = `rotate(${rotation}deg)`;
      }

      labelRefs.current.forEach((label, index) => {
        if (!label) return;

        const angle = rotation + (index + 0.5) * sliceAngle - 90;
        const radians = (angle * Math.PI) / 180;
        const x = LABEL_CENTER + LABEL_RADIUS * Math.cos(radians);
        const y = LABEL_CENTER + LABEL_RADIUS * Math.sin(radians);

        // Down the slice rather than across it. Upright labels only ever fitted
        // because six slices left an eighth of the face each; at twelve they
        // collide, and the arc a label has to fit across shrinks as slices are
        // added while the spoke it can run down does not.
        const wrapped = ((angle % 360) + 360) % 360;
        // Past the vertical the text would be running right to left, so it gets
        // turned around and anchored from the other end to stay in place.
        const flipped = wrapped > 90 && wrapped < 270;

        label.setAttribute("x", String(x));
        label.setAttribute("y", String(y));
        label.setAttribute(
          "transform",
          `rotate(${flipped ? angle + 180 : angle} ${x} ${y})`,
        );
        label.setAttribute("text-anchor", flipped ? "start" : "end");
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
  // What limits the type is the width of the slice where the label sits, and
  // that narrows as slices are added.
  const labelSize = slices.length > 12 ? 5 : slices.length > 8 ? 5.6 : 6.5;
  // Pale on purpose. Set into the bezel rather than printed on it, so it stays
  // a shade of the wheel's own hue and never competes with the slice labels.
  const rimInk = wheelRimInk({ hue: wheelHue, tone: wheelTone });

  return (
    <div className="relative aspect-square w-full" aria-label="Spin wheel">
      {/* Glass disc framing the wheel, kept narrow so the pointer clears it. */}
      <div className="absolute inset-[2%] rounded-full border border-white/70 bg-white/30 shadow-[0_6px_18px_rgba(15,23,32,0.08)] backdrop-blur-md" />
      {/* Sized in percentages rather than pixels so the tip reaches the same
          way into the slice at any wheel size. The wheel starts 5% in, so 11%
          leaves the tip sitting just over the colour. */}
      <div
        className="absolute left-1/2 top-0 z-20 h-[11%] w-[6%] -translate-x-1/2 bg-white drop-shadow-[0_2px_4px_rgba(15,23,32,0.35)]"
        ref={pointerRef}
        style={{
          clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          // Pivots where it is pinned to the rim, like a real flapper.
          transformOrigin: "50% 0",
        }}
      />
      {/* The wheel's name on one side of the rim and the wordmark on the
          other. The pointer owns the top, so arcs centred there would run
          underneath it; on the sides both stay clear of it and of each other,
          and each sweeps outward-facing — the right reading top to bottom and
          the left bottom to top, the way a stamped rim reads.

          Radius 43.9 centres the lettering in the white band rather than
          sitting it on the inner edge: the band runs from the wheel face at
          42.3 out to the glass at 48, and glyphs stand off their baseline, so
          the baseline has to sit below the middle for the letters to land on
          it. */}
      {name ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[6]"
          viewBox="0 0 100 100"
        >
          <defs>
            <path d="M 50,6.1 A 43.9,43.9 0 0 1 50,93.9" id={`${rimId}-right`} />
            <path d="M 50,93.9 A 43.9,43.9 0 0 1 50,6.1" id={`${rimId}-left`} />
          </defs>
          {[
            { href: `${rimId}-right`, text: name },
            { href: `${rimId}-left`, text: "tributes.bio" },
          ].map((arc) => (
            <text
              fill={rimInk}
              fontSize="3.5"
              fontWeight="700"
              key={arc.href}
              letterSpacing="0.5"
              opacity="0.85"
            >
              <textPath href={`#${arc.href}`} startOffset="50%" textAnchor="middle">
                {arc.text}
              </textPath>
            </text>
          ))}
        </svg>
      ) : null}
      <div className="absolute inset-[5%]" ref={containerRef} />
      <div className="absolute inset-[5%] z-[4]">
        <WheelSliceGlow
          center={50}
          filterId={glowFilterId}
          // The wheel library draws its face at 0.94 of the box, so anything
          // past this is over the rim rather than over a slice.
          radius={47 * 0.94}
          rotateRef={glowRotateRef}
          slices={slices}
          wheelGlow={wheelGlow}
          wheelHue={wheelHue}
          wheelTone={wheelTone}
        />
      </div>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5%] z-[5]"
        viewBox="0 0 100 100"
      >
        {slices.map((slice, index) => (
          <text
            dominantBaseline="middle"
            fill={labelColorForSlice(slice.color)}
            fontSize={labelSize}
            fontWeight="700"
            paintOrder="stroke"
            stroke={LABEL_OUTLINE}
            strokeLinejoin="round"
            strokeWidth="0.9"
            key={slice.id}
            ref={(element) => {
              labelRefs.current[index] = element;
            }}
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
