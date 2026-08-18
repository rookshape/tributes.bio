import { ArrowLeft, Check, LoaderCircle, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EditableSpinWheel } from "../components/EditableSpinWheel";
import {
  Badge,
  Button,
  IconButton,
  Input,
  Select,
  StatusMessage,
  Toggle,
  Tooltip,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../lib/money";
import {
  MAX_MAX_CHARGE_CENTS,
  MAX_SPINS_PER_PURCHASE,
  MIN_SPINS_PER_PURCHASE,
  maxChargeFloorCents,
  spinSessionIsLive,
  subscribeSpinSession,
} from "../lib/spin";
import {
  activateWheel,
  getActiveWheelId,
  getWheel,
  listWheels,
  saveWheel,
  subscribeActiveWheelId,
} from "../lib/wheels";
import {
  WHEEL_HUE_MAX,
  WHEEL_HUE_STEP,
  WHEEL_TONE_STEP,
  sliceColor,
  wheelHueTrack,
  wheelToneTrack,
} from "../lib/wheelPalette";
import type { SpinConfig, SpinSession, SpinSlice, SpinSliceType } from "../lib/types";

function valueLabel(type: SpinSliceType) {
  if (type === "amount") return "Amount";
  if (type === "multiplier") return "Multiplier";
  if (type === "bonus") return "Spins";
  return "Action";
}

function sliceInputValue(slice: SpinSlice) {
  return slice.type === "amount" ? slice.value / 100 : slice.value;
}

export function WheelEditorPage() {
  const { appUser, user } = useAuth();
  const { wheelId = "" } = useParams();
  const creatorId = appUser?.creatorId ?? user?.uid;

  const [wheel, setWheel] = useState<SpinConfig | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<SpinSession | null>(null);
  const [selectedSliceId, setSelectedSliceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!creatorId || !wheelId) return;

    let active = true;
    getWheel(creatorId, wheelId)
      .then((loaded) => {
        if (!active) return;
        setWheel(loaded);
        setSelectedSliceId(loaded?.slices[0]?.id ?? "");
      })
      .catch(() => active && setError("Could not load that wheel."))
      .finally(() => active && setLoading(false));

    const unsubscribers = [
      subscribeActiveWheelId(creatorId, setActiveId),
      subscribeSpinSession(creatorId, setSession),
    ];

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [creatorId, wheelId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  if (!wheel || !creatorId) {
    return (
      <section className="page-shell max-w-xl">
        <h1 className="page-title">Wheel not found</h1>
        <Link className="mt-4 inline-block text-body font-medium text-accent hover:underline" to="/dashboard/spin">
          Back to your wheels
        </Link>
      </section>
    );
  }

  const isActive = wheel.id === activeId;
  const isLive = spinSessionIsLive(session, now);
  // Editing the active wheel while live would change what viewers are paying
  // into mid-session, so the live copy is only refreshed when not live.
  const lockedByLiveSession = isActive && isLive;
  // A cap that cannot cover entry plus one cash result would be hit instantly.
  const maxChargeFloor = maxChargeFloorCents(wheel);

  const change = (changes: Partial<SpinConfig>) => {
    setWheel((current) => (current ? { ...current, ...changes } : current));
    setSaved(false);
  };

  const recolor = (slices: SpinSlice[], hue: number, tone: number) =>
    slices.map((slice, index) => ({
      ...slice,
      color: sliceColor({ hue, tone }, index, slices.length),
    }));

  const changeAppearance = (changes: { wheelHue?: number; wheelTone?: number }) => {
    const wheelHue = changes.wheelHue ?? wheel.wheelHue;
    const wheelTone = changes.wheelTone ?? wheel.wheelTone;
    change({ wheelHue, wheelTone, slices: recolor(wheel.slices, wheelHue, wheelTone) });
  };

  const changeSlice = (id: string, changes: Partial<SpinSlice>) =>
    change({
      slices: wheel.slices.map((slice) =>
        slice.id === id ? { ...slice, ...changes } : slice,
      ),
    });

  const newSlice = (): SpinSlice => ({
    id: crypto.randomUUID(),
    label: "New",
    type: "action",
    value: 0,
    action: "",
    color: "",
  });

  const addSlices = () => {
    if (wheel.slices.length + 2 > 12) {
      setError("A wheel can hold at most 12 slices.");
      return;
    }

    const added = [newSlice(), newSlice()];
    change({
      slices: recolor([...wheel.slices, ...added], wheel.wheelHue, wheel.wheelTone),
    });
    setSelectedSliceId(added[0].id);
  };

  const removeSlice = (id: string) => {
    if (wheel.slices.length <= 4) {
      setError("A wheel needs at least four slices.");
      return;
    }

    const index = wheel.slices.findIndex((slice) => slice.id === id);
    const partner = index === wheel.slices.length - 1 ? index - 1 : index + 1;
    const removing = new Set([id, wheel.slices[partner].id]);
    const slices = wheel.slices.filter((slice) => !removing.has(slice.id));

    change({ slices: recolor(slices, wheel.wheelHue, wheel.wheelTone) });
    if (removing.has(selectedSliceId)) setSelectedSliceId(slices[0]?.id ?? "");
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    try {
      const normalized = await saveWheel({ ...wheel, title: wheel.name });

      if (normalized.isDefault) {
        const others = await listWheels(creatorId);
        await Promise.all(
          others
            .filter((other) => other.id !== normalized.id && other.isDefault)
            .map((other) => saveWheel({ ...other, isDefault: false })),
        );
      }
      setWheel(normalized);

      // Push straight to the live copy so the active wheel stays in step. The
      // active id is read fresh rather than taken from subscription state: if
      // that snapshot has not landed yet, the edit would save to the library
      // and quietly never reach the stream.
      const currentActiveId = await getActiveWheelId(creatorId);
      if (currentActiveId === normalized.id && !isLive) {
        await activateWheel(normalized);
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the wheel.");
    } finally {
      setSaving(false);
    }
  };

  const selected =
    wheel.slices.find((slice) => slice.id === selectedSliceId) ?? wheel.slices[0];

  return (
    <section className="page-shell">
      <header className="page-header border-b border-line">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
          <Tooltip content="Back to your wheels">
            <Link
              aria-label="Back to your wheels"
              className="icon-button mb-0.5"
              to="/dashboard/spin"
            >
              <ArrowLeft size={17} />
            </Link>
          </Tooltip>
          <div className="min-w-0 flex-1 basis-48">
          <Input
            className="text-title font-semibold"
            label="Wheel name"
            maxLength={60}
            onChange={(event) => change({ name: event.target.value })}
            value={wheel.name}
          />
          </div>
          <div className="w-32 shrink-0">
          <Input
            label="Price to spin"
            min="1"
            onChange={(event) =>
              change({ spinPriceCents: Math.round(Number(event.target.value) * 100) })
            }
            prefix="$"
            step="1"
            type="number"
            value={wheel.spinPriceCents / 100}
          />
          </div>
          {/* Streamers usually sell a handful of spins per payment, not one. */}
          <div className="w-24 shrink-0">
          <Input
            label="Spins"
            max={MAX_SPINS_PER_PURCHASE}
            min={MIN_SPINS_PER_PURCHASE}
            onChange={(event) =>
              change({ spinsPerPurchase: Math.round(Number(event.target.value)) })
            }
            step="1"
            type="number"
            value={wheel.spinsPerPurchase}
          />
          </div>
          {/* The cap is the draw — "the $1k wheel" — so it sits next to the
              price rather than buried in settings. */}
          <div className="w-36 shrink-0">
          <Input
            label="Max charge"
            max={MAX_MAX_CHARGE_CENTS / 100}
            min={maxChargeFloor / 100}
            onChange={(event) =>
              change({ maxChargeCents: Math.round(Number(event.target.value) * 100) })
            }
            prefix="$"
            step="1"
            type="number"
            value={wheel.maxChargeCents / 100}
          />
          </div>
          {isActive ? (
            <Badge className="mb-2.5" dot tone="positive">
              Active
            </Badge>
          ) : null}
        </div>
        <Button
          iconLeft={
            saving ? <LoaderCircle className="animate-spin" size={17} /> : saved ? <Check size={17} /> : <Save size={17} />
          }
          loading={saving}
          onClick={() => void save()}
          variant="accent"
        >
          {saved ? "Saved" : "Save wheel"}
        </Button>
      </header>

      <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>

      {lockedByLiveSession ? (
        <p className="status-success mt-5">
          You are live. Edits are saved to your library but will not reach the stream
          until the session ends.
        </p>
      ) : null}

      <p className="mt-5 text-detail text-content-muted">
        A viewer pays{" "}
        <span className="font-semibold text-content">
          {formatMoney(wheel.spinPriceCents)}
        </span>{" "}
        for{" "}
        <span className="font-semibold text-content">
          {wheel.spinsPerPurchase} {wheel.spinsPerPurchase === 1 ? "spin" : "spins"}
        </span>
. What the wheel hands them is added on top, and a multiplier boosts
        whatever cash they land next — up to{" "}
        <span className="font-semibold text-content">
          {formatMoney(wheel.maxChargeCents)}
        </span>{" "}
        all in. That ceiling is what they agree to before paying, and their run
        stops there.
      </p>

      <div className="panel mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <Toggle
          checked={wheel.availableToViewers}
          description="Viewers can choose this wheel and pay to spin it."
          label="Offer to viewers"
          onChange={(availableToViewers) => change({ availableToViewers })}
        />
        <Toggle
          checked={wheel.isDefault}
          description="Shown on the overlay when nobody is queued yet."
          label="Default wheel"
          onChange={(isDefault) => change({ isDefault })}
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div className="min-w-0">
          <EditableSpinWheel
            onAdd={addSlices}
            onSelect={setSelectedSliceId}
            selectedSliceId={selected?.id ?? ""}
            slices={wheel.slices}
          />

          <div className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
            <label className="block" htmlFor="wheel-hue">
              <span className="mb-2 block text-detail font-medium text-content-muted">
                Wheel color
              </span>
              <input
                className="theme-slider"
                id="wheel-hue"
                max={WHEEL_HUE_MAX}
                min={0}
                onChange={(event) => changeAppearance({ wheelHue: Number(event.target.value) })}
                step={WHEEL_HUE_STEP}
                style={{ background: wheelHueTrack(wheel.wheelTone) }}
                type="range"
                value={wheel.wheelHue}
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
                onChange={(event) => changeAppearance({ wheelTone: Number(event.target.value) })}
                step={WHEEL_TONE_STEP}
                style={{ background: wheelToneTrack(wheel.wheelHue) }}
                type="range"
                value={wheel.wheelTone}
              />
            </label>
          </div>

        </div>

        {selected ? (
          <aside className="panel-flat h-fit p-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-body font-semibold text-content">
                <SlidersHorizontal size={16} /> Slice
              </div>
              <IconButton
                icon={<Trash2 size={15} />}
                label={`Delete ${selected.label}`}
                onClick={() => removeSlice(selected.id)}
                size="sm"
              />
            </div>

            <div className="mt-4 grid gap-4">
              <Input
                label="Label"
                maxLength={18}
                onChange={(event) => changeSlice(selected.id, { label: event.target.value })}
                value={selected.label}
              />
              <Select
                label="Result"
                onChange={(event) =>
                  changeSlice(selected.id, { type: event.target.value as SpinSliceType })
                }
                value={selected.type}
              >
                <option value="amount">Amount</option>
                <option value="multiplier">Multiplier</option>
                <option value="bonus">Bonus spin</option>
                <option value="action">Action</option>
              </Select>

              {selected.type === "action" ? (
                <Input
                  label={valueLabel(selected.type)}
                  maxLength={80}
                  onChange={(event) => changeSlice(selected.id, { action: event.target.value })}
                  value={selected.action}
                />
              ) : (
                <Input
                  label={valueLabel(selected.type)}
                  min="0"
                  onChange={(event) =>
                    changeSlice(selected.id, {
                      value:
                        selected.type === "amount"
                          ? Math.round(Number(event.target.value) * 100)
                          : Math.round(Number(event.target.value)),
                    })
                  }
                  step="1"
                  type="number"
                  value={sliceInputValue(selected)}
                />
              )}
            </div>

            <p className="mt-4 text-caption text-content-subtle">
              Slices are added and removed in pairs, so the two colours keep alternating.
            </p>
          </aside>
        ) : null}
      </div>

    </section>
  );
}
