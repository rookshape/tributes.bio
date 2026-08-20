import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { BioPageView } from "../components/BioPageView";
import { TributeForm } from "../components/TributeForm";
import {
  OverlayGoalBar,
  OverlayQueue,
  OverlayTotal,
  OverlayWheel,
} from "../components/overlay/OverlayParts";
import { Tabs, Toggle } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getCreatorWorkspace } from "../lib/bio";
import { DEFAULT_OVERLAY_APPEARANCE } from "../lib/overlayTheme";
import { DEFAULT_OVERLAY_SETTINGS, subscribeOverlaySettings } from "../lib/spinGoal";
import { getSpinConfig } from "../lib/spin";
import type { SpinOverlaySettings } from "../lib/spinGoal";
import type { CreatorLink, CreatorProfile, SpinConfig } from "../lib/types";

/**
 * A staging page for product shots.
 *
 * Everything here is the real component with the creator's own wheel, page, and
 * overlay theme — the point is that a screenshot taken from it is a screenshot
 * of the product, not of a mock-up that resembles it. Only the *state* is
 * invented, because a real account mid-session has an empty queue and a zero
 * total, which photographs as a product nobody is using.
 *
 * The chrome hides so the frame can be captured on its own.
 */

/** A run worth photographing: money on the board, a multiplier live. */
const SHOWCASE_STATE = {
  viewerName: "mossling",
  queueEntryId: "preview-1",
  counterCents: 24800,
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
  { id: "preview-1", viewerName: "mossling", amountCents: 1200, wheelName: null, status: "queued" },
  { id: "preview-2", viewerName: "bell", amountCents: 1200, wheelName: null, status: "queued" },
  { id: "preview-3", viewerName: "harrowmoth", amountCents: 1200, wheelName: null, status: "queued" },
] as never;

const PHONE = { width: 390, height: 844 };

export function PreviewPage() {
  const { appUser, loading, user } = useAuth();
  const creatorId = appUser?.creatorId ?? user?.uid;

  const [scene, setScene] = useState("bio");
  const [chrome, setChrome] = useState(true);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [spinConfig, setSpinConfig] = useState<SpinConfig | null>(null);
  const [settings, setSettings] = useState<SpinOverlaySettings>({
    creatorId: "",
    ...DEFAULT_OVERLAY_SETTINGS,
  });

  useEffect(() => {
    if (!creatorId) return;

    let active = true;

    void Promise.all([
      getCreatorWorkspace(creatorId),
      getSpinConfig(creatorId).catch(() => null),
    ]).then(([workspace, config]) => {
      if (!active) return;
      setProfile(workspace.profile);
      setLinks(workspace.links);
      setSpinConfig(config);
    });

    const unsubscribe = subscribeOverlaySettings(creatorId, setSettings);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [creatorId]);

  if (!loading && !user) return <Navigate replace to="/login" />;

  const appearance = settings.appearance ?? DEFAULT_OVERLAY_APPEARANCE;

  return (
    <main className="min-h-screen bg-canvas">
      {chrome ? (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Tabs
              items={[
                { value: "bio", label: "Bio page" },
                { value: "stream", label: "Stream overlay" },
              ]}
              label="Shot"
              onChange={setScene}
              value={scene}
            />
            <Toggle
              checked={chrome}
              description="Turn off to capture the frame on its own."
              label="Show controls"
              onChange={setChrome}
            />
          </div>
        </div>
      ) : (
        // Without the bar there has to be some way back, or the only exit from
        // a hidden-chrome page is the address bar.
        <button
          className="fixed right-3 top-3 z-50 rounded-control border border-line bg-surface px-3 py-1.5 text-caption text-content-muted opacity-30 transition-opacity hover:opacity-100"
          onClick={() => setChrome(true)}
          type="button"
        >
          Show controls
        </button>
      )}

      {scene === "bio" ? (
        <div className="grid place-items-center px-4 py-10">
          {/* A real phone frame rather than a tall column: the bio page is
              looked at on a phone, and a shot of it in any other proportion
              reads as a website that happens to be narrow. */}
          <div
            className="overflow-hidden rounded-[38px] bg-white shadow-[0_24px_60px_rgba(15,23,32,0.22)] ring-1 ring-line"
            style={{ height: PHONE.height, width: PHONE.width }}
          >
            <div className="h-full w-full overflow-y-auto">
              {profile ? (
                <BioPageView
                  links={links}
                  preview
                  profile={profile}
                  // Forced on, unlike the dashboard preview, which shows what a
                  // visitor would see. This one is for a photograph, and the
                  // tribute form is the thing being photographed — it should
                  // not depend on whether Stripe onboarding finished today.
                  topContent={<TributeForm preview profile={profile} />}
                />
              ) : null}
            </div>
          </div>
          {chrome ? (
            <p className="mt-4 text-caption text-content-subtle">
              {PHONE.width} × {PHONE.height}, the shape a phone screenshot comes
              out at.
            </p>
          ) : null}
        </div>
      ) : null}

      {scene === "stream" ? (
        <div className="px-4 py-10">
          {/* Checkerboard, because that is what the transparent areas are, and
              a shot taken against it can be dropped onto any background. */}
          <div
            className="mx-auto grid w-full max-w-4xl justify-items-center gap-9 rounded-panel p-10"
            style={{
              backgroundImage:
                "repeating-conic-gradient(rgba(15,23,32,0.07) 0% 25%, transparent 0% 50%)",
              backgroundSize: "24px 24px",
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-10">
              {/* The size the OBS source runs at, so the wheel is photographed
                  at the proportions it actually has on a stream rather than
                  squeezed into a thumbnail. */}
              <div className="w-[420px]">
                {spinConfig ? (
                  <OverlayWheel
                    animation={null}
                    appearance={appearance}
                    config={spinConfig}
                  />
                ) : null}
              </div>
              <OverlayTotal
                appearance={appearance}
                spinning={false}
                state={SHOWCASE_STATE}
              />
              <OverlayQueue
                appearance={appearance}
                entries={SHOWCASE_QUEUE}
                hideNames={settings.queueHideNames}
                maxVisible={settings.queueMaxVisible}
                state={SHOWCASE_STATE}
              />
            </div>
            <div className="w-full max-w-[600px]">
              <OverlayGoalBar
                appearance={appearance}
                goalCents={50000}
                goalLabel="Stream Goal"
                state={SHOWCASE_STATE}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
