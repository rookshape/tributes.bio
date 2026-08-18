import {
  Check,
  Clipboard,
  ExternalLink,
  LoaderCircle,
  Play,
  Plus,
  Radio,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EditableSpinWheel } from "../components/EditableSpinWheel";
import { type SpinAnimation } from "../components/SpinWheel";
import {
  OVERLAY_PARTS,
  OverlayGoalBar,
  OverlayQueue,
  OverlayWheel,
} from "../components/overlay/OverlayParts";
import { useAuth } from "../context/AuthContext";
import {
  createMockSpinEntry,
  getOrCreateSpinConfig,
  heartbeatSpinSession,
  saveSpinConfig,
  subscribeSpinQueue,
  subscribeSpinSession,
  subscribeSpinState,
  setSpinLiveStatus,
  spinSessionIsLive,
  triggerNextSpin,
} from "../lib/spin";
import {
  DEFAULT_GOAL_LABEL,
  saveSpinGoal,
  subscribeSpinGoal,
  type SpinGoal,
} from "../lib/spinGoal";
import {
  WHEEL_HUE_MAX,
  WHEEL_HUE_STEP,
  WHEEL_TONE_STEP,
  sliceColor,
  wheelHueTrack,
  wheelToneTrack,
} from "../lib/wheelPalette";
import type {
  SpinConfig,
  SpinQueueEntry,
  SpinSession,
  SpinSlice,
  SpinSliceType,
  SpinState,
} from "../lib/types";

const fieldClass = "field py-2.5";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function valueLabel(type: SpinSliceType) {
  if (type === "amount") return "Amount";
  if (type === "multiplier") return "Multiplier";
  if (type === "bonus") return "Spins";
  return "Action";
}

function sliceInputValue(slice: SpinSlice) {
  return slice.type === "amount" ? slice.value / 100 : slice.value;
}

