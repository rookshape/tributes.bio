import {
  Check,
  Clipboard,
  ExternalLink,
  Play,
  Radio,
  ChevronDown,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { type SpinAnimation } from "../components/SpinWheel";
import {
  OVERLAY_PARTS,
  OverlayGoalBar,
  OverlayQueue,
  OverlayTotal,
  OverlayWheel,
} from "../components/overlay/OverlayParts";
import {
  Button,
  ButtonLink,
  EmptyState,
  IconButton,
  StatusMessage,
  Toggle,
  Tooltip,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../lib/money";
import {
  adjustSpinCounter,
  cancelSpinQueueEntry,
  createMockSpinEntry,
  heartbeatSpinSession,
  setSpinLiveStatus,
  spinSessionIsLive,
  subscribeSpinConfig,
  subscribeSpinQueue,
  subscribeSpinSession,
  subscribeSpinState,
  triggerNextSpin,
} from "../lib/spin";
import {
  DEFAULT_GOAL_LABEL,
  DEFAULT_OVERLAY_SETTINGS,
  OVERLAY_STALE_MS,
  saveOverlaySettings,
  saveSpinGoal,
  subscribeOverlaySettings,
  subscribeOverlayStatus,
  subscribeSpinGoal,
  type OverlayStatus,
  type SpinGoal,
  type SpinOverlaySettings,
} from "../lib/spinGoal";
import {
  SOUND_LABELS,
  playOverlaySound,
  unlockOverlayAudio,
} from "../lib/overlaySounds";
import {
  activateWheel,
  getActiveWheelId,
  listWheels,
  saveWheel,
  subscribeWheels,
} from "../lib/wheels";
import type {
  SpinConfig,
  SpinQueueEntry,
  SpinSession,
  SpinState,
} from "../lib/types";

/**
 * The Live page is the overlay. Rather than showing previews beside a separate
 * set of controls, it renders the same three components the OBS browser sources
 * render, from the same live data, and puts the only two things a streamer
 * touches mid-stream directly on them: the spin button, and the goal.
 *
 * Everything else — overlay URLs, a test spin — is setup, so it lives behind a
 * disclosure rather than taking up the surface.
 */

/** Signals the transparent region OBS will key out. */
const STAGE = {
  backgroundColor: "rgb(var(--surface))",
  backgroundImage:
    "linear-gradient(45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(-45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(var(--surface-sunken)) 75%), linear-gradient(-45deg, transparent 75%, rgb(var(--surface-sunken)) 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0",
} as const;

/**
 * A figure inside the goal bar that is edited in place. Used for both the
 * running total and the target, so a correction after a refund and a mid-stream
 * goal change work the same way: click the number and type.
 */
function InlineAmount({
  label,
  valueCents,
  onCommit,
}: {
  label: string;
  valueCents: number;
  onCommit: (cents: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settled = valueCents ? String(Math.round(valueCents / 100)) : "";
  const value = draft ?? settled;

  const commit = async () => {
    const pending = draft;
    setDraft(null);
    if (pending === null) return;

    const cents = Math.max(0, Math.round(Number(pending) * 100) || 0);
    if (cents === valueCents) return;

    await onCommit(cents);
  };

  return (
    <span className="inline-flex items-baseline">
      $
      <input
        aria-label={label}
        className="-my-1 rounded bg-transparent py-1 text-inherit outline-none transition-colors duration-fast hover:bg-black/[0.06] focus:bg-black/[0.06]"
        inputMode="numeric"
        onBlur={() => void commit()}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        placeholder="0"
        // Grows with the number so the bar does not jump as digits are typed.
        style={{ width: `${Math.max(1, value.length)}ch` }}
        value={value}
      />
    </span>
  );
}

/**
 * Both figures in the bar are editable: the target because a streamer moves it
 * mid-stream, and the total because refunds and disputes need correcting. The
 * bar is still the unmodified overlay component.
 */
function LiveGoalBar({
  config,
  goal,
  onSaveGoal,
  onCorrectTotal,
  state,
}: {
  config: SpinConfig;
  goal: SpinGoal;
  onSaveGoal: (goalCents: number) => Promise<void>;
  onCorrectTotal: (totalCents: number) => Promise<void>;
  state: SpinState | null;
}) {
  return (
    <OverlayGoalBar
      config={config}
      currentControl={
        <InlineAmount
          label="Tribute total"
          onCommit={onCorrectTotal}
          valueCents={state?.counterCents ?? 0}
        />
      }
      goalCents={goal.goalCents}
      goalControl={
        <InlineAmount
          label="Tribute Goal"
          onCommit={onSaveGoal}
          valueCents={goal.goalCents}
        />
      }
      goalLabel={goal.label}
      state={state}
    />
  );
}

export function LiveControlPage() {
  const { appUser, user } = useAuth();
  const creatorId = appUser?.creatorId ?? user?.uid;
  const isCreator = appUser?.accountType === "creator" && Boolean(creatorId);

  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [queue, setQueue] = useState<SpinQueueEntry[]>([]);
  const [state, setState] = useState<SpinState | null>(null);
  const [session, setSession] = useState<SpinSession | null>(null);
  const [goal, setGoal] = useState<SpinGoal>({
    creatorId: "",
    label: DEFAULT_GOAL_LABEL,
    goalCents: 0,
  });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [settings, setSettings] = useState<SpinOverlaySettings>({
    creatorId: "",
    ...DEFAULT_OVERLAY_SETTINGS,
  });
  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>({});
  /** Lets the key handler stay mounted once while calling the latest handler. */
  const spinRef = useRef<(() => void) | null>(null);
  const [wheels, setWheels] = useState<SpinConfig[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isCreator || !creatorId) return;

    const unsubscribers = [
      subscribeSpinConfig(creatorId, setConfig),
      subscribeSpinQueue(creatorId, setQueue),
      subscribeSpinSession(creatorId, setSession),
      subscribeSpinState(creatorId, setState),
      subscribeSpinGoal(creatorId, setGoal),
      subscribeOverlaySettings(creatorId, setSettings),
      subscribeOverlayStatus(creatorId, setOverlayStatus),
      subscribeWheels(creatorId, setWheels),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [creatorId, isCreator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  // Space spins. A streamer running a session is looking at their scene, not
  // at this page, so the primary action needs to work without aiming a cursor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName ?? "");
      if (typing) return;

      event.preventDefault();
      spinRef.current?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!creatorId || session?.manualLive !== true) return;

    const beat = () => heartbeatSpinSession(creatorId).catch(() => undefined);
    beat();
    const timer = window.setInterval(beat, 45000);
    return () => window.clearInterval(timer);
  }, [creatorId, session?.manualLive]);

  const queued = useMemo(
    () => queue.filter((entry) => entry.status === "queued"),
    [queue],
  );

  if (!isCreator || !creatorId) {
    return (
      <section className="page-shell max-w-2xl">
        <h1 className="page-title">Live control is for creator accounts</h1>
      </section>
    );
  }

  const spinning = Boolean(state && state.lockedUntilMs > now);
  const manualLive = session?.manualLive === true;
  const animation: SpinAnimation | null =
    state?.spinId && state.selectedIndex !== null
      ? {
          id: state.spinId,
          selectedIndex: state.selectedIndex,
          startedAtMs: state.startedAtMs,
          durationMs: state.durationMs,
        }
      : null;

  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "That did not work.");
    } finally {
      setWorking(false);
    }
  };

  const toggleLive = () =>
    void run(async () => {
      if (manualLive) {
        await setSpinLiveStatus(creatorId, false);
        return;
      }

      // Read the library rather than trusting subscription state: if the
      // snapshot has not arrived yet this would silently go live on a stale
      // active copy, and the streamer's latest wheel edits would never reach
      // the stream.
      const library = await listWheels(creatorId);
      // Checkout refuses any wheel that is not enabled, and the viewer may pick
      // any offered one, so going live opens all of them.
      const offered = library.filter((wheel) => !wheel.archived && wheel.availableToViewers);

      await Promise.all(
        offered
          .filter((wheel) => !wheel.isEnabled)
          .map((wheel) => saveWheel({ ...wheel, isEnabled: true })),
      );

      const currentActiveId = await getActiveWheelId(creatorId);
      const nowActive =
        offered.find((wheel) => wheel.id === currentActiveId) ?? offered[0];
      if (nowActive) await activateWheel({ ...nowActive, isEnabled: true });

      await setSpinLiveStatus(creatorId, true);
    });

  const saveSettings = (next: SpinOverlaySettings) => {
    setSettings(next);
    saveOverlaySettings({ ...next, creatorId }).catch(() =>
      setError("Could not save the overlay settings."),
    );
  };

  const copyOverlayUrl = (path: string) => {
    navigator.clipboard
      .writeText(`${window.location.origin}${path}`)
      .then(() => {
        setCopiedPart(path);
        window.setTimeout(() => setCopiedPart(null), 1600);
      })
      .catch(() => setError("Could not copy that URL."));
  };

  const overlayBase = `/overlay/${creatorId}/spin`;
  // A source that has not checked in recently is treated as gone, so closing
  // OBS shows up here rather than leaving a stale green dot.
  const connected = Object.fromEntries(
    OVERLAY_PARTS.map((part) => [
      part.id,
      now - (overlayStatus[part.id] ?? 0) < OVERLAY_STALE_MS,
    ]),
  );

  // No wheel activated yet, so there is nothing to run a session with.
  if (!config) {
    return (
      <section className="page-shell">
        <header className="page-header border-b border-line">
          <h1 className="page-title">Live</h1>
        </header>
        <EmptyState
          action={
            <ButtonLink to="/dashboard/spin" variant="accent">
              Go to your wheels
            </ButtonLink>
          }
          className="mt-6"
          description="Create a wheel and make it active, then come back here to run a session."
          title="No active wheel"
        />
      </section>
    );
  }

  // The stage follows the queue exactly as the overlay does: the wheel a spin
  // ran on, then the next viewer's once it settles.
  const shownWheelId = spinning
    ? state?.wheelId
    : (state?.nextWheelId ?? state?.wheelId);
  const shownWheel = wheels.find((wheel) => wheel.id === shownWheelId) ?? config;
  const nextUp = queued[0] ?? null;
  const runOpen = state?.tabOpen === true && !spinning;

  const canSpin = manualLive && queued.length > 0 && !spinning && !working;
  spinRef.current = canSpin
    ? () => void run(() => triggerNextSpin(creatorId))
    : null;

  const spinBlockedReason = !manualLive
    ? "Go live to open spins for your viewers."
    : queued.length === 0
      ? "Nobody is queued yet."
      : null;

  return (
    <section className="page-shell">
      <header className="page-header border-b border-line">
        <div className="min-w-0">
          <h1 className="page-title">Live</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            aria-label="Open viewer page"
            className="icon-button"
            target="_blank"
            title="Open viewer page"
            to={`/${appUser?.username ?? ""}/spin`}
          >
            <ExternalLink size={17} />
          </Link>
          <button
            className={
              manualLive
                ? "btn-base border border-critical/30 bg-critical/10 text-critical hover:bg-critical/20"
                : "blue-button"
            }
            disabled={working}
            onClick={toggleLive}
            type="button"
          >
            {manualLive ? (
              <>
                <span className="relative grid h-2.5 w-2.5 place-items-center">
                  <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-critical/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-critical" />
                </span>
                Live — end session
              </>
            ) : (
              <>
                <Radio size={16} />
                Go live
              </>
            )}
          </button>
        </div>
      </header>

      <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>

      {/* The only action, and the setup that sits beside it. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button
          className="min-w-48"
          disabled={!canSpin}
          iconLeft={working ? undefined : <Play size={19} />}
          loading={working}
          onClick={() => void run(() => triggerNextSpin(creatorId))}
          size="lg"
          variant="accent"
        >
          {spinning ? "Spinning" : runOpen ? "Spin again" : "Spin"}
        </Button>
        <p className="min-w-0 flex-1 text-detail text-content-muted">
          {manualLive && queued.length > 0 && !spinning ? (
            <span className="mr-1.5 rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-caption font-semibold">
              Space
            </span>
          ) : null}
          {spinBlockedReason ??
            (runOpen
              ? `${state?.viewerName} is on ${formatMoney(state?.tabCents ?? 0)}, ${state?.spinsLeft ?? 0} to go`
              : nextUp
                ? `${nextUp.viewerName}${nextUp.wheelName ? ` · ${nextUp.wheelName}` : ""}`
                : null)}
        </p>
      </div>

      {/* Setup, not stream controls. */}
      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-detail font-medium text-content-muted hover:text-content">
          <ChevronDown
            className="transition-transform duration-fast group-open:rotate-180"
            size={15}
          />
          OBS sources
        </summary>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OVERLAY_PARTS.map((part) => {
            const path = `${overlayBase}/${part.id}`;
            return (
              <div
                className="flex items-center justify-between gap-2 rounded-card border border-line p-3"
                key={part.id}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-detail font-semibold text-content">
                    {/* Whether OBS is actually pulling this source right now. */}
                    <Tooltip
                      content={
                        connected[part.id]
                          ? "Receiving live state"
                          : "Not connected — add this URL as a browser source"
                      }
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          connected[part.id] ? "bg-positive" : "bg-line-strong"
                        }`}
                      />
                    </Tooltip>
                    <span className="truncate">{part.label}</span>
                  </p>
                  <p className="truncate text-caption text-content-subtle">
                    {part.hint} · {part.size.width}×{part.size.height}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link
                    aria-label={`Open the ${part.label} overlay`}
                    className="icon-button h-8 w-8"
                    target="_blank"
                    title="Open in a new tab"
                    to={path}
                  >
                    <ExternalLink size={14} />
                  </Link>
                  <IconButton
                    icon={
                      copiedPart === path ? <Check size={14} /> : <Clipboard size={14} />
                    }
                    label={`Copy the ${part.label} overlay URL`}
                    onClick={() => copyOverlayUrl(path)}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            loading={working}
            onClick={() =>
              void run(() => createMockSpinEntry(creatorId, "Test viewer"))
            }
            size="sm"
            variant="secondary"
          >
            Queue a test spin
          </Button>
          <p className="text-caption text-content-subtle">
            Adds a fake viewer so you can check the sources land in your scene.
          </p>
        </div>

        {/* Sound plays from the Wheel source only, so a streamer running all
            four does not hear every effect four times over. */}
        <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <Toggle
              checked={settings.sound.enabled}
              description="Played by the Wheel source, so add it to your scene with audio enabled."
              label="Overlay sound"
              onChange={(enabled) =>
                saveSettings({ ...settings, sound: { ...settings.sound, enabled } })
              }
            />
            {settings.sound.enabled ? (
              <>
                <label className="mt-4 block" htmlFor="sound-volume">
                  <span className="mb-2 block text-detail font-medium text-content-muted">
                    Volume — {settings.sound.volume}%
                  </span>
                  <input
                    className="theme-slider"
                    id="sound-volume"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        sound: { ...settings.sound, volume: Number(event.target.value) },
                      })
                    }
                    onPointerUp={() => saveSettings(settings)}
                    step={5}
                    type="range"
                    value={settings.sound.volume}
                  />
                </label>
                <div className="mt-4 grid gap-2">
                  {SOUND_LABELS.map((sound) => (
                    <div className="flex items-center gap-2" key={sound.id}>
                      <div className="min-w-0 flex-1">
                        <Toggle
                          checked={settings.sound[sound.id]}
                          description={sound.hint}
                          label={sound.label}
                          onChange={(on) =>
                            saveSettings({
                              ...settings,
                              sound: { ...settings.sound, [sound.id]: on },
                            })
                          }
                        />
                      </div>
                      <Button
                        onClick={() => {
                          unlockOverlayAudio();
                          playOverlaySound(sound.id, { ...settings.sound, enabled: true });
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        Test
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div>
            <Toggle
              checked={settings.queueHideNames}
              description="Show positions instead of viewer names on the Queue source."
              label="Hide names"
              onChange={(queueHideNames) =>
                saveSettings({ ...settings, queueHideNames })
              }
            />
            <label className="mt-4 block" htmlFor="queue-visible">
              <span className="mb-2 block text-detail font-medium text-content-muted">
                Show {settings.queueMaxVisible} in the queue
              </span>
              <input
                className="theme-slider"
                id="queue-visible"
                max={10}
                min={1}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    queueMaxVisible: Number(event.target.value),
                  })
                }
                onPointerUp={() => saveSettings(settings)}
                step={1}
                type="range"
                value={settings.queueMaxVisible}
              />
            </label>
            <p className="mt-2 text-caption text-content-subtle">
              Anyone past that shows as an overflow count.
            </p>
          </div>
        </div>
      </details>
      {/* The overlay itself, at working size. */}
      <div
        className="mt-5 rounded-panel border border-line p-5 sm:p-8"
        style={STAGE}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col items-center gap-6">
            {/* The total sits beside the wheel, where the eye already is during
                a spin, rather than stacked underneath it. */}
            <div className="flex w-full flex-wrap items-center justify-center gap-6">
              <div className="w-full max-w-[380px]">
                <OverlayWheel animation={animation} config={shownWheel} />
              </div>
              <OverlayTotal config={shownWheel} spinning={spinning} state={state} />
            </div>
            <LiveGoalBar
              config={config}
              goal={goal}
              onCorrectTotal={async (totalCents) => {
                // The callable takes a delta, so a corrected figure becomes the
                // difference from whatever the counter reads right now.
                const delta = totalCents - (state?.counterCents ?? 0);
                if (delta !== 0) await adjustSpinCounter(creatorId, delta);
              }}
              onSaveGoal={(goalCents) =>
                saveSpinGoal({
                  ...goal,
                  creatorId,
                  goalCents,
                  label: DEFAULT_GOAL_LABEL,
                }).then(setGoal)
              }
              state={state}
            />
          </div>
          <div className="mx-auto w-full max-w-[320px] lg:mx-0">
            <OverlayQueue
              config={config}
              entries={queued}
              entryControl={(entry) => (
                <Tooltip content="Remove and release their hold">
                  <IconButton
                    className="h-7 w-7 border-none bg-transparent opacity-40 hover:opacity-100"
                    icon={<X size={14} />}
                    label={`Remove ${entry.viewerName} from the queue`}
                    onClick={() =>
                      void run(() => cancelSpinQueueEntry(creatorId, entry.id))
                    }
                  />
                </Tooltip>
              )}
              hideNames={settings.queueHideNames}
              maxVisible={settings.queueMaxVisible}
              state={state}
            />
          </div>
        </div>
      </div>

    </section>
  );
}
