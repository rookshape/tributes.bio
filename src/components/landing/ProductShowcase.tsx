import { BioPageView } from "../BioPageView";
import { TributeForm } from "../TributeForm";
import {
  OverlayGoalBar,
  OverlayQueue,
  OverlayTotal,
  OverlayWheel,
} from "../overlay/OverlayParts";
import { sliceColor } from "../../lib/wheelPalette";
import { createDefaultSpinConfig } from "../../lib/spin";
import type {
  CreatorLink,
  CreatorProfile,
  SpinConfig,
  SpinSlice,
} from "../../lib/types";

/**
 * The landing page's product shots, except they are the product.
 *
 * These were screenshots. Screenshots of a live product go stale the first time
 * anything moves, blur on a display they were not captured for, and have to be
 * retaken by hand — and the one thing this page has to establish, for a visitor
 * and for a payment processor alike, is what the thing actually looks like.
 *
 * The content is a real creator page and a real wheel, copied here as fixed
 * values rather than fetched. A public marketing page should not depend on an
 * account staying published, and the avatar is served from our own assets
 * rather than from the storage bucket it was uploaded to.
 */

const WHEEL_APPEARANCE = { hue: 255, tone: 0 };

const SHOWCASE_SLICES: Omit<SpinSlice, "color">[] = [
  { id: "s1", label: "$5", type: "amount", value: 500, action: "" },
  { id: "s2", label: "2x", type: "multiplier", value: 2, action: "" },
  { id: "s3", label: "+1", type: "bonus", value: 1, action: "" },
  { id: "s4", label: "$20", type: "amount", value: 2000, action: "" },
  { id: "s5", label: "Chat", type: "action", value: 0, action: "Chat chooses" },
  { id: "s6", label: "$10", type: "amount", value: 1000, action: "" },
  { id: "s7", label: "Cards", type: "action", value: 0, action: "" },
  { id: "s8", label: "+2", type: "bonus", value: 2, action: "" },
  { id: "s9", label: "$60", type: "amount", value: 6000, action: "" },
  { id: "s10", label: "Dice", type: "action", value: 0, action: "" },
];

const SHOWCASE_WHEEL: SpinConfig = {
  ...createDefaultSpinConfig("showcase"),
  name: "Greater Wheel",
  wheelHue: WHEEL_APPEARANCE.hue,
  wheelTone: WHEEL_APPEARANCE.tone,
  wheelGlow: true,
  slices: SHOWCASE_SLICES.map((slice, index) => ({
    ...slice,
    color: sliceColor(WHEEL_APPEARANCE, index, SHOWCASE_SLICES.length),
  })),
};

const SHOWCASE_PROFILE = {
  id: "showcase",
  ownerUid: "showcase",
  username: "zoeyrose",
  displayName: "Zoey",
  bio: "Hi I'm Zoey",
  photoPath: null,
  photoURL: "/showcase-avatar.jpg",
  appearance: { hue: 0, tone: 0 },
  isPublished: true,
  tipsEnabled: true,
  moderationStatus: "active",
} as unknown as CreatorProfile;

const SHOWCASE_LINKS: CreatorLink[] = [
  { id: "l1", title: "My Website", url: "https://website.com/", position: 0, isActive: true },
  { id: "l2", title: "Instagram", url: "https://instagram.com/", position: 1, isActive: true },
  { id: "l3", title: "X", url: "https://x.com/", position: 2, isActive: true },
];

const OVERLAY_APPEARANCE = {
  hue: 255,
  tone: 5,
  vivid: true,
  goalShape: "star",
  goalRainbow: false,
  panel: "cabinet",
} as const;

/** A round worth showing: money on the board and a multiplier still live. */
const SHOWCASE_STATE = {
  viewerName: "mossling",
  queueEntryId: "q1",
  counterCents: 59400,
  tabCents: 4500,
  tabBeforeCents: 4500,
  tabMaxCents: 20000,
  spinsLeft: 2,
  spinsLeftBefore: 2,
  pendingMultiplier: 2,
  pendingMultiplierBefore: 2,
  tabOpen: true,
  lockedUntilMs: 0,
} as never;

const SHOWCASE_QUEUE = [
  { id: "q1", viewerName: "mossling", amountCents: 1200, wheelName: null, status: "queued" },
  { id: "q2", viewerName: "bell", amountCents: 1200, wheelName: null, status: "queued" },
  { id: "q3", viewerName: "harrowmoth", amountCents: 1200, wheelName: null, status: "queued" },
] as never;

export function BioShowcase() {
  return (
    <div
      aria-label="A creator page with links and a form for sending a tribute"
      className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[34px] bg-white shadow-[0_20px_50px_rgba(15,23,32,0.16)] ring-1 ring-line"
      role="img"
    >
      {/* Inert: nothing here should be clickable, and the form must not try to
          start a checkout for a creator this page invented. */}
      <div className="pointer-events-none select-none">
        <BioPageView
          links={SHOWCASE_LINKS}
          preview
          profile={SHOWCASE_PROFILE}
          topContent={<TributeForm preview profile={SHOWCASE_PROFILE} />}
        />
      </div>
    </div>
  );
}

/**
 * The four overlay sources, laid out as a streamer would place them.
 *
 * Not in a frame. They are four independent OBS sources arranged across a
 * scene, and boxing them up says the opposite — so they sit loose, at the
 * offsets and sizes someone would actually give them, with the wheel dominant
 * and the rest tucked around it.
 */
export function StreamShowcase() {
  return (
    <div
      aria-label="A spin wheel, a running total, a queue, and a goal bar over a stream"
      className="pointer-events-none relative mx-auto w-full max-w-[880px] select-none"
      role="img"
    >
      <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-8 lg:flex-nowrap">
        <div className="w-[240px] shrink-0 sm:w-[300px]">
          <OverlayWheel
            animation={null}
            appearance={OVERLAY_APPEARANCE}
            config={SHOWCASE_WHEEL}
          />
        </div>

        {/* Raised against the wheel rather than sitting level with it, the way
            these end up on a real scene. */}
        <div className="flex flex-col items-center gap-8 lg:-translate-y-10">
          <OverlayTotal
            appearance={OVERLAY_APPEARANCE}
            spinning={false}
            state={SHOWCASE_STATE}
          />
          <div className="w-[260px]">
            <OverlayQueue
              appearance={OVERLAY_APPEARANCE}
              entries={SHOWCASE_QUEUE}
              hideNames={false}
              maxVisible={3}
              state={SHOWCASE_STATE}
            />
          </div>
        </div>
      </div>

      {/* Along the bottom, which is where a goal bar lives. */}
      <div className="mx-auto mt-8 w-full max-w-[620px] lg:-mt-2">
        <OverlayGoalBar
          appearance={OVERLAY_APPEARANCE}
          goalCents={100000}
          goalLabel="Tribute Goal"
          state={SHOWCASE_STATE}
        />
      </div>
    </div>
  );
}
