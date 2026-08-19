import { useEffect, useRef, useState, type ReactNode } from "react";
import { SpinWheel, type SpinAnimation } from "../SpinWheel";
import {
  GOAL_SHAPE_PATHS,
  overlayAccent,
  overlayDigit,
  overlayDisplay,
  overlayInk,
  overlaySurface,
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
    size: { width: 420, height: 180 },
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
      <SpinWheel animation={animation} onTick={onTick} slices={config.slices} />
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

/** Marquee bulbs along the cabinet, chasing while the wheel is turning. */
function Bulbs({ accent, running }: { accent: string; running: boolean }) {
  return (
    <span aria-hidden="true" className="flex items-center justify-center gap-[7px]">
      {Array.from({ length: 13 }, (_, index) => (
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
            opacity: running ? undefined : 0.32,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The running total — the part of a run people actually watch.
 *
 * Built as a slot cabinet rather than a card: marquee bulbs across the top,
 * the number sunk into a dark display glass so it glows against the panel, and
 * the spins left shown as bulbs of their own. Digits roll into place, the
 * cabinet kicks when the number moves, and whatever the slice handed out flies
 * up over the top.
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

  // Re-key the kick and the award flash on each settled result so the CSS
  // animations replay rather than firing once and staying put.
  const [pulseKey, setPulseKey] = useState(0);
  const previousTabRef = useRef(tabCents);

  useEffect(() => {
    if (tabCents !== previousTabRef.current) {
      previousTabRef.current = tabCents;
      setPulseKey((key) => key + 1);
    }
  }, [tabCents]);

  if (!state?.viewerName) {
    return null;
  }

  const amount = formatMoney(tabCents);
  // A multiplier already grants its own spin, so it is called out as the
  // multiplier rather than as "+1 spin".
  const award =
    multiplier > 1
      ? `${multiplier}\u00d7`
      : spinsAwarded > 0
        ? `+${spinsAwarded} ${spinsAwarded === 1 ? "SPIN" : "SPINS"}`
        : null;

  return (
    <div
      className="relative w-full max-w-[340px] rounded-[26px] border-2 px-3.5 pb-3 pt-2.5 text-center backdrop-blur-md"
      key={`cabinet-${pulseKey}`}
      style={{
        ...overlaySurface(appearance, 0.9),
        color: ink,
        animation: "total-pop 480ms var(--ease-standard)",
      }}
    >
      {award ? (
        <span
          className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1 text-sm font-black tracking-wide lg:text-base"
          key={`award-${pulseKey}`}
          style={{
            animation: "award-flash 1.6s var(--ease-standard) forwards",
            backgroundColor: accent,
            boxShadow: `0 0 18px ${accent}`,
            color: "#fff",
          }}
        >
          {award}
        </span>
      ) : null}

      <Bulbs accent={accent} running={spinning} />

      {/* The number sits in a dark display so it glows instead of sitting flat
          on the panel — the single biggest thing separating this from a card. */}
      <div
        className="mt-2 rounded-2xl px-3 py-2"
        style={{
          backgroundColor: display,
          boxShadow: `inset 0 2px 10px rgba(0,0,0,0.55), inset 0 0 0 1px ${accent}33`,
        }}
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
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] lg:text-xs">
        {spinsLeft > 0 ? (
          <>
            <span className="flex gap-1">
              {Array.from({ length: Math.min(spinsLeft, 6) }, (_, index) => (
                <span
                  className="h-2 w-2 rounded-full"
                  key={index}
                  style={{ backgroundColor: accent, boxShadow: `0 0 7px ${accent}` }}
                />
              ))}
            </span>
            <span className="opacity-70">
              {spinsLeft > 6 ? `${spinsLeft} Left` : "Left"}
            </span>
          </>
        ) : (
          <span className="opacity-55">Round Complete</span>
        )}
      </div>
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

  return (
    <div
      className="w-full max-w-[600px] rounded-full border-2 px-7 py-4 backdrop-blur-md"
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
        className="relative mt-3.5 h-4 rounded-full"
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
            className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-slow ease-standard"
            style={{
              left: `${progress * 100}%`,
              filter: `drop-shadow(0 0 6px ${accent})`,
            }}
            viewBox="0 0 24 24"
          >
            <path
              d={GOAL_SHAPE_PATHS[shape]}
              fill="#fff"
              stroke={appearance.goalRainbow ? "#fff" : accent}
              strokeLinejoin="round"
              strokeWidth="2.5"
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
