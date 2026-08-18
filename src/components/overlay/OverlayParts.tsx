import { useEffect, useRef, useState } from "react";
import { SpinWheel, type SpinAnimation } from "../SpinWheel";
import {
  wheelAccent,
  wheelGlass,
  wheelInk,
  type WheelAppearance,
} from "../../lib/wheelPalette";
import { formatMoney } from "../../lib/money";
import type { SpinConfig, SpinQueueEntry, SpinState } from "../../lib/types";

/**
 * The overlay is three independent pieces so a streamer can place each one as
 * its own OBS browser source and position them separately over their scene.
 *
 * Every panel is light frosted glass tinted towards the wheel's hue — never a
 * solid dark plate, which would cut a hard rectangle out of the stream.
 */
export type OverlayPart = "wheel" | "total" | "bar" | "queue";

export const OVERLAY_PARTS: { id: OverlayPart; label: string; hint: string }[] = [
  { id: "wheel", label: "Wheel", hint: "The wheel and its result" },
  { id: "total", label: "Running total", hint: "The tab climbing as they spin" },
  { id: "bar", label: "Progress bar", hint: "Tribute goal progress" },
  { id: "queue", label: "Queue", hint: "Who is waiting to spin" },
];

function appearanceOf(config: SpinConfig): WheelAppearance {
  return { hue: config.wheelHue, tone: config.wheelTone };
}

/**
 * Just the wheel. Who is spinning comes from the queue, what they landed on is
 * under the pointer, and what they owe is on the running total — so a caption
 * here would only repeat the rest of the scene.
 */
export function OverlayWheel({
  config,
  animation,
}: {
  config: SpinConfig;
  animation: SpinAnimation | null;
}) {
  return (
    <div className="w-full max-w-[520px]">
      <SpinWheel animation={animation} slices={config.slices} />
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
 * The running total. This is the part of a run people watch — the number
 * climbing as multipliers land — so it gets its own source the streamer can put
 * anywhere, and it behaves like a slot machine: digits roll into place, the
 * panel kicks when the number moves, and anything the slice handed out flies up
 * over the top.
 */
export function OverlayTotal({
  config,
  state,
  spinning,
}: {
  config: SpinConfig;
  state: SpinState | null;
  spinning: boolean;
}) {
  const appearance = appearanceOf(config);
  const ink = wheelInk(appearance);
  const accent = wheelAccent(appearance);

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
        ? `+${spinsAwarded} ${spinsAwarded === 1 ? "spin" : "spins"}`
        : null;

  return (
    <div
      className="relative w-full max-w-[360px] rounded-3xl border px-6 py-4 text-center backdrop-blur-md"
      style={{ ...wheelGlass(appearance), color: ink }}
    >
      {award ? (
        <span
          className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-bold lg:text-base"
          key={`award-${pulseKey}`}
          style={{
            animation: "award-flash 1.6s var(--ease-standard) forwards",
            backgroundColor: accent,
            color: "#fff",
          }}
        >
          {award}
        </span>
      ) : null}

      {/* No viewer name: the queue's "Spinning now" line already says whose run
          this is, and repeating it costs room the number wants. */}
      <p
        className="flex items-center justify-center text-4xl font-black leading-none lg:text-6xl"
        key={`total-${pulseKey}`}
        style={{ animation: "total-pop 480ms var(--ease-standard)" }}
      >
        {amount.split("").map((char, index) => (
          <Reel char={char} key={`${index}-${char}`} />
        ))}
      </p>

      <div className="mt-2.5 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide lg:text-sm">
        {spinsLeft > 0 ? (
          <span className="flex items-center gap-1.5">
            {/* Pips read faster than a number at stream distance. */}
            <span className="flex gap-1">
              {Array.from({ length: Math.min(spinsLeft, 6) }, (_, index) => (
                <span
                  className="h-2 w-2 rounded-full"
                  key={index}
                  style={{ backgroundColor: accent }}
                />
              ))}
            </span>
            <span className="opacity-70">
              {spinsLeft > 6 ? `${spinsLeft} left` : "left"}
            </span>
          </span>
        ) : (
          <span className="opacity-55">Run complete</span>
        )}
      </div>
    </div>
  );
}

export function OverlayGoalBar({
  config,
  state,
  goalLabel,
  goalCents,
}: {
  config: SpinConfig;
  state: SpinState | null;
  goalLabel: string;
  goalCents: number;
}) {
  const appearance = appearanceOf(config);
  const ink = wheelInk(appearance);
  const accent = wheelAccent(appearance);
  const current = state?.counterCents ?? 0;
  const progress = goalCents > 0 ? Math.min(1, current / goalCents) : 0;

  return (
    <div
      className="w-full max-w-[600px] rounded-3xl border px-5 py-4 backdrop-blur-md"
      style={{ ...wheelGlass(appearance), color: ink }}
    >
      {/* Label and amount share a row above the bar, with the amount kept in
          its own raised container. */}
      <div className="flex items-center justify-between gap-4">
        <p className="truncate text-sm font-semibold lg:text-base">{goalLabel}</p>
        <div
          className="shrink-0 rounded-full border px-3.5 py-1.5"
          style={wheelGlass(appearance, 0.85)}
        >
          <p className="text-base font-bold leading-none lg:text-xl">
            {formatMoney(current)}
            {goalCents > 0 ? (
              <span className="opacity-55">/{formatMoney(goalCents)}</span>
            ) : null}
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: `${ink}1f` }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-slow ease-standard"
          style={{ width: `${progress * 100}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

export function OverlayQueue({
  config,
  entries,
  state,
  maxVisible = 5,
}: {
  config: SpinConfig;
  entries: SpinQueueEntry[];
  state?: SpinState | null;
  maxVisible?: number;
}) {
  const appearance = appearanceOf(config);
  const ink = wheelInk(appearance);
  const accent = wheelAccent(appearance);

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
      className="w-full max-w-[320px] rounded-3xl border p-4 backdrop-blur-md"
      style={{ ...wheelGlass(appearance), color: ink }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold opacity-80">Queue</p>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${ink}1f` }}
        >
          {waiting.length}
        </span>
      </div>

      {spinningNow ? (
        <div className="mt-3 border-b pb-2.5" style={{ borderColor: `${ink}1f` }}>
          <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: accent }}
            />
            Spinning now
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{spinningNow}</p>
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
                <span className="block truncate font-semibold">{entry.viewerName}</span>
                {/* Which wheel they bought into, since viewers pick their own. */}
                {entry.wheelName ? (
                  <span className="block truncate text-xs opacity-60">
                    {entry.wheelName}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="pl-6 text-xs opacity-60">+{overflow} more</li>
          ) : null}
        </ol>
      ) : (
        <p className="mt-3 text-sm opacity-55">Nobody waiting</p>
      )}
    </div>
  );
}
