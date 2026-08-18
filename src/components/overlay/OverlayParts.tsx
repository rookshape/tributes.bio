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
export type OverlayPart = "wheel" | "bar" | "queue";

export const OVERLAY_PARTS: { id: OverlayPart; label: string; hint: string }[] = [
  { id: "wheel", label: "Wheel", hint: "The wheel and its result" },
  { id: "bar", label: "Progress bar", hint: "Tribute goal progress" },
  { id: "queue", label: "Queue", hint: "Who is waiting to spin" },
];

function appearanceOf(config: SpinConfig): WheelAppearance {
  return { hue: config.wheelHue, tone: config.wheelTone };
}

export function OverlayWheel({
  config,
  state,
  animation,
  spinning,
}: {
  config: SpinConfig;
  state: SpinState | null;
  animation: SpinAnimation | null;
  spinning: boolean;
}) {
  const appearance = appearanceOf(config);
  // Mid-animation the state already holds the new tab, so show the value from
  // before this spin until the wheel settles.
  const tabCents = spinning ? (state?.tabBeforeCents ?? 0) : (state?.tabCents ?? 0);
  const tabMaxCents = state?.tabMaxCents ?? 0;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full max-w-[520px]">
        <SpinWheel animation={animation} slices={config.slices} />
      </div>
      {/* Only shown once there is a viewer and a result — no idle caption. */}
      {state?.viewerName ? (
        <div
          className="rounded-3xl border px-5 py-2.5 text-center backdrop-blur-md"
          style={{ ...wheelGlass(appearance), color: wheelInk(appearance) }}
        >
          <p className="text-sm font-medium opacity-70 lg:text-base">
            {state.viewerName}
          </p>
          <p className="text-xl font-bold leading-tight lg:text-3xl">
            {spinning ? "Spinning" : state.resultLabel}
          </p>
          {/* The whole point of a run: what they owe climbing as it goes. The
              tab holds its old value through the animation so the jump lands
              with the result rather than spoiling it. */}
          {tabCents > 0 ? (
            <p className="mt-1 text-lg font-bold leading-none tabular-nums lg:text-2xl">
              {formatMoney(tabCents)}
              {tabMaxCents > 0 ? (
                <span className="font-semibold opacity-50">
                  {" "}
                  / {formatMoney(tabMaxCents)}
                </span>
              ) : null}
            </p>
          ) : null}
          {!spinning && state.tabOpen ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-60 lg:text-sm">
              Spins again
            </p>
          ) : null}
        </div>
      ) : null}
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
  maxVisible = 5,
}: {
  config: SpinConfig;
  entries: SpinQueueEntry[];
  maxVisible?: number;
}) {
  const appearance = appearanceOf(config);
  const ink = wheelInk(appearance);
  const visible = entries.slice(0, maxVisible);
  const overflow = entries.length - visible.length;

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
          {entries.length}
        </span>
      </div>
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
