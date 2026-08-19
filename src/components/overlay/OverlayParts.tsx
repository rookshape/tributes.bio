import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SpinWheel, type SpinAnimation } from "../SpinWheel";
import {
  GOAL_SHAPE_PATHS,
  overlayAccent,
  overlayDigit,
  overlayDisplay,
  overlayInk,
  overlaySurface,
  markerColors,
  markerGlow,
  rainbowFill,
  type OverlayAppearance,
} from "../../lib/overlayTheme";
import { formatMoney } from "../../lib/money";
import type { SpinConfig, SpinQueueEntry, SpinState } from "../../lib/types";

/**
 * The overlay is three independent pieces so a streamer can place each one as
 * its own OBS browser source and position them separately over their scene.
 *
 * The wheel carries its own colors, because they change with the wheel. The
 * other three share one overlay theme the creator sets separately, so scene
 * furniture stays put when a viewer buys a different wheel.
 */
export type OverlayPart = "wheel" | "total" | "bar" | "queue";

/** Matches the marker-pulse keyframe in styles.css. */
const MARKER_PULSE_MS = 900;

/** Matches the handle-pull keyframe in styles.css. */
const LEVER_PULL_MS = 700;

export const OVERLAY_PARTS: {
  id: OverlayPart;
  label: string;
  hint: string;
  /** Browser-source size that fits the component without cropping it. */
  size: { width: number; height: number };
}[] = [
  {
    id: "wheel",
    label: "Wheel",
    hint: "The wheel and its result",
    size: { width: 520, height: 520 },
  },
  {
    id: "total",
    label: "Running total",
    hint: "The tab climbing as they spin",
    size: { width: 420, height: 240 },
  },
  {
    id: "bar",
    label: "Progress bar",
    hint: "Tribute Goal progress",
    size: { width: 600, height: 120 },
  },
  {
    id: "queue",
    label: "Queue",
    hint: "Who is waiting to spin",
    size: { width: 340, height: 320 },
  },
];

/**
 * Just the wheel. Who is spinning comes from the queue, what they landed on is
 * under the pointer, and what they owe is on the running total — so a caption
 * here would only repeat the rest of the scene.
 */
export function OverlayWheel({
  config,
  animation,
  onTick,
}: {
  config: SpinConfig;
  animation: SpinAnimation | null;
  onTick?: () => void;
}) {
  return (
    <div className="w-full max-w-[520px]">
      <SpinWheel
        animation={animation}
        name={config.name}
        onTick={onTick}
        slices={config.slices}
        wheelHue={config.wheelHue}
        wheelTone={config.wheelTone}
      />
    </div>
  );
}

/** One digit of the reel, rolled into place rather than swapped. */
function Reel({ char }: { char: string }) {
  const digit = Number(char);

  if (!/^\d$/.test(char)) {
    return <span className="inline-block">{char}</span>;
  }

  return (
    <span className="reel-window">
      <span
        className="reel-strip"
        style={{ transform: `translateY(${-digit * 10}%)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
          <span className="reel-cell" key={value}>
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Marquee bulbs along the cabinet's crown.
 *
 * These are decoration, and they say one thing: whether a spin is live. The
 * dots that carry a number live inside the top screen instead, so position
 * tells you which kind you are looking at.
 */
function Bulbs({ accent, running }: { accent: string; running: boolean }) {
  return (
    <span aria-hidden="true" className="flex items-center justify-center gap-[7px]">
      {Array.from({ length: 11 }, (_, index) => (
        <span
          className="h-[5px] w-[5px] rounded-full"
          key={index}
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 6px ${accent}`,
            // Offsetting each bulb turns a shared animation into a chase.
            animation: running
              ? `bulb-chase 900ms ${index * 70}ms linear infinite`
              : undefined,
            opacity: running ? undefined : 0.28,
          }}
        />
      ))}
    </span>
  );
}

/**
 * A screen set into the cabinet. Dark, sunk behind a rim, with a fixed gloss
 * across the top — the three cues that read as "glass" without needing bevels
 * or gradients heavy enough to fight the rest of the overlay.
 */
