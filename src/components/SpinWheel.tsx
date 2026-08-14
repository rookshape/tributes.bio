import { useEffect, useRef } from "react";
import { Wheel } from "spin-wheel/dist/spin-wheel-esm.js";
import type { SpinSlice } from "../lib/types";

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

export function SpinWheel({ slices, animation, onRest }: SpinWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<Wheel | null>(null);
  const playedSpinIdRef = useRef<string | null>(null);
  const onRestRef = useRef(onRest);

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
        labelColor: "#ffffff",
        value: slice.id,
      })),
      borderColor: "#ffffff",
      borderWidth: 5,
      isInteractive: false,
      itemLabelAlign: "right",
      itemLabelFont: "Inter, ui-sans-serif, system-ui, sans-serif",
      itemLabelFontSizeMax: 30,
      itemLabelRadius: 0.78,
      itemLabelRadiusMax: 0.34,
      lineColor: "#ffffff",
      lineWidth: 3,
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

  return (
    <div className="relative aspect-square w-full" aria-label="Spin wheel">
      <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-white drop-shadow-md" />
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
