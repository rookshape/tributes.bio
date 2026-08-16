import {
  Check,
  Clipboard,
  ExternalLink,
  LoaderCircle,
  Minus,
  Play,
  Plus,
  Radio,
  Save,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpinWheel, type SpinAnimation } from "../components/SpinWheel";
import { useAuth } from "../context/AuthContext";
import {
  adjustSpinCounter,
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
import type {
  SpinConfig,
  SpinQueueEntry,
  SpinSession,
  SpinSlice,
  SpinSliceType,
  SpinState,
} from "../lib/types";

const fieldClass =
  "w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-600";

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
  const [adjustment, setAdjustment] = useState("1");
  const [now, setNow] = useState(Date.now());

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
    ];

    getOrCreateSpinConfig(creatorId)
      .then((nextConfig) => {
        if (active) setConfig(nextConfig);
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
    if (!creatorId || spinSession?.status !== "live") {
      return;
    }

    const sendHeartbeat = () => {
      heartbeatSpinSession(creatorId).catch(() => undefined);
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 45000);
    return () => window.clearInterval(timer);
  }, [creatorId, spinSession?.status]);

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
        <h1 className="text-2xl font-semibold">Spin is for creator accounts</h1>
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

  const addSlice = () => {
    changeConfig({
      slices: [
        ...config.slices,
        {
          id: crypto.randomUUID(),
          label: "New",
          type: "action",
          value: 0,
          action: "",
          color: "#475569",
        },
      ],
    });
  };

  const removeSlice = (id: string) => {
    if (config.slices.length <= 2) {
      setError("A wheel needs at least two slices.");
      return;
    }

    changeConfig({ slices: config.slices.filter((slice) => slice.id !== id) });
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

  const adjustCounter = async (direction: 1 | -1) => {
    const cents = Math.round(Number(adjustment) * 100) * direction;

    if (!Number.isFinite(cents) || cents === 0) {
      setError("Enter a counter adjustment.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await adjustSpinCounter(creatorId, cents);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not adjust the counter.");
    } finally {
      setWorking(false);
    }
  };

  const toggleLive = async () => {
    setWorking(true);
    setError(null);

    try {
      await setSpinLiveStatus(creatorId, !isLive);
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

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-3xl font-semibold">Spin</h1>
          <p className="mt-1 text-sm text-zinc-500">{isLive ? "Live" : "Offline"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`flex h-10 items-center gap-2 px-3 text-sm font-semibold text-white disabled:opacity-50 ${isLive ? "bg-red-600" : "bg-tribute"}`}
            disabled={working}
            onClick={toggleLive}
            type="button"
          >
            <Radio size={16} /> {isLive ? "End live" : "Go live"}
          </button>
          <Link className="flex h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold" target="_blank" to={viewerPath}>
            <ExternalLink size={16} /> Viewer
          </Link>
          <Link className="flex h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold" target="_blank" to={overlayPath}>
            <ExternalLink size={16} /> Overlay
          </Link>
          <button className="grid h-10 w-10 place-items-center border border-zinc-300 bg-white" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${overlayPath}`)} title="Copy overlay URL" type="button">
            <Clipboard size={16} />
          </button>
        </div>
      </div>

      {error ? <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[minmax(300px,0.9fr)_minmax(320px,1.1fr)_minmax(280px,0.8fr)]">
        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Wheel</h2>
            <div className="grid gap-2 text-sm font-medium">
              <label className="flex items-center justify-end gap-2">
                <input checked={config.isEnabled} onChange={(event) => changeConfig({ isEnabled: event.target.checked })} type="checkbox" />
                Enabled
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Title
              <input className={fieldClass} maxLength={60} onChange={(event) => changeConfig({ title: event.target.value })} value={config.title} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Base amount
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                <input className={`${fieldClass} pl-7`} min="1" onChange={(event) => changeConfig({ spinPriceCents: Math.round(Number(event.target.value) * 100) })} step="1" type="number" value={config.spinPriceCents / 100} />
              </div>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Counter label
              <input className={fieldClass} maxLength={40} onChange={(event) => changeConfig({ counterLabel: event.target.value })} value={config.counterLabel} />
            </label>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-zinc-200 pt-5">
            <h3 className="text-sm font-semibold">Slices</h3>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-tribute disabled:opacity-40" disabled={config.slices.length >= 12} onClick={addSlice} type="button">
              <Plus size={15} /> Add
            </button>
          </div>

          <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">
            {config.slices.map((slice) => (
              <div className="grid gap-3 py-4" key={slice.id}>
                <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(105px,0.8fr)_36px] gap-2">
                  <input aria-label={`${slice.label} color`} className="h-10 w-9 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => changeSlice(slice.id, { color: event.target.value })} type="color" value={slice.color} />
                  <input aria-label="Slice label" className={fieldClass} maxLength={18} onChange={(event) => changeSlice(slice.id, { label: event.target.value })} value={slice.label} />
                  <select aria-label="Slice type" className={fieldClass} onChange={(event) => changeSlice(slice.id, { type: event.target.value as SpinSliceType })} value={slice.type}>
                    <option value="amount">Amount</option>
                    <option value="multiplier">Multiplier</option>
                    <option value="bonus">Bonus spin</option>
                    <option value="action">Action</option>
                  </select>
                  <button aria-label={`Delete ${slice.label}`} className="grid h-10 w-9 place-items-center text-zinc-500 hover:text-red-600" onClick={() => removeSlice(slice.id)} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
                {slice.type === "action" ? (
                  <label className="grid gap-1 text-xs font-medium text-zinc-500">
                    {valueLabel(slice.type)}
                    <input className={fieldClass} maxLength={80} onChange={(event) => changeSlice(slice.id, { action: event.target.value })} value={slice.action} />
                  </label>
                ) : (
                  <label className="grid gap-1 text-xs font-medium text-zinc-500">
                    {valueLabel(slice.type)}
                    <input className={fieldClass} min="0" onChange={(event) => changeSlice(slice.id, { value: slice.type === "amount" ? Math.round(Number(event.target.value) * 100) : Math.round(Number(event.target.value)) })} step={slice.type === "amount" ? "1" : "1"} type="number" value={sliceInputValue(slice)} />
                  </label>
                )}
              </div>
            ))}
          </div>

          <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || isLive} onClick={save} type="button">
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : saved ? <Check size={17} /> : <Save size={17} />}
            {saving ? "Saving" : saved ? "Saved" : "Save wheel"}
          </button>
        </section>

        <section className="min-w-0 border-y border-zinc-200 bg-zinc-950 px-6 py-8 text-white lg:border-y-0 lg:border-x">
          <div className="mx-auto w-full max-w-[500px]">
            <p className="text-center text-sm font-semibold text-zinc-400">{config.title}</p>
            <div className="mt-5">
              <SpinWheel animation={animation} slices={config.slices} />
            </div>
            <div className="mt-5 min-h-16 text-center">
              {spinState?.resultLabel ? (
                <>
                  <p className="text-sm text-zinc-400">{spinState.viewerName}</p>
                  <p className="mt-1 text-2xl font-semibold">{spinning ? "Spinning" : spinState.resultLabel}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Ready</p>
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">{config.counterLabel}</p>
          <p className="mt-1 text-4xl font-semibold">{formatMoney(spinState?.counterCents ?? 0)}</p>

          <div className="mt-4 grid grid-cols-[36px_minmax(0,1fr)_36px] gap-2">
            <button aria-label="Subtract from counter" className="grid h-10 place-items-center border border-zinc-300 bg-white" disabled={working} onClick={() => adjustCounter(-1)} type="button"><Minus size={16} /></button>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input aria-label="Counter adjustment" className={`${fieldClass} h-10 pl-7 text-center`} min="0.01" onChange={(event) => setAdjustment(event.target.value)} step="0.01" type="number" value={adjustment} />
            </div>
            <button aria-label="Add to counter" className="grid h-10 place-items-center border border-zinc-300 bg-white" disabled={working} onClick={() => adjustCounter(1)} type="button"><Plus size={16} /></button>
          </div>

          <div className="mt-8 flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-lg font-semibold">Queue</h2>
            <span className="text-sm text-zinc-500">{queuedEntries.length}</span>
          </div>

          <form className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={addMockEntry}>
            <input aria-label="Test viewer name" className={fieldClass} maxLength={40} onChange={(event) => setViewerName(event.target.value)} placeholder="Viewer name" value={viewerName} />
            <button className="h-10 bg-zinc-100 px-3 text-sm font-semibold disabled:opacity-50" disabled={working} type="submit">Add test</button>
          </form>

          <div className="mt-4 min-h-40 divide-y divide-zinc-200 border-y border-zinc-200">
            {queuedEntries.length ? queuedEntries.map((entry, index) => (
              <div className="flex items-center justify-between gap-4 py-3 text-sm" key={entry.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.viewerName}</p>
                  <p className="text-xs text-zinc-500">{entry.source === "bonus" ? "Bonus spin" : entry.source === "payment" ? entry.authorizedTotalCents > 0 ? `Authorized ${formatMoney(entry.authorizedTotalCents)}` : `Paid ${formatMoney(entry.amountCents)}` : `Test ${formatMoney(entry.amountCents)}`}</p>
                </div>
                <span className="text-xs text-zinc-400">#{index + 1}</span>
              </div>
            )) : <p className="py-8 text-center text-sm text-zinc-500">Queue is empty</p>}
          </div>

          <button className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-tribute px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={working || spinning || queuedEntries.length === 0} onClick={trigger} type="button">
            {working ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={17} />}
            {spinning ? "Spinning" : "Spin next"}
          </button>

          {completedEntries.length ? (
            <div className="mt-8">
              <h3 className="text-sm font-semibold">Recent</h3>
              <div className="mt-2 divide-y divide-zinc-200">
                {completedEntries.map((entry) => (
                  <div className="flex justify-between gap-3 py-2 text-sm" key={entry.id}>
                    <span className="truncate text-zinc-600">{entry.viewerName}</span>
                    <span className="font-semibold">{entry.resultLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