export function SpinDashboardPage() {
  const { appUser, user } = useAuth();
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [queue, setQueue] = useState<SpinQueueEntry[]>([]);
  const [spinState, setSpinState] = useState<SpinState | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("Test viewer");
  const [now, setNow] = useState(Date.now());
  const [selectedSliceId, setSelectedSliceId] = useState("");
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [goal, setGoal] = useState<SpinGoal>({
    creatorId: "",
    label: DEFAULT_GOAL_LABEL,
    goalCents: 0,
  });
  const [savingGoal, setSavingGoal] = useState(false);

  const creatorId = appUser?.creatorId ?? user?.uid;
  const isCreator = appUser?.accountType === "creator" && Boolean(creatorId);

  useEffect(() => {
    if (!isCreator || !creatorId) {
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribers = [
      subscribeSpinQueue(creatorId, setQueue),
      subscribeSpinSession(creatorId, setSpinSession),
      subscribeSpinState(creatorId, setSpinState),
      subscribeSpinGoal(creatorId, setGoal),
    ];

    getOrCreateSpinConfig(creatorId)
      .then((nextConfig) => {
        if (active) {
          setConfig(nextConfig);
          setSelectedSliceId(nextConfig.slices[0]?.id ?? "");
        }
      })
      .catch((caughtError) => {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load Spin.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [creatorId, isCreator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!creatorId || spinSession?.manualLive !== true) {
      return;
    }

    const sendHeartbeat = () => {
      heartbeatSpinSession(creatorId).catch(() => undefined);
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 45000);
    return () => window.clearInterval(timer);
  }, [creatorId, spinSession?.manualLive]);

  const queuedEntries = useMemo(
    () => queue.filter((entry) => entry.status === "queued"),
    [queue],
  );
  const completedEntries = useMemo(
    () => queue.filter((entry) => entry.status === "completed").slice(-5).reverse(),
    [queue],
  );
  const spinning = Boolean(spinState && spinState.lockedUntilMs > now);
  const isLive = spinSessionIsLive(spinSession, now);
  const manualLive = spinSession?.manualLive === true;
  const animation: SpinAnimation | null =
    spinState?.spinId && spinState.selectedIndex !== null
      ? {
          id: spinState.spinId,
          selectedIndex: spinState.selectedIndex,
          startedAtMs: spinState.startedAtMs,
          durationMs: spinState.durationMs,
        }
      : null;

  if (!isCreator) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="text-2xl font-semibold">The wheel is for creator accounts</h1>
      </section>
    );
  }

  if (loading || !config || !creatorId) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  const changeConfig = (changes: Partial<SpinConfig>) => {
    setConfig((current) => (current ? { ...current, ...changes } : current));
    setSaved(false);
  };

  const changeSlice = (id: string, changes: Partial<SpinSlice>) => {
    changeConfig({
      slices: config.slices.map((slice) =>
        slice.id === id ? { ...slice, ...changes } : slice,
      ),
    });
  };

  // Slice colors are always a function of the wheel's hue/tone and position, so
  // any change to the slice list or the sliders repaints the whole wheel.
  const recolor = (slices: SpinSlice[], hue: number, tone: number) =>
    slices.map((slice, index) => ({
      ...slice,
      color: sliceColor({ hue, tone }, index, slices.length),
    }));

  const changeWheelAppearance = (
    changes: { wheelHue?: number; wheelTone?: number },
  ) => {
    const wheelHue = changes.wheelHue ?? config.wheelHue;
    const wheelTone = changes.wheelTone ?? config.wheelTone;
    changeConfig({
      wheelHue,
      wheelTone,
      slices: recolor(config.slices, wheelHue, wheelTone),
    });
  };

  // Slices are added and removed in pairs. An odd count would leave two
  // same-colored slices touching, since only two shades alternate.
  const newSlice = (): SpinSlice => ({
    id: crypto.randomUUID(),
    label: "New",
    type: "action" as SpinSliceType,
    value: 0,
    action: "",
    color: "",
  });

  const addSlice = () => {
    if (config.slices.length + 2 > 12) {
      setError("A wheel can hold at most 12 slices.");
      return;
    }

    const added = [newSlice(), newSlice()];
    const slices = [...config.slices, ...added];
    changeConfig({ slices: recolor(slices, config.wheelHue, config.wheelTone) });
    setSelectedSliceId(added[0].id);
  };

  const removeSlice = (id: string) => {
    if (config.slices.length <= 4) {
      setError("A wheel needs at least four slices.");
      return;
    }

    // Drop the selected slice plus its neighbour to keep the count even.
    const index = config.slices.findIndex((slice) => slice.id === id);
    const partnerIndex = index === config.slices.length - 1 ? index - 1 : index + 1;
    const removing = new Set([id, config.slices[partnerIndex].id]);
    const slices = config.slices.filter((slice) => !removing.has(slice.id));

    changeConfig({ slices: recolor(slices, config.wheelHue, config.wheelTone) });
    if (removing.has(selectedSliceId)) setSelectedSliceId(slices[0]?.id ?? "");
  };

  const save = async () => {
    if (isLive) {
      setError("End the live session before changing the wheel.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const normalized = await saveSpinConfig(config);
      setConfig(normalized);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the wheel.");
    } finally {
      setSaving(false);
    }
  };

  const addMockEntry = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setError(null);

    try {
      await createMockSpinEntry(creatorId, viewerName);
      setViewerName("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not add a test spin.");
    } finally {
      setWorking(false);
    }
  };

  const trigger = async () => {
    setWorking(true);
    setError(null);

    try {
      await triggerNextSpin(creatorId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not spin the wheel.");
    } finally {
      setWorking(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    setError(null);

    try {
      setGoal(await saveSpinGoal({ ...goal, creatorId }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the goal.");
    } finally {
      setSavingGoal(false);
    }
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

  const toggleLive = async () => {
    setWorking(true);
    setError(null);

    try {
      await setSpinLiveStatus(creatorId, !manualLive);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not change live status.",
      );
    } finally {
      setWorking(false);
    }
  };

  const overlayPath = `/overlay/${creatorId}/spin`;
  const viewerPath = `/${appUser?.username ?? ""}/spin`;
  const selectedSlice =
    config.slices.find((slice) => slice.id === selectedSliceId) ?? config.slices[0];

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1 className="page-title">Wheel</h1>
        <div className="flex items-center gap-2">
          <Link
            aria-label="Open viewer page"
            className="icon-button"
            target="_blank"
            title="Open viewer page"
            to={viewerPath}
          >
            <ExternalLink size={17} />
          </Link>
          {/* One control that states the current state and the action it takes,
              with a live dot rather than a colour change alone. */}
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

      {error ? <p className="status-error mt-5">{error}</p> : null}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section className="panel min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Wheel</h2>
              <p className="mt-1 text-sm text-content-muted">Select a slice to edit it.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <span>{config.isEnabled ? "Enabled" : "Disabled"}</span>
              <span className="relative h-7 w-12 rounded-full bg-surface-sunken transition has-[:checked]:bg-accent">
                <input
                  checked={config.isEnabled}
                  className="peer sr-only"
                  onChange={(event) => changeConfig({ isEnabled: event.target.checked })}
                  type="checkbox"
                />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </span>
            </label>
          </div>

          <div className="mt-5 grid items-center gap-6 lg:grid-cols-[minmax(300px,1.35fr)_minmax(230px,0.65fr)]">
            <EditableSpinWheel
              onAdd={addSlice}
              onSelect={setSelectedSliceId}
              selectedSliceId={selectedSlice?.id ?? ""}
              slices={config.slices}
            />

            {selectedSlice ? (
              <div className="panel-flat p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <SlidersHorizontal size={16} /> Slice
                  </div>
                  <button
                    aria-label={`Delete ${selectedSlice.label}`}
                    className="icon-button h-9 w-9 text-content-muted hover:text-red-600"
                    onClick={() => removeSlice(selectedSlice.id)}
                    title="Delete slice"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Label
                    <input
                      className={fieldClass}
                      maxLength={18}
                      onChange={(event) => changeSlice(selectedSlice.id, { label: event.target.value })}
                      value={selectedSlice.label}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Result
                    <select
                      className={fieldClass}
                      onChange={(event) => changeSlice(selectedSlice.id, { type: event.target.value as SpinSliceType })}
                      value={selectedSlice.type}
                    >
                      <option value="amount">Amount</option>
                      <option value="multiplier">Multiplier</option>
                      <option value="bonus">Bonus spin</option>
                      <option value="action">Action</option>
                    </select>
                  </label>
                  {selectedSlice.type === "action" ? (
                    <label className="grid gap-1.5 text-sm font-medium">
                      {valueLabel(selectedSlice.type)}
                      <input
                        className={fieldClass}
                        maxLength={80}
                        onChange={(event) => changeSlice(selectedSlice.id, { action: event.target.value })}
                        value={selectedSlice.action}
                      />
                    </label>
                  ) : (
                    <label className="grid gap-1.5 text-sm font-medium">
                      {valueLabel(selectedSlice.type)}
                      <input
                        className={fieldClass}
                        min="0"
                        onChange={(event) =>
                          changeSlice(selectedSlice.id, {
                            value:
                              selectedSlice.type === "amount"
                                ? Math.round(Number(event.target.value) * 100)
                                : Math.round(Number(event.target.value)),
                          })
                        }
                        step="1"
                        type="number"
                        value={sliceInputValue(selectedSlice)}
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Colour belongs to the whole wheel, not a slice — two shades
              alternate across every slice, so there is nothing per-slice to pick. */}
          <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <label className="block" htmlFor="wheel-hue">
              <span className="mb-2 block text-detail font-medium text-content-muted">
                Wheel color
              </span>
              <input
                className="theme-slider"
                id="wheel-hue"
                max={WHEEL_HUE_MAX}
                min={0}
                onChange={(event) => changeWheelAppearance({ wheelHue: Number(event.target.value) })}
                step={WHEEL_HUE_STEP}
                style={{ background: wheelHueTrack(config.wheelTone) }}
                type="range"
                value={config.wheelHue}
              />
            </label>
            <label className="block" htmlFor="wheel-tone">
              <span className="mb-2 block text-detail font-medium text-content-muted">
                Light to dark
              </span>
              <input
                className="theme-slider"
                id="wheel-tone"
                max={100}
                min={0}
                onChange={(event) => changeWheelAppearance({ wheelTone: Number(event.target.value) })}
                step={WHEEL_TONE_STEP}
                style={{ background: wheelToneTrack(config.wheelHue) }}
                type="range"
                value={config.wheelTone}
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 border-t border-white/80 pt-5 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Title
              <input className={fieldClass} maxLength={60} onChange={(event) => changeConfig({ title: event.target.value })} value={config.title} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Price
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-content-muted">$</span>
                <input className={`${fieldClass} pl-7`} min="1" onChange={(event) => changeConfig({ spinPriceCents: Math.round(Number(event.target.value) * 100) })} step="1" type="number" value={config.spinPriceCents / 100} />
              </div>
            </label>
          </div>

          <button className="primary-button mt-5 w-full sm:w-auto" disabled={saving || isLive} onClick={save} type="button">
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : saved ? <Check size={17} /> : <Save size={17} />}
            {saving ? "Saving" : saved ? "Saved" : "Save wheel"}
          </button>
        </section>

        <aside className="grid min-w-0 content-start gap-6">
          {/* One card per OBS browser source, each with its own URL. */}
          {OVERLAY_PARTS.map((overlayPart) => {
            const path = `${overlayPath}/${overlayPart.id}`;
            return (
              <section className="panel overflow-hidden p-4 sm:p-5" key={overlayPart.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{overlayPart.label}</p>
                    <p className="mt-0.5 text-xs text-content-subtle">{overlayPart.hint}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      aria-label={`Open ${overlayPart.label} overlay`}
                      className="icon-button h-9 w-9"
                      target="_blank"
                      title="Open in a new tab"
                      to={path}
                    >
                      <ExternalLink size={15} />
                    </Link>
                    <button
                      aria-label={`Copy ${overlayPart.label} overlay URL`}
                      className="icon-button h-9 w-9"
                      onClick={() => copyOverlayUrl(path)}
                      title="Copy browser source URL"
                      type="button"
                    >
                      {copiedPart === path ? <Check size={15} /> : <Clipboard size={15} />}
                    </button>
                  </div>
                </div>
                {/* A checkerboard stands in for the transparent background the
                    overlay actually renders on top of. */}
                <div
                  className="mt-4 grid place-items-center rounded-card border border-line p-4"
                  style={{
                    backgroundColor: "rgb(var(--surface))",
                    backgroundImage:
                      "linear-gradient(45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(-45deg, rgb(var(--surface-sunken)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(var(--surface-sunken)) 75%), linear-gradient(-45deg, transparent 75%, rgb(var(--surface-sunken)) 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                  }}
                >
                  {overlayPart.id === "wheel" ? (
                    <div className="w-full max-w-[240px]">
                      <OverlayWheel
                        animation={animation}
                        config={config}
                        spinning={spinning}
                        state={spinState}
                      />
                    </div>
                  ) : null}
                  {overlayPart.id === "bar" ? (
                    <OverlayGoalBar
                      config={config}
                      goalCents={goal.goalCents}
                      goalLabel={goal.label}
                      state={spinState}
                    />
                  ) : null}
                  {overlayPart.id === "queue" ? (
                    <OverlayQueue config={config} entries={queuedEntries} />
                  ) : null}
                </div>
              </section>
            );
          })}

          {/* The goal is creator-level: every wheel counts towards the same one. */}
          <section className="panel p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Tribute goal</h2>
            <p className="mt-0.5 text-xs text-content-subtle">
              Shared by every wheel. Counts everything your viewers send.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Label
                <input
                  className={fieldClass}
                  maxLength={40}
                  onChange={(event) => setGoal({ ...goal, label: event.target.value })}
                  value={goal.label}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Target
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-content-subtle">$</span>
                  <input
                    className={`${fieldClass} pl-7`}
                    min="0"
                    onChange={(event) =>
                      setGoal({
                        ...goal,
                        goalCents: Math.round(Number(event.target.value) * 100),
                      })
                    }
                    placeholder="0"
                    step="1"
                    type="number"
                    value={goal.goalCents ? goal.goalCents / 100 : ""}
                  />
                </div>
                <span className="text-xs font-normal text-content-subtle">
                  Leave empty for no target.
                </span>
              </label>
              <button
                className="primary-button w-full"
                disabled={savingGoal}
                onClick={saveGoal}
                type="button"
              >
                {savingGoal ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
                Save goal
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="panel mt-6 grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Queue</h2>
              <p className="mt-1 text-sm text-content-muted">Next up on stream</p>
            </div>
            <span className="grid h-8 min-w-8 place-items-center rounded-full bg-surface-raised px-2 text-sm font-semibold text-accent">{queuedEntries.length}</span>
          </div>
          <div className="mt-4 min-h-32 divide-y divide-white/80 border-y border-white/80">
            {queuedEntries.length ? queuedEntries.map((entry, index) => (
              <div className="flex items-center justify-between gap-4 py-3 text-sm" key={entry.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.viewerName}</p>
                  <p className="text-xs text-content-muted">{entry.source === "bonus" ? "Bonus spin" : entry.source === "payment" ? entry.authorizedTotalCents > 0 ? `Authorized ${formatMoney(entry.authorizedTotalCents)}` : `Paid ${formatMoney(entry.amountCents)}` : `Test ${formatMoney(entry.amountCents)}`}</p>
                </div>
                <span className="text-xs text-content-subtle">#{index + 1}</span>
              </div>
            )) : <p className="py-10 text-center text-sm text-content-muted">Queue is empty</p>}
          </div>
          <button className="blue-button mt-4 w-full" disabled={working || spinning || queuedEntries.length === 0} onClick={trigger} type="button">
            {working ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={17} />}
            {spinning ? "Spinning" : "Spin next"}
          </button>
        </div>

        <div className="min-w-0 border-t border-white/80 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <form className="grid gap-2" onSubmit={addMockEntry}>
            <label className="grid gap-1.5 text-sm font-medium">
              Test viewer
              <input className={fieldClass} maxLength={40} onChange={(event) => setViewerName(event.target.value)} placeholder="Viewer name" value={viewerName} />
            </label>
            <button className="secondary-button w-full" disabled={working} type="submit">Add test spin</button>
          </form>

          {completedEntries.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Recent</h3>
              <div className="mt-2 divide-y divide-white/80">
                {completedEntries.map((entry) => (
                  <div className="flex justify-between gap-3 py-2 text-sm" key={entry.id}>
                    <span className="truncate text-content-muted">{entry.viewerName}</span>
                    <span className="font-semibold">{entry.resultLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
