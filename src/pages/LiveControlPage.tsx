import {
  Check,
  Clipboard,
  ExternalLink,
  LoaderCircle,
  Play,
  Radio,
  Save,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type SpinAnimation } from "../components/SpinWheel";
import { WheelThumbnail } from "../components/WheelThumbnail";
import {
  OVERLAY_PARTS,
  OverlayGoalBar,
  OverlayQueue,
  OverlayWheel,
} from "../components/overlay/OverlayParts";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  IconButton,
  Input,
  StatusMessage,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const CHECKERBOARD = {
  backgroundColor: "rgb(var(--surface))",
  backgroundImage:
    "linear-gradient(45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(-45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(var(--surface-sunken)) 75%), linear-gradient(-45deg, transparent 75%, rgb(var(--surface-sunken)) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
} as const;

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
  const [savingGoal, setSavingGoal] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("Test viewer");
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
  const completed = useMemo(
    () => queue.filter((entry) => entry.status === "completed").slice(-5).reverse(),
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
  const isLive = spinSessionIsLive(session, now);
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

  const activeWheel = wheels.find((wheel) => wheel.id === activeId) ?? null;

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

  const addTestSpin = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await createMockSpinEntry(creatorId, viewerName);
      setViewerName("");
    });
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

  return (
    <section className="page-shell">
      <header className="page-header border-b border-line">
        <div className="min-w-0">
          <h1 className="page-title">Live</h1>
          <p className="page-subtitle">
            {manualLive
              ? "Your session is running. Spin each viewer as they come up."
              : "Go live to open spins for your viewers."}
          </p>
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

      {/* The viewer picks the wheel when they pay, so this reports what is
          coming rather than offering a choice. */}
      <section className="panel mt-5 flex items-center gap-4 p-5">
        <WheelThumbnail className="w-20 shrink-0" slices={config.slices} />
        <div className="min-w-0">
          <p className="text-caption text-content-muted">
            {queued.length ? "Next up" : "On the overlay"}
          </p>
          <p className="truncate text-title font-semibold text-content">{config.name}</p>
          <p className="mt-0.5 text-caption text-content-muted">
            Viewers choose their own wheel when they pay.{" "}
            <Link className="font-medium text-accent hover:underline" to="/dashboard/spin">
              Manage wheels
            </Link>
          </p>
        </div>
      </section>

      <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
        <div className="grid min-w-0 content-start gap-6">
          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-title font-semibold text-content">Queue</h2>
                <p className="mt-1 text-detail text-content-muted">Next up on stream</p>
              </div>
              <Badge tone={queued.length ? "accent" : "neutral"}>{queued.length}</Badge>
            </div>

            <div className="mt-4 min-h-28 divide-y divide-line border-y border-line">
              {queued.length ? (
                queued.map((entry, index) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={entry.id}>
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-content">
                        {entry.viewerName}
                      </p>
                      <p className="text-caption text-content-muted">
                        {entry.source === "bonus"
                          ? "Bonus spin"
                          : entry.source === "payment"
                            ? entry.authorizedTotalCents > 0
                              ? `Authorized ${formatMoney(entry.authorizedTotalCents)}`
                              : `Paid ${formatMoney(entry.amountCents)}`
                            : `Test ${formatMoney(entry.amountCents)}`}
                      </p>
                    </div>
                    <span className="text-caption text-content-subtle">#{index + 1}</span>
                  </div>
                ))
              ) : (
                <p className="py-9 text-center text-detail text-content-muted">
                  Queue is empty
                </p>
              )}
            </div>

            <Button
              block
              className="mt-4"
              disabled={spinning || queued.length === 0}
              iconLeft={working ? undefined : <Play size={17} />}
              loading={working}
              onClick={() => void run(() => triggerNextSpin(creatorId))}
              variant="accent"
            >
              {spinning ? "Spinning" : "Spin next"}
            </Button>

            <form className="mt-5 grid gap-2 border-t border-line pt-5 sm:grid-cols-[1fr_auto]" onSubmit={addTestSpin}>
              <Input
                label="Test viewer"
                maxLength={40}
                onChange={(event) => setViewerName(event.target.value)}
                placeholder="Viewer name"
                value={viewerName}
              />
              <Button className="sm:mt-[26px]" loading={working} type="submit" variant="secondary">
                Add test spin
              </Button>
            </form>

            {completed.length ? (
              <div className="mt-5 border-t border-line pt-5">
                <h3 className="text-detail font-semibold text-content">Recent results</h3>
                <div className="mt-2 divide-y divide-line">
                  {completed.map((entry) => (
                    <div className="flex justify-between gap-3 py-2 text-detail" key={entry.id}>
                      <span className="truncate text-content-muted">{entry.viewerName}</span>
                      <span className="font-semibold text-content">{entry.resultLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel p-5">
            <h2 className="text-title font-semibold text-content">Tribute goal</h2>
            <p className="mt-1 text-detail text-content-muted">
              Shared by every wheel. Counts everything your viewers send.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                label="Goal"
                min="0"
                onChange={(event) =>
                  setGoal({ ...goal, goalCents: Math.round(Number(event.target.value) * 100) })
                }
                placeholder="0"
                prefix="$"
                step="1"
                type="number"
                value={goal.goalCents ? goal.goalCents / 100 : ""}
              />
              <Button
                className="sm:mt-[26px]"
                iconLeft={<Save size={16} />}
                loading={savingGoal}
                onClick={() => {
                  setSavingGoal(true);
                  saveSpinGoal({ ...goal, creatorId, label: DEFAULT_GOAL_LABEL })
                    .then(setGoal)
                    .catch((caughtError) =>
                      setError(
                        caughtError instanceof Error
                          ? caughtError.message
                          : "Could not save the goal.",
                      ),
                    )
                    .finally(() => setSavingGoal(false));
                }}
                variant="secondary"
              >
                Save
              </Button>
            </div>
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-4">
          {OVERLAY_PARTS.map((part) => {
            const path = `${overlayBase}/${part.id}`;
            return (
              <section className="panel overflow-hidden p-4" key={part.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-detail font-semibold text-content">{part.label}</p>
                    <p className="mt-0.5 text-caption text-content-subtle">{part.hint}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      aria-label={`Open ${part.label} overlay`}
                      className="icon-button h-9 w-9"
                      target="_blank"
                      title="Open in a new tab"
                      to={path}
                    >
                      <ExternalLink size={15} />
                    </Link>
                    <IconButton
                      icon={copiedPart === path ? <Check size={15} /> : <Clipboard size={15} />}
                      label={`Copy ${part.label} overlay URL`}
                      onClick={() => copyOverlayUrl(path)}
                      size="sm"
                    />
                  </div>
                </div>

                <div
                  className="mt-4 grid place-items-center rounded-card border border-line p-4"
                  style={CHECKERBOARD}
                >
                  {part.id === "wheel" ? (
                    <div className="w-full max-w-[210px]">
                      <OverlayWheel
                        animation={animation}
                        config={config}
                        spinning={spinning}
                        state={state}
                      />
                    </div>
                  ) : null}
                  {part.id === "bar" ? (
                    <OverlayGoalBar
                      config={config}
                      goalCents={goal.goalCents}
                      goalLabel={goal.label}
                      state={state}
                    />
                  ) : null}
                  {part.id === "queue" ? (
                    <OverlayQueue config={config} entries={queued} />
                  ) : null}
                </div>
              </section>
            );
          })}
          {!isLive ? (
            <p className="text-caption text-content-subtle">
              The overlay stays blank for viewers until you go live.
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
