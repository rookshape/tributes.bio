import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SpinWheel, type SpinAnimation } from "../SpinWheel";
import {
  GOAL_SHAPE_PATHS,
  overlayAccent,
  overlayInk,
  overlayGlow,
  overlayScreen,
  overlayScreenInk,
  overlaySurface,
  overlaySurfaceSolid,
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

/**
 * Figure size by glyph count. The screen is fixed width, so a total that runs
 * into five or six characters has to come down to stay inside it.
 */
function figureSize(glyphs: number) {
  if (glyphs <= 3) return "3.5rem";
  if (glyphs === 4) return "3.1rem";
  if (glyphs === 5) return "2.6rem";
  if (glyphs === 6) return "2.2rem";
  return "1.9rem";
}

/** How long the figure takes to climb to a new total. */
const COUNT_UP_MS = 850;

/** How long "Round over" holds before the wordmark slides in behind it. */
const WORDMARK_DELAY_MS = 4000;

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
 * Counts a figure up to its target rather than swapping to it.
 *
 * The climb is the point: a total that jumps straight to the answer gives the
 * viewer nothing to watch, where one that races up reads as the machine
 * tallying. Only increases animate — a correction downwards just lands.
 */
function useCountUp(target: number, durationMs = COUNT_UP_MS) {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;

    if (target <= from) {
      setShown(target);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      // Ease out, so it sprints away and settles onto the figure.
      const eased = 1 - (1 - progress) ** 3;
      const value = from + (target - from) * eased;
      // Step in whole dollars on the way up. Interpolating raw cents lands on
      // fractional values, and the formatter shows cents for those — so the
      // figure would flip between "$12.34" and "$47" as it climbed, changing
      // width every frame.
      setShown(progress < 1 ? Math.round(value / 100) * 100 : target);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return shown;
}

/**
 * The cabinet is one silhouette, not a body with things stuck to it.
 *
 * Each extension is a rounded rectangle tipped in 3D rather than a clipped
 * polygon: the perspective narrows the free edge into a trapezoid while the
 * corner radii survive, which a clip-path cannot do. All three pieces share the
 * same fill and overlap, so they read as one shape, and the shadow is thrown by
 * the group so it follows the union instead of outlining every piece.
 */
function Cabinet({ fillColor }: { fillColor: string }) {
  const fill = { backgroundColor: fillColor };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        filter: "drop-shadow(0 6px 16px rgba(15,23,32,0.18))",
        // Faded as a group, so overlaps do not compound into visible seams.
        opacity: 0.95,
      }}
    >
      <div
        className="absolute left-[16px] top-0 h-[62px] w-[104px]"
        style={{
          ...fill,
          borderRadius: "15px 15px 0 0",
          transform: "perspective(22px) rotateX(4deg)",
          transformOrigin: "bottom",
        }}
      />
      <div
        className="absolute bottom-0 h-[64px] w-[164px]"
        style={{
          ...fill,
          left: "50%",
          marginLeft: -82,
          borderRadius: "0 0 15px 15px",
          transform: "perspective(22px) rotateX(-4deg)",
          transformOrigin: "top",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-[52px] top-[52px] rounded-[26px]"
        style={fill}
      />
    </div>
  );
}

/**
 * A screen set into the cabinet: a light tinted face sunk behind a thin rim.
 * Light rather than dark so it lifts off the cabinet, with its figures in a
 * deep shade of the same hue — contrast carried by lightness, not by glow.
 */
function Screen({
  children,
  className = "",
  charging = false,
  face,
  ink,
  shape,
  wave,
}: {
  children?: ReactNode;
  className?: string;
  /** Breathes while a spin is resolving. */
  charging?: boolean;
  face: string;
  ink: string;
  /** Taper matching the extension this screen sits in. */
  shape?: CSSProperties;
  /** Runs a glow across the face instead of showing content. */
  wave?: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        ...shape,
        backgroundColor: face,
        backgroundImage: wave
          ? `linear-gradient(100deg, ${face} 18%, ${wave} 50%, ${face} 82%)`
          : undefined,
        // The tile must match the keyframe's travel exactly, or the loop
        // restarts mid-sweep and the glow visibly jumps.
        backgroundSize: wave ? "200% 100%" : undefined,
        animation: wave ? "slot-wave 2.6s linear infinite" : undefined,
        boxShadow: `inset 0 1px 3px ${ink}59, inset 0 0 0 1px ${ink}26`,
      }}
    >
      {charging ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: `inset 0 0 12px ${ink}66`,
            animation: "screen-charge 1s ease-in-out infinite",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

/**
 * The running total — the part of a run people actually watch.
 *
 * One cabinet with the figure on it, and two smaller screens carrying what a
 * viewer needs alongside it: the multiplier that is armed, and how many spins
 * are left. The second is the reason that screen exists at all — streamers
 * count it out on their fingers today, so it has to read at a glance.
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
  const face = overlayScreen(appearance);
  const screenInk = overlayScreenInk(appearance);
  const surface = overlaySurfaceSolid(appearance);

  // Mid-animation the state already holds the new tab, so the figure holds the
  // value from before this spin and climbs only once the wheel settles.
  const tabCents = spinning ? (state?.tabBeforeCents ?? 0) : (state?.tabCents ?? 0);
  const spinsLeft = state?.spinsLeft ?? 0;
  const multiplier = spinning ? 0 : (state?.multiplier ?? 0);

  const countedCents = useCountUp(tabCents);

  // Once a round is over the screen has nothing left to report, so it hands
  // the space to the wordmark rather than holding a dead message all stream.
  const roundOver = !spinning && spinsLeft <= 0;
  const [showWordmark, setShowWordmark] = useState(false);

  useEffect(() => {
    if (!roundOver) {
      setShowWordmark(false);
      return;
    }

    const timer = window.setTimeout(() => setShowWordmark(true), WORDMARK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [roundOver]);

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

  const amount = formatMoney(countedCents);
  const armed = multiplier > 1;
  const label = spinning
    ? "Spinning"
    : spinsLeft > 0
      ? `${spinsLeft} ${spinsLeft === 1 ? "spin" : "spins"} left`
      : showWordmark
        ? "tributes.bio"
        : "Round over";

  return (
    <div
      className="relative w-full max-w-[214px] pb-[64px] pt-[64px]"
      key={`cabinet-${pulseKey}`}
      style={{ color: ink, animation: "total-pop 480ms var(--ease-standard)" }}
    >
      <Cabinet fillColor={surface} />

      {/* Upper left: what is armed. */}
      <Screen
        charging={spinning && armed}
        className="absolute left-[28px] top-[19px] grid h-[29px] w-[80px] place-items-center rounded-[9px]"
        // Same perspective and origin as the extension behind it, so its sides
        // slant parallel to the white rather than cutting across it.
        shape={{
          transform: "perspective(22px) rotateX(4deg)",
          transformOrigin: "bottom",
        }}
        face={face}
        ink={screenInk}
        // Nothing armed: the slot runs a glow across itself rather than showing
        // a placeholder figure, so it reads as waiting rather than as a value.
        wave={armed ? undefined : overlayGlow(appearance)}
      >
        {armed ? (
          <span
            className="text-base font-black leading-none lg:text-lg"
            style={{ color: screenInk }}
          >
            {`${multiplier}×`}
          </span>
        ) : null}
      </Screen>

      {/* The figure. */}
      <div className="relative px-[12px]">
        <Screen
          className="relative rounded-[16px] px-2 py-3.5"
          face={face}
          ink={screenInk}
        >
          <p
            className="flex items-center justify-center font-black leading-none"
            // Sized from the glyph count: a narrower screen means a five figure
            // total would run off the end at one fixed size.
            style={{ color: screenInk, fontSize: figureSize(amount.length) }}
          >
            {amount.split("").map((char, index) => (
              <Reel char={char} key={`${index}-${char}`} />
            ))}
          </p>
        </Screen>
      </div>

      {/* Bottom centre: how many spins are left. */}
      <Screen
        charging={spinning}
        className="absolute bottom-[19px] left-1/2 grid h-[30px] w-[140px] place-items-center rounded-[9px]"
        shape={{
          marginLeft: -70,
          transform: "perspective(22px) rotateX(-4deg)",
          transformOrigin: "top",
        }}
        face={face}
        ink={screenInk}
      >
        <span
          className="whitespace-nowrap text-xs font-black uppercase tracking-[0.08em] lg:text-sm"
          // Keyed on the wording so a change remounts the span and replays the
          // slide, rather than swapping the text in place.
          key={label}
          style={{
            color: screenInk,
            animation: "label-slide 420ms var(--ease-standard)",
          }}
        >
          {label}
        </span>
      </Screen>
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
