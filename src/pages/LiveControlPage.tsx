import {
  Check,
  Clipboard,
  ExternalLink,
  Play,
  Radio,
  ChevronDown,
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
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../lib/money";
import {
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
  saveSpinGoal,
  subscribeSpinGoal,
  type SpinGoal,
} from "../lib/spinGoal";
import {
  activateWheel,
  saveWheel,
  subscribeActiveWheelId,
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
 * The goal is the one number a streamer changes mid-stream, so the bar itself
 * is the control: click it and type. The bar stays the unmodified overlay
 * component so what is on screen here is exactly what is on stream.
 */
function LiveGoalBar({
  config,
  goal,
  onSave,
  state,
}: {
  config: SpinConfig;
  goal: SpinGoal;
  onSave: (goalCents: number) => Promise<void>;
  state: SpinState | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const open = () => {
    setDraft(goal.goalCents ? String(goal.goalCents / 100) : "");
    setEditing(true);
  };

  const commit = async () => {
    const goalCents = Math.max(0, Math.round(Number(draft) * 100) || 0);
    setSaving(true);
    try {
      await onSave(goalCents);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative w-full max-w-[600px]">
      <button
        aria-label="Edit the tribute goal"
        className="block w-full rounded-3xl text-left transition-transform duration-fast ease-standard hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        onClick={open}
        type="button"
      >
        <OverlayGoalBar
          config={config}
          goalCents={goal.goalCents}
          goalLabel={goal.label}
          state={state}
        />
      </button>

      {editing ? (
        <div className="panel absolute left-1/2 top-full z-10 mt-2 flex w-64 -translate-x-1/2 items-center gap-2 p-2 shadow-lg">
          <input
            className="field h-10 flex-1"
            inputMode="decimal"
            min="0"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commit();
              if (event.key === "Escape") setEditing(false);
            }}
            placeholder="Goal"
            ref={inputRef}
            step="1"
            type="number"
            value={draft}
          />
          <Button loading={saving} onClick={() => void commit()} variant="accent">
            Set
          </Button>
        </div>
      ) : null}
    </div>
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
  const [wheels, setWheels] = useState<SpinConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isCreator || !creatorId) return;

    const unsubscribers = [
      subscribeSpinConfig(creatorId, setConfig),
      subscribeSpinQueue(creatorId, setQueue),
      subscribeSpinSession(creatorId, setSession),
      subscribeSpinState(creatorId, setState),
      subscribeSpinGoal(creatorId, setGoal),
      subscribeWheels(creatorId, setWheels),
      subscribeActiveWheelId(creatorId, setActiveId),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [creatorId, isCreator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
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

      // Checkout refuses any wheel that is not enabled, and the viewer may pick
      // any offered one, so going live opens all of them.
      const offered = wheels.filter((wheel) => !wheel.archived && wheel.availableToViewers);

      await Promise.all(
        offered
          .filter((wheel) => !wheel.isEnabled)
          .map((wheel) => saveWheel({ ...wheel, isEnabled: true })),
      );

      const nowActive = offered.find((wheel) => wheel.id === activeId) ?? offered[0];
      if (nowActive) await activateWheel({ ...nowActive, isEnabled: true });

      await setSpinLiveStatus(creatorId, true);
    });

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
          disabled={spinning || queued.length === 0 || !manualLive}
          iconLeft={working ? undefined : <Play size={19} />}
          loading={working}
          onClick={() => void run(() => triggerNextSpin(creatorId))}
          size="lg"
          variant="accent"
        >
          {spinning ? "Spinning" : runOpen ? "Spin again" : "Spin"}
        </Button>
        <p className="min-w-0 flex-1 text-detail text-content-muted">
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
                  <p className="truncate text-detail font-semibold text-content">
                    {part.label}
                  </p>
                  <p className="truncate text-caption text-content-subtle">
                    {part.hint}
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
      </details>
      {/* The overlay itself, at working size. */}
      <div
        className="mt-5 rounded-panel border border-line p-5 sm:p-8"
        style={STAGE}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col items-center gap-6">
            <div className="w-full max-w-[420px]">
              <OverlayWheel
                animation={animation}
                config={shownWheel}
                spinning={spinning}
                state={state}
              />
            </div>
            <OverlayTotal config={shownWheel} spinning={spinning} state={state} />
            <LiveGoalBar
              config={config}
              goal={goal}
              onSave={(goalCents) =>
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
            <OverlayQueue config={config} entries={queued} />
          </div>
        </div>
      </div>

    </section>
  );
}