function Screen({
  accent,
  children,
  display,
  className = "",
  shineKey,
}: {
  accent: string;
  children: ReactNode;
  display: string;
  className?: string;
  /** Changing this replays the gloss sweep. */
  shineKey?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: display,
        boxShadow: `inset 0 2px 9px rgba(0,0,0,0.6), inset 0 0 0 1px ${accent}2e`,
      }}
    >
      {/* Static gloss across the upper half. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0))",
        }}
      />
      {shineKey ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3"
          key={shineKey}
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.5), rgba(255,255,255,0))",
            animation: "screen-shine 900ms var(--ease-standard)",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

/**
 * The lever, sprung when a spin starts.
 *
 * It is mounted on an arm off the cabinet's side rather than floating beside
 * it, because a stem with a gap under it reads as a stray dot on a stick.
 */
function Lever({
  accent,
  ink,
  pullKey,
}: {
  accent: string;
  ink: string;
  pullKey: number;
}) {
  return (
    <div aria-hidden="true" className="relative w-11 shrink-0 self-center">
      {/* Arm out of the cabinet, and the boss the stem pivots on. */}
      <span
        className="absolute left-0 top-1/2 h-[7px] w-5 -translate-y-1/2 rounded-r-full"
        style={{ backgroundColor: `${ink}45` }}
      />
      <span
        className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: `${ink}38` }}
      />
      <div
        className="absolute bottom-1/2 left-4 h-[74px] w-[18px] origin-bottom"
        key={pullKey}
        style={{
          animation: pullKey
            ? `handle-pull ${LEVER_PULL_MS}ms var(--ease-standard)`
            : undefined,
        }}
      >
        <span
          className="absolute bottom-0 left-1/2 h-full w-[7px] -translate-x-1/2 rounded-full"
          style={{ backgroundColor: `${ink}52` }}
        />
        <span
          className="absolute left-1/2 top-0 h-8 w-8 -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle at 34% 30%, #ffffffcc, ${accent})`,
            boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 10px ${accent}88`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * The running total — the part of a run people actually watch.
 *
 * Three screens set into one cabinet, each answering a different question:
 * what is coming (the armed multiplier and spins left), what it is worth (the
 * total), and what just happened (the slice that landed). The last one matters
 * because it is the only place that explains why the number jumped — the wheel
 * is a separate source and may not be in the scene at all.
 */
export function OverlayTotal({
  appearance,
  state,
  spinning,
}: {
  appearance: OverlayAppearance;
  state: SpinState | null;
  spinning: boolean;
}) {
  const ink = overlayInk(appearance);
  const accent = overlayAccent(appearance);
  const display = overlayDisplay(appearance);
  const digit = overlayDigit(appearance);

  // Mid-animation the state already holds the new tab, so the reels hold the
  // value from before this spin and roll only once the wheel settles.
  const tabCents = spinning ? (state?.tabBeforeCents ?? 0) : (state?.tabCents ?? 0);
  const spinsLeft = state?.spinsLeft ?? 0;
  const multiplier = spinning ? 0 : (state?.multiplier ?? 0);
  const spinsAwarded = spinning ? 0 : (state?.spinsAwarded ?? 0);

  // Re-key the kick and the gloss on each settled result so the CSS animations
  // replay rather than firing once and staying put.
  const [pulseKey, setPulseKey] = useState(0);
  const previousTabRef = useRef(tabCents);

  useEffect(() => {
    if (tabCents !== previousTabRef.current) {
      previousTabRef.current = tabCents;
      setPulseKey((key) => key + 1);
    }
  }, [tabCents]);

  // The lever is pulled by the spin starting, not by the result landing.
  const [pullKey, setPullKey] = useState(0);
  const previousSpinRef = useRef(state?.spinId ?? null);

  useEffect(() => {
    if (state?.spinId && state.spinId !== previousSpinRef.current) {
      previousSpinRef.current = state.spinId;
      setPullKey((key) => key + 1);
    }
  }, [state?.spinId]);

  if (!state?.viewerName) {
    return null;
  }

  const amount = formatMoney(tabCents);
  // Never the cash figure: that is already the main screen, and showing it
  // twice reads as a fault rather than as confirmation.
  const status = spinning
    ? "Spinning"
    : multiplier > 1
      ? `${multiplier}\u00d7 next hit`
      : spinsAwarded > 0
        ? `+${spinsAwarded} ${spinsAwarded === 1 ? "spin" : "spins"}`
        : spinsLeft > 0
          ? `${spinsLeft} ${spinsLeft === 1 ? "spin" : "spins"} left`
          : "Round complete";

  return (
    <div className="flex w-full max-w-[340px] items-stretch">
      <div
        className="relative min-w-0 flex-1 rounded-[26px] border-2 px-3 pb-3 pt-2.5"
        key={`cabinet-${pulseKey}`}
        style={{
          ...overlaySurface(appearance, 0.92),
          color: ink,
          animation: "total-pop 480ms var(--ease-standard)",
          boxShadow: "0 6px 22px rgba(15,23,32,0.16)",
        }}
      >
        <Bulbs accent={accent} running={spinning} />

        {/* Top screen: what is coming. */}
        <Screen accent={accent} className="mt-2 px-3 py-1.5" display={display}>
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-sm font-black leading-none lg:text-base"
              style={{
                color: multiplier > 1 ? digit : `${digit}4d`,
                textShadow: multiplier > 1 ? `0 0 8px ${accent}` : undefined,
              }}
            >
              {multiplier > 1 ? `${multiplier}\u00d7` : "1\u00d7"}
            </span>
            <span className="flex items-center gap-1">
              {/* A fixed floor of slots: an empty row reads as a fault, a row
                  of unlit slots reads as none left. */}
              {Array.from({ length: Math.max(3, Math.min(spinsLeft, 6)) }, (_, index) => (
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  key={index}
                  style={
                    index < spinsLeft
                      ? { backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }
                      : { backgroundColor: `${digit}26` }
                  }
                />
              ))}
              {spinsLeft > 6 ? (
                <span className="ml-0.5 text-[0.65rem] font-bold" style={{ color: digit }}>
                  {spinsLeft}
                </span>
              ) : null}
            </span>
          </div>
        </Screen>

        {/* Main screen: what it is worth. */}
        <Screen
          accent={accent}
          className="mt-1.5 px-3 py-3.5"
          display={display}
          shineKey={pulseKey}
        >
          <p
            className="flex items-center justify-center text-5xl font-black leading-none lg:text-6xl"
            style={{
              color: digit,
              // Hot core, coloured spill: a tight halo hugging the glyph and a
              // wide faint one for the bloom.
              textShadow: `0 0 4px ${accent}, 0 0 14px ${accent}dd, 0 0 34px ${accent}77`,
            }}
          >
            {amount.split("").map((char, index) => (
              <Reel char={char} key={`${index}-${char}`} />
            ))}
          </p>
        </Screen>

        {/* Bottom screen: what just happened. */}
        <Screen accent={accent} className="mt-1.5 px-3 py-1.5" display={display}>
          <p
            className="truncate text-center text-[0.7rem] font-bold uppercase tracking-[0.18em] lg:text-xs"
            style={{ color: `${digit}c4` }}
          >
            {status}
          </p>
        </Screen>
      </div>

      <Lever accent={accent} ink={ink} pullKey={pullKey} />
    </div>
  );
}

export function OverlayGoalBar({
  appearance,
  state,
  goalLabel,
  goalCents,
  goalControl,
  currentControl,
}: {
  appearance: OverlayAppearance;
  state: SpinState | null;
  goalLabel: string;
  goalCents: number;
  /**
   * Replace the figures with editable controls on the Live page. The OBS source
   * passes nothing, so the two stay the same component and what the streamer
   * edits is literally what the stream shows.
   */
  goalControl?: ReactNode;
  currentControl?: ReactNode;
}) {
  const ink = overlayInk(appearance);
  const accent = overlayAccent(appearance);
  const current = state?.counterCents ?? 0;
  const progress = goalCents > 0 ? Math.min(1, current / goalCents) : 0;
  const shape = appearance.goalShape;

  // The marker swells when the total climbs. Re-keying replays the animation;
  // a correction downwards is not a win, so it does not celebrate.
  const [pulseKey, setPulseKey] = useState(0);
  // The glow is worn only for the length of that swell, so at rest the marker
  // is just a shape on the bar.
  const [pulsing, setPulsing] = useState(false);
  const previousCurrentRef = useRef(current);
  const markerGradientId = useId();

  useEffect(() => {
    if (current > previousCurrentRef.current) setPulseKey((key) => key + 1);
    previousCurrentRef.current = current;
  }, [current]);

  // A timer rather than onAnimationEnd: that event did not fire reliably for
  // the remounted marker, which left the glow lit for good after the first
  // spin — the opposite of the point.
  useEffect(() => {
    if (!pulseKey) return;

    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), MARKER_PULSE_MS);
    return () => window.clearTimeout(timer);
  }, [pulseKey]);

  const marker = markerColors(appearance, progress);

  return (
    <div
      // Deeper at the bottom on purpose: the marker overhangs the track by ten
      // pixels and throws a glow past that, so equal padding would leave it
      // grazing the pill's edge.
      className="w-full max-w-[600px] rounded-full border-2 px-7 pb-6 pt-2.5 backdrop-blur-md"
      style={{ ...overlaySurface(appearance, 0.88), color: ink }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate text-sm font-bold tracking-wide lg:text-base">
          {goalLabel}
        </p>
        <p className="flex shrink-0 items-baseline text-base font-black leading-none lg:text-xl">
          {currentControl ?? formatMoney(current)}
          {goalControl ? (
            <span className="opacity-50">/{goalControl}</span>
          ) : goalCents > 0 ? (
            <span className="opacity-50">/{formatMoney(goalCents)}</span>
          ) : null}
        </p>
      </div>

      {/* The fill is the loudest thing on the bar, so it gets real height and a
          marker riding its tip rather than ending on a flat edge. */}
      {/* The marker overhangs the track, so the row carries its own room. */}
      <div
        className="relative mt-2.5 h-4 rounded-full"
        style={{ backgroundColor: `${ink}1f` }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-slow ease-standard"
          style={{
            width: `${progress * 100}%`,
            background: appearance.goalRainbow
              ? rainbowFill(appearance.vivid)
              : accent,
            boxShadow: `0 0 12px ${accent}66`,
          }}
        />
        {shape !== "none" && progress > 0 ? (
          <svg
            aria-hidden="true"
            className="absolute top-1/2 h-9 w-9 transition-[left] duration-slow ease-standard"
            // The translate lives in the transform rather than in a class so
            // the pulse keyframe can carry it too.
            key={`marker-${pulseKey}`}
            style={{
              left: `${progress * 100}%`,
              transform: "translate(-50%, -50%)",
              filter: pulsing ? markerGlow(marker.from) : undefined,
              animation: pulseKey
                ? `marker-pulse ${MARKER_PULSE_MS}ms var(--ease-standard)`
                : undefined,
            }}
            viewBox="0 0 24 24"
          >
            <defs>
              <linearGradient id={markerGradientId} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={marker.from} />
                <stop offset="100%" stopColor={marker.to} />
              </linearGradient>
            </defs>
            {/* White body, edge in the colour the bar has reached. Colouring
                the body instead camouflaged it against the fill it rides.
                Painting the stroke before the fill keeps it outside the shape —
                a centred stroke eats half its width out of the white. */}
            <path
              d={GOAL_SHAPE_PATHS[shape]}
              fill="#fff"
              paintOrder="stroke"
              stroke={`url(#${markerGradientId})`}
              strokeLinejoin="round"
              strokeWidth="3.4"
            />
          </svg>
        ) : null}
      </div>

    </div>
  );
}

