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
  overlayChipFace,
  overlayChipInk,
  overlayDisplayFace,
  overlayScreenInk,
  overlaySurface,
  overlaySurfaceSolid,
  OVERLAY_PANEL_ALPHA,
  DEFAULT_OVERLAY_APPEARANCE,
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
/** How long the wheel's plate holds its title before flipping to the wordmark. */
const WHEEL_TITLE_MS = 9000;
const WHEEL_WORDMARK_MS = 3500;
/**
 * The name plate under the wheel.
 *
 * The same tab every other part wears — same taper, same border, same screen —
 * running up behind the wheel far enough that its flat top is hidden and the
 * two read as one shape. That last part only works because both are painted the
 * same opaque white: an earlier version gave the plate the themed panel colour
 * against a translucent white frame, which is two fills meeting at a line, and
 * no amount of reshaping it fixed that.
 */
/**
 * The name plate under the wheel, measured as a share of the wheel's width.
 *
 * It used to be measured in pixels, which only ever looked right at one size.
 * A straight edge meeting a circle closes only if it reaches past the point
 * where the arc has climbed level with its corners, and that climb depends on
 * the plate's width *relative to the radius* — so a fixed plate on a wheel that
 * scales is correct at exactly one width and splits open below it. At 240px the
 * plate was nearly as wide as the wheel and its corners stood 26px clear.
 *
 * In `cqw` — a percent of the wheel's own width — every one of these ratios
 * holds at any size. The wheel's root declares the container.
 */
const PLATE = {
  /** Just over half the wheel: wide enough to read, and the arc still closes. */
  width: 53,
  /**
   * How far it hangs below the frame, in its own flat coordinates.
   *
   * Much deeper than what ends up on show. The plate is tipped away from the
   * viewer, so its height foreshortens — at the last set of numbers 39 flat
   * pixels of drop rendered as 19, and the screen inside it started above the
   * wheel's edge and emerged from underneath rather than sitting below it.
   */
  drop: 17.5,
  /** How far it runs up behind the wheel. Must clear the arc's climb, which at
      this width is about 8 — the rest is margin. */
  tuck: 9.5,
  /**
   * Border around the lit screen.
   *
   * Wider than the arithmetic wanted. Converting these to shares of the wheel
   * kept the ratios the pixel version had, but those had been set against a
   * plate that was itself too small — so the screen came out filling almost the
   * whole plate, with the white showing only as a hairline.
   */
  sideBorder: 3.2,
  bottomBorder: 2,
  /**
   * Gap between the wheel's edge and the top of the lit screen — again flat,
   * so it has to be generous to survive the foreshortening.
   */
  screenGap: 3,
  fontSize: 4.9,
  /** Scaled with the plate, or a taller plate would taper into a wedge. */
  tip: { perspective: "6.9cqw", degrees: 6 },
};

/** A share of the wheel's width. */
function cqw(value: number) {
  return `${value}cqw`;
}