export function OverlayQueue({
  appearance,
  entries,
  state,
  maxVisible = 5,
  hideNames = false,
  entryControl,
}: {
  appearance: OverlayAppearance;
  entries: SpinQueueEntry[];
  state?: SpinState | null;
  maxVisible?: number;
  /** Show positions only, for creators who would rather not name viewers. */
  hideNames?: boolean;
  /** Per-row action rendered on the Live page only, never on the OBS source. */
  entryControl?: (entry: SpinQueueEntry) => ReactNode;
}) {
  const ink = overlayInk(appearance);
  const accent = overlayAccent(appearance);

  // A run in progress keeps its queue entry — it is re-queued between spins —
  // so the viewer on the wheel is lifted out of the waiting list and called out
  // above it rather than sitting at position one.
  const spinningId = state?.tabOpen ? state.queueEntryId : null;
  const spinningNow =
    entries.find((entry) => entry.id === spinningId)?.viewerName ??
    (spinningId ? state?.viewerName : null) ??
    null;
  const waiting = entries.filter((entry) => entry.id !== spinningId);
  const visible = waiting.slice(0, maxVisible);
  const overflow = waiting.length - visible.length;

  return (
    <div
      className="w-full max-w-[320px] rounded-3xl border-2 p-4 backdrop-blur-md"
      style={{ ...overlaySurface(appearance, 0.88), color: ink }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.12em] opacity-80">
          Queue
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-black"
          style={{ backgroundColor: accent, color: "#fff" }}
        >
          {waiting.length}
        </span>
      </div>

      {spinningNow ? (
        <div className="mt-3 border-b pb-2.5" style={{ borderColor: `${ink}1f` }}>
          <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            Spinning now
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {hideNames ? "A viewer" : spinningNow}
          </p>
        </div>
      ) : null}

      {visible.length ? (
        <ol className="mt-3 grid gap-1.5">
          {visible.map((entry, index) => (
            <li className="flex items-start gap-2.5 text-sm" key={entry.id}>
              <span className="w-4 shrink-0 text-center text-xs leading-5 opacity-50">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {hideNames ? "Waiting" : entry.viewerName}
                </span>
                {/* Which wheel they bought into, since viewers pick their own. */}
                {entry.wheelName ? (
                  <span className="block truncate text-xs opacity-60">
                    {entry.wheelName}
                  </span>
                ) : null}
              </span>
              {entryControl ? (
                <span className="shrink-0">{entryControl(entry)}</span>
              ) : null}
            </li>
          ))}
          {overflow > 0 ? (
            <li className="pl-6 text-xs opacity-60">+{overflow} more</li>
          ) : null}
        </ol>
      ) : (
        <p className="mt-3 text-sm opacity-55">Nobody waiting</p>
      )}

      {/* The overlay's one piece of branding. It lives here rather than on the
          goal bar because this panel has the room, and rather than on the wheel
          because the wheel is an event element that comes and goes. */}
      <p className="mt-3 text-right text-[0.6rem] font-semibold tracking-[0.12em] opacity-35">
        tributes.bio
      </p>
    </div>
  );
}