export function OverlayWheel({
  appearance = DEFAULT_OVERLAY_APPEARANCE,
  config,
  animation,
  onTick,
}: {
  appearance?: OverlayAppearance;
  config: SpinConfig;
  animation: SpinAnimation | null;
  onTick?: () => void;
}) {
  const basic = appearance.panel === "basic";
  const chipFace = overlayChipFace(appearance);
  const chipInk = overlayChipInk(appearance);
  // Title most of the time, wordmark in passing. Chained timeouts rather than
  // one interval because the two are held for different lengths — the wheel is
  // the thing being watched, so the branding takes the shorter turn.
  const [showWordmark, setShowWordmark] = useState(false);

  useEffect(() => {
    if (basic) return;

    const timer = window.setTimeout(
      () => setShowWordmark((shown) => !shown),
      showWordmark ? WHEEL_WORDMARK_MS : WHEEL_TITLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [basic, showWordmark]);

  const plate = showWordmark ? "tributes.bio" : config.name;

  if (basic) {
    return (
      <div className="w-full max-w-[520px]">
        <SpinWheel
          animation={animation}
          name={config.name}
          onTick={onTick}
          slices={config.slices}
          wheelGlow={config.wheelGlow}
          wheelHue={config.wheelHue}
          wheelTone={config.wheelTone}
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-[520px]"
      // Declares the container the plate's cqw units are a share of. Without
      // it those units fall back to the viewport, which is not a subtle
      // failure — the plate comes out several times the size of the wheel.
      style={{
        containerType: "inline-size",
        // Room for the part of the plate that hangs below the wheel.
        paddingBottom: cqw(PLATE.drop),
      }}
    >
      {/*
        The frame and the plate, drawn as one thing.

        This is the whole trick, and getting it wrong is what made every earlier
        version read as two pieces: the circle used to be its own element with
        its own shadow, so it cast that shadow *onto* the plate attached to it.
        No shape or colour work fixes a shadow falling across the join. Here the
        circle and the plate are siblings with no shadows of their own, and the
        group throws one — which follows the union of the two, the way a single
        object's would.

        Square, and pinned to the top, so it lines up with the wheel's own box
        rather than with the taller box the plate's room makes below it.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 aspect-square"
        style={{ filter: "drop-shadow(0 6px 16px rgba(15,23,32,0.16))" }}
      >
        <div className="absolute inset-[3.2%] rounded-full bg-white" />
        <div
          className="absolute"
          style={{
            // Hung off the frame's own edge, and run back up behind it far
            // enough that the circle covers the plate's flat top. A straight
            // edge meeting a circle only closes once it reaches past where the
            // arc has climbed level with its corners, and that climb grows as
            // the wheel gets smaller — so this clears the smallest the wheel is
            // ever drawn at rather than the size it happens to be here.
            top: "96.8%",
            marginTop: cqw(-PLATE.tuck),
            left: "50%",
            marginLeft: cqw(-PLATE.width / 2),
            width: cqw(PLATE.width),
            height: cqw(PLATE.tuck + PLATE.drop),
          }}
        >
          <Tab
            edge="bottom"
            fill="#ffffff"
            style={{ left: 0, height: "100%", width: "100%" }}
            tip={PLATE.tip}
            width={0}
          >
            <Screen
              className="absolute grid place-items-center px-3"
              face={chipFace}
              // The buried part is added to the top inset and nothing else
              // changes, so what is on show is the same screen the counter and
              // the queue carry, down to the border either side of it.
              shape={{
                // Shares of the wheel, like every other measurement on the
                // plate. Left as bare numbers these became pixels — a three
                // pixel border on a plate that scales — which is what had the
                // screen filling it edge to edge.
                left: cqw(PLATE.sideBorder),
                right: cqw(PLATE.sideBorder),
                top: cqw(PLATE.tuck + PLATE.screenGap),
                bottom: cqw(PLATE.bottomBorder),
                // Rounder at the top than at the bottom. The white above the
                // screen is bounded by the wheel's arc, which climbs away from
                // a straight edge towards the plate's ends — curving the screen
                // to meet it keeps that band closer to even.
                borderRadius: "14px 14px 7px 7px",
              }}
            >
              <span
                className="w-full truncate text-center font-black uppercase leading-none tracking-[0.01em]"
                // Keyed on the wording so a change remounts the span and
                // replays the slide rather than swapping the text in place.
                key={plate}
                style={{
                  color: chipInk,
                  // Scaled with the plate, like everything else on it.
                  fontSize: cqw(PLATE.fontSize),
                  animation: "label-slide 420ms var(--ease-standard)",
                }}
              >
                {plate}
              </span>
            </Screen>
          </Tab>
        </div>
      </div>

      <SpinWheel
        animation={animation}
        // The group above draws it, together with the plate.
        frame={false}
        onTick={onTick}
        slices={config.slices}
        wheelGlow={config.wheelGlow}
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

/** Uniform border left around every screen. */
const BORDER = 10;
/** Visible height of an extension above or below the body. */
const BUMP = 42;
/** How far an extension runs on under the body, hiding its flared base. */
const TUCK = 4;
/**
 * The tip that turns each extension into a trapezoid.
 *
 * A shallow perspective is what makes the taper survive on a short element: the
 * screens are only about eighteen pixels tall, and a gentle angle across that
 * little height leaves them rendering as plain rectangles.
 */
const TIP = { perspective: "13px", degrees: 6 };
/**
 * Inset on an extension's free edge.
 *
 * Larger than the border everywhere else on purpose: that edge is the one
 * tipped away from the viewer, so the same inset foreshortens to about six
 * pixels where the sides still read as nine.
 */
const FREE_EDGE_INSET = 12;
/** Both extensions carry the same screen, so they are the same size. */
const EXTENSION_WIDTH = 148;
/**
 * The goal bar's two tabs. Wider than the counter's because they hold words
 * rather than a figure, and unequal because the label runs longer than the
 * count it is paired with.
 */
const GOAL_LABEL_TAB = 214;
const GOAL_FIGURE_TAB = 168;
/** The queue's single tab, carrying its header. */
const QUEUE_TAB = 176;

/**
 * One extension of a cabinet.
 *
 * A rounded rectangle tipped in 3D rather than a clipped polygon: the
 * perspective narrows the free edge into a trapezoid while the corner radii
 * survive, which a clip-path cannot do. Shared by the counter and the goal bar
 * so the two carry the same shape rather than two that merely resemble it.
 */
function Tab({
  children,
  edge,
  fill,
  style,
  tip = TIP,
  width,
}: {
  children?: ReactNode;
  edge: "top" | "bottom";
  fill: string;
  /** Where along the body it sits. */
  style?: CSSProperties;
  /**
   * How hard the free edge is drawn in. The default is tuned for a tab about
   * as tall as the counter's; a taller one needs a deeper perspective to taper
   * by the same proportion rather than closing into a wedge.
   */
  tip?: { perspective: string; degrees: number };
  width: number;
}) {
  const up = edge === "top";

  return (
    <div
      className={up ? "absolute top-0" : "absolute bottom-0"}
      style={{
        backgroundColor: fill,
        height: BUMP + TUCK,
        width,
        borderRadius: up ? "14px 14px 0 0" : "0 0 14px 14px",
        transform: `perspective(${tip.perspective}) rotateX(${
          up ? tip.degrees : -tip.degrees
        }deg)`,
        transformOrigin: up ? "bottom" : "top",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Centres a tab across the body it belongs to.
 *
 * Auto margins between pinned edges rather than a half-width offset: the offset
 * centres by the width the tab *asked* for, so one clamped by a max-width ends
 * up sitting off to one side.
 */
function centeredTab(): CSSProperties {
  return { left: 0, right: 0, marginLeft: "auto", marginRight: "auto" };
}

/**
 * The screen inside a tab.
 *
 * Each screen is a child of its tab rather than a sibling laid over it. That is
 * what keeps the border honest: an inset child is the same rectangle scaled
 * down, so once the parent is tipped both are the same trapezoid and the gap
 * between them stays even. Two separately-transformed shapes taper at different
 * rates and the border quietly thickens along its length.
 */
function tabScreenShape(edge: "top" | "bottom"): CSSProperties {
  const up = edge === "top";

  return {
    inset: BORDER,
    // The free edge is the one tipped away from the viewer, so its larger inset
    // foreshortens to about the same gap the sides show. The tucked edge runs
    // level with the body — insetting a border there too would stack against
    // the body's own padding and read as a double-thick band.
    top: up ? FREE_EDGE_INSET : TUCK,
    bottom: up ? TUCK : FREE_EDGE_INSET,
    borderRadius: 7,
  };
}

/**
 * The chrome of a part: its tabs and its body, drawn as one silhouette.
 *
 * All the pieces share a fill and overlap, so they read as one shape, and the
 * shadow is thrown by the group so it follows the union instead of outlining
 * every piece. The group is what carries the translucency, too — translucent
 * pieces would compound where they meet and draw a seam at every overlap.
 */
function Chrome({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        filter: "drop-shadow(0 6px 16px rgba(15,23,32,0.18))",
        opacity: OVERLAY_PANEL_ALPHA,
        // No backdrop-filter. It frosts the element's whole bounding box rather
        // than the silhouette drawn inside it, so on anything but a flat colour
        // it showed up as a translucent rectangle sitting behind the part —
        // over a stream, a blurred box around a shape that is not a box.
      }}
    >
      {children}
    </div>
  );
}

/**
 * The cabinet is one silhouette, not a body with things stuck to it.
 */
function Cabinet({
  bottomScreen,
  fillColor,
  topScreen,
}: {
  bottomScreen: ReactNode;
  fillColor: string;
  topScreen: ReactNode;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Chrome>
        <Tab
          edge="top"
          fill={fillColor}
          style={centeredTab()}
          width={EXTENSION_WIDTH}
        >
          {topScreen}
        </Tab>
        <Tab
          edge="bottom"
          fill={fillColor}
          style={centeredTab()}
          width={EXTENSION_WIDTH}
        >
          {bottomScreen}
        </Tab>
        <div
          className="absolute inset-x-0 rounded-[26px]"
          style={{
            backgroundColor: fillColor,
            top: BUMP,
            bottom: BUMP,
          }}
        />
      </Chrome>
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
  deep = false,
  face,
  shape,
  wave,
}: {
  children?: ReactNode;
  className?: string;
  /** Sunk further, for the one screen that has to read as glass. */
  deep?: boolean;
  face: string;
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
          ? `linear-gradient(100deg, ${face} 26%, ${wave} 50%, ${face} 74%)`
          : undefined,
        // The tile must match the keyframe's travel exactly, or the loop
        // restarts mid-sweep and the glow visibly jumps.
        backgroundSize: wave ? "200% 100%" : undefined,
        animation: wave ? "slot-wave 2.6s linear infinite" : undefined,
        // Neutral and tight rather than a soft tinted haze — a blurred, hue
        // tinted shadow reads as smudge at overlay size.
        // The main screen keeps its shadow but not the white lip that used to
        // run along the bottom edge — that was the haze bleeding into the
        // figure, not the shadow.
        boxShadow: deep
          ? "inset 0 2px 4px rgba(0,0,0,0.20), inset 0 0 0 1px rgba(0,0,0,0.07)"
          : "inset 0 1px 2px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(0,0,0,0.10)",
      }}
    >
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
  const chipFace = overlayChipFace(appearance);
  const chipInk = overlayChipInk(appearance);
  const displayFace = overlayDisplayFace(appearance);
  const screenInk = overlayScreenInk(appearance);
  const surface = overlaySurfaceSolid(appearance);

  // Mid-animation the state already holds the new tab, so the figure holds the
  // value from before this spin and climbs only once the wheel settles.
  const tabCents = spinning
    ? (state?.tabBeforeCents ?? 0)
    : (state?.tabCents ?? 0);
  // While the wheel turns, everything shows as it stood before this spin, so a
  // bonus or a multiplier is never announced ahead of the result landing.
  const spinsLeft = spinning
    ? (state?.spinsLeftBefore ?? 0)
    : (state?.spinsLeft ?? 0);
  // The armed multiplier, not the one that just landed: it stays lit until a
  // cash result spends it, which is the whole reason a viewer cares about it.
  const multiplier = spinning
    ? (state?.pendingMultiplierBefore ?? 1)
    : (state?.pendingMultiplier ?? 1);

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

    const timer = window.setTimeout(
      () => setShowWordmark(true),
      WORDMARK_DELAY_MS,
    );
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
  // Checked against the settled figure, not the one still climbing, so it does
  // not flicker on its way past the ceiling.
  const ceiling = state.tabMaxCents ?? 0;
  const maxedOut = !spinning && ceiling > 0 && (state.tabCents ?? 0) >= ceiling;
  // Never "Spinning": the count is the one thing a streamer reads off this
  // screen mid-round, and replacing it with a status is what made them hold it
  // up on their fingers in the first place.
  const label =
    spinsLeft > 1
      ? `${spinsLeft} spins left`
      : spinsLeft === 1
        ? "Last spin"
        : showWordmark
          ? "tributes.bio"
          : "Round over";

  if (appearance.panel === "basic") {
    return (
      <div
        className="w-full max-w-[240px] rounded-3xl border p-4 text-center backdrop-blur-md"
        key={`total-${pulseKey}`}
        style={{
          ...overlaySurface(appearance),
          color: ink,
          animation: "total-pop 480ms var(--ease-standard)",
        }}
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
          Round total
        </p>
        <p
          className="mt-1 font-black leading-none"
          style={{
            fontSize: figureSize(amount.length),
            animation: maxedOut ? "figure-flicker 1s linear" : undefined,
          }}
        >
          {amount}
        </p>
        <p className="mt-2 text-sm font-semibold opacity-75">{label}</p>
        {armed ? (
          <p className="mt-1 text-sm font-black" style={{ color: accent }}>
            {multiplier}× armed
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-[214px]"
      key={`cabinet-${pulseKey}`}
      style={{
        color: ink,
        animation: "total-pop 480ms var(--ease-standard)",
        // Derived, so the figure's border can never drift from the screens'.
        paddingTop: BUMP + BORDER,
        paddingBottom: BUMP + BORDER,
      }}
    >
      <Cabinet
        bottomScreen={
          <Screen
            // Inset by the same border on every side, so it is this extension's
            // own shape scaled down rather than a second shape laid on top.
            className="absolute grid place-items-center"
            face={chipFace}
            shape={tabScreenShape("bottom")}
          >
            <span
              className="whitespace-nowrap text-[1rem] font-black uppercase tracking-[0.02em] leading-none"
              // Keyed on the wording so a change remounts the span and replays
              // the slide, rather than swapping the text in place.
              key={label}
              style={{
                color: chipInk,
                animation: "label-slide 420ms var(--ease-standard)",
              }}
            >
              {label}
            </span>
          </Screen>
        }
        fillColor={surface}
        topScreen={
          <Screen
            className="absolute grid place-items-center"
            face={chipFace}
            shape={tabScreenShape("top")}
            // Nothing armed: the slot runs a glow across itself rather than
            // showing a placeholder figure, so it reads as waiting.
            wave={armed ? undefined : overlayGlow(appearance)}
          >
            {armed ? (
              <span
                className="text-xl font-black leading-none"
                style={{ color: chipInk }}
              >
                {`${multiplier}×`}
              </span>
            ) : null}
          </Screen>
        }
      />

      {/* The figure. */}
      <div
        className="relative"
        style={{ paddingLeft: BORDER, paddingRight: BORDER }}
      >
        <Screen
          className="relative rounded-[16px] px-2 py-3.5"
          deep
          face={displayFace}
        >
          <p
            className="flex items-center justify-center font-black leading-none"
            style={{
              color: screenInk,
              // Sized from the glyph count: a narrower screen means a five
              // figure total would run off the end at one fixed size.
              fontSize: figureSize(amount.length),
              // Maxed out: the figure cannot climb any further, so it flickers
              // rather than just sitting there as another number.
              // Once, not on a loop: it marks the moment a run tops out, and a
              // figure that flickers all round is just hard to read.
              animation: maxedOut ? "figure-flicker 1s linear" : undefined,
            }}
          >
            {amount.split("").map((char, index) => (
              <Reel char={char} key={`${index}-${char}`} />
            ))}
          </p>
        </Screen>
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
  const chipFace = overlayChipFace(appearance);
  const chipInk = overlayChipInk(appearance);
  const surface = overlaySurfaceSolid(appearance);
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

  // Built once and placed by whichever style is in use: the fill, its gradient,
  // and the marker riding its tip are the one part of this component that does
  // not change between them.
  const track = (
    <div
      className="relative h-3.5 rounded-full"
      style={{ backgroundColor: `${ink}1f` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-slow ease-standard"
        style={{
          width: `${progress * 100}%`,
          // Longhands rather than the shorthand: mixing `background` with
          // backgroundSize and backgroundRepeat is a React warning, and the
          // gradient needs both of those.
          backgroundColor: appearance.goalRainbow ? undefined : accent,
          backgroundImage: appearance.goalRainbow
            ? rainbowFill(appearance.vivid)
            : undefined,
          // The gradient belongs to the track, not to the fill. Left alone it
          // scales to whatever is filled, squeezing the whole rainbow into a
          // half-full bar — so the colour under the marker was never the colour
          // the marker had computed for that position.
          backgroundSize:
            appearance.goalRainbow && progress > 0
              ? `${100 / progress}% 100%`
              : undefined,
          backgroundRepeat: "no-repeat",
          boxShadow: `0 0 12px ${accent}66`,
        }}
      />
      {shape !== "none" && progress > 0 ? (
        <svg
          aria-hidden="true"
          className="absolute top-1/2 h-8 w-8 transition-[left] duration-slow ease-standard"
          // The translate lives in the transform rather than in a class so the
          // pulse keyframe can carry it too.
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
          {/* White body, edge in the colour the bar has reached. Colouring the
              body instead camouflaged it against the fill it rides. Painting
              the stroke before the fill keeps it outside the shape — a centred
              stroke eats half its width out of the white. */}
          <path
            d={GOAL_SHAPE_PATHS[shape]}
            fill="#fff"
            paintOrder="stroke"
            stroke={`url(#${markerGradientId})`}
            strokeLinejoin="round"
            strokeWidth="4.1"
          />
        </svg>
      ) : null}
    </div>
  );

  if (appearance.panel === "basic") {
    return (
      <div
        // Deeper at the bottom on purpose: the marker overhangs the track by
        // nine pixels and throws a glow past that, so equal padding would leave
        // it grazing the pill's edge.
        className="w-full max-w-[600px] rounded-full border px-5 pb-2.5 pt-2 backdrop-blur-md"
        style={{ ...overlaySurface(appearance), color: ink }}
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
        <div className="mt-2">{track}</div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-[600px]"
      style={{ color: ink, paddingTop: BUMP }}
    >
      {/* Not aria-hidden the way the counter's cabinet is: these tabs carry the
          label and the count, and on the Live page those are the streamer's
          editable controls rather than decoration. */}
      <Chrome>
        <Tab
          edge="top"
          fill={surface}
          style={{ left: 22, maxWidth: "calc(50% - 26px)" }}
          width={GOAL_LABEL_TAB}
        >
          <Screen
            className="absolute grid place-items-center px-2"
            face={chipFace}
            shape={tabScreenShape("top")}
          >
            <span
              className="w-full truncate text-center text-[1.2rem] font-black uppercase leading-none tracking-[0.01em]"
              style={{ color: chipInk }}
            >
              {goalLabel}
            </span>
          </Screen>
        </Tab>
        <Tab
          edge="top"
          fill={surface}
          style={{ right: 22, maxWidth: "calc(50% - 26px)" }}
          width={GOAL_FIGURE_TAB}
        >
          <Screen
            className="absolute grid place-items-center px-2"
            face={chipFace}
            shape={tabScreenShape("top")}
          >
            <span
              className="flex items-baseline whitespace-nowrap text-[1.2rem] font-black leading-none"
              style={{ color: chipInk }}
            >
              {currentControl ?? formatMoney(current)}
              {goalControl ? (
                <span className="opacity-60">/{goalControl}</span>
              ) : goalCents > 0 ? (
                <span className="opacity-60">/{formatMoney(goalCents)}</span>
              ) : null}
            </span>
          </Screen>
        </Tab>
        <div
          className="absolute inset-x-0 rounded-full"
          style={{
            backgroundColor: surface,
            top: BUMP,
            bottom: 0,
          }}
        />
      </Chrome>

      <div className="relative px-5 pb-2.5 pt-2.5">{track}</div>
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

  const basic = appearance.panel === "basic";
  const chipFace = overlayChipFace(appearance);
  const chipInk = overlayChipInk(appearance);
  const surface = overlaySurfaceSolid(appearance);

  // The list, and the caller-out above it for whoever is mid-run. Shared by
  // both styles: only the chrome around it differs.
  const list = (
    <>
      {spinningNow ? (
        <div className="border-b pb-2.5" style={{ borderColor: `${ink}1f` }}>
          <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] opacity-70">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            Spinning now
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {hideNames ? "A viewer" : spinningNow}
          </p>
        </div>
      ) : null}

      {visible.length ? (
        <ol className="grid gap-1.5">
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
        <p className="text-sm opacity-55">Nobody waiting</p>
      )}
    </>
  );

  if (basic) {
    return (
      <div
        className="w-full max-w-[320px] rounded-3xl border p-4 backdrop-blur-md"
        style={{ ...overlaySurface(appearance), color: ink }}
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

        <div className="mt-3 grid gap-3">{list}</div>

        {/* The overlay's one piece of branding in this style. It lives here
            rather than on the goal bar because this panel has the room. */}
        <p className="mt-3 text-right text-[0.6rem] font-semibold tracking-[0.12em] opacity-35">
          tributes.bio
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full min-w-[248px] max-w-[320px]"
      style={{ color: ink, paddingTop: BUMP }}
    >
      <Chrome>
        {/* The header earns the tab: it is a fixed label and a count, which is
            exactly what a screen this size holds, and it frees the panel below
            to be nothing but the list. */}
        <Tab
          edge="top"
          fill={surface}
          // Never wider than the panel it sits on, whatever the column it
          // lands in decides that panel should be.
          style={{ ...centeredTab(), maxWidth: "calc(100% - 28px)" }}
          width={QUEUE_TAB}
        >
          <Screen
            className="absolute flex items-center justify-center gap-2 px-3"
            face={chipFace}
            shape={tabScreenShape("top")}
          >
            <span
              className="text-[1.05rem] font-black uppercase leading-none tracking-[0.06em]"
              style={{ color: chipInk }}
            >
              Queue
            </span>
            <span
              className="rounded-full px-1.5 text-[0.85rem] font-black leading-tight"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              {waiting.length}
            </span>
          </Screen>
        </Tab>
        <div
          className="absolute inset-x-0 rounded-3xl"
          style={{
            backgroundColor: surface,
            top: BUMP,
            bottom: 0,
          }}
        />
      </Chrome>

      <div className="relative grid gap-3 px-4 pb-4 pt-3">{list}</div>
    </div>
  );
}
