import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import {
  DEFAULT_WHEEL_APPEARANCE,
  normalizeWheelHue,
  normalizeWheelTone,
  sliceColor,
  type WheelAppearance,
} from "./wheelPalette";
import type {
  SpinConfig,
  SpinQueueEntry,
  SpinReceipt,
  SpinReceiptStatus,
  SpinSession,
  SpinSlice,
  SpinSliceType,
  SpinState,
} from "./types";

const defaultSlicesWithoutColor: Omit<SpinSlice, "color">[] = [
  { id: "five", label: "$5", type: "amount", value: 500, action: "" },
  { id: "double", label: "2x", type: "multiplier", value: 2, action: "" },
  { id: "bonus", label: "+1", type: "bonus", value: 1, action: "" },
  { id: "twenty", label: "$20", type: "amount", value: 2000, action: "" },
  { id: "prompt", label: "Chat", type: "action", value: 0, action: "Chat chooses" },
  { id: "ten", label: "$10", type: "amount", value: 1000, action: "" },
];

export const defaultSpinSlices: SpinSlice[] = defaultSlicesWithoutColor.map(
  (slice, index) => ({
    ...slice,
    color: sliceColor(
      DEFAULT_WHEEL_APPEARANCE,
      index,
      defaultSlicesWithoutColor.length,
    ),
  }),
);

export function createDefaultSpinConfig(creatorId: string): SpinConfig {
  return {
    id: "current",
    name: "Default wheel",
    archived: false,
    availableToViewers: true,
    isDefault: true,
    creatorId,
    title: "Spin the wheel",
    counterLabel: "Tribute goal",
    spinPriceCents: 1000,
    isEnabled: false,
    showOnProfile: true,
    mockModeEnabled: true,
    wheelHue: DEFAULT_WHEEL_APPEARANCE.hue,
    wheelTone: DEFAULT_WHEEL_APPEARANCE.tone,
    slices: defaultSpinSlices.map((slice) => ({ ...slice })),
  };
}

/**
 * Slice colors are always recomputed from the wheel's hue and tone, never read
 * back from storage, so a wheel can only ever use the two alternating shades.
 */
function normalizeSlice(
  slice: Omit<SpinSlice, "color"> & { color?: string },
  index: number,
  appearance: WheelAppearance,
  total: number,
): SpinSlice {
  const type: SpinSliceType = ["amount", "multiplier", "bonus", "action"].includes(slice.type)
    ? slice.type
    : "action";

  return {
    id: slice.id || `slice-${index}`,
    label: slice.label.trim().slice(0, 18),
    type,
    value: Number.isFinite(slice.value) ? Math.max(0, Math.round(slice.value)) : 0,
    action: slice.action.trim().slice(0, 80),
    color: sliceColor(appearance, index, total),
  };
}

export function validateSpinConfig(config: SpinConfig) {
  const name = config.name.trim();

  if (!name || name.length > 60) {
    throw new Error("Wheel name must be between 1 and 60 characters.");
  }

  const title = config.title.trim();
  const counterLabel = config.counterLabel.trim();

  if (!title || title.length > 60) {
    throw new Error("Wheel title must be between 1 and 60 characters.");
  }

  if (!counterLabel || counterLabel.length > 40) {
    throw new Error("Counter label must be between 1 and 40 characters.");
  }

  if (config.spinPriceCents < 100 || config.spinPriceCents > 100000) {
    throw new Error("Spin price must be between $1 and $1,000.");
  }

  if (config.slices.length < 4 || config.slices.length > 12) {
    throw new Error("Use between 4 and 12 wheel slices.");
  }

  // Only two shades alternate, so an odd count would put two identical slices
  // next to each other where the wheel closes.
  if (config.slices.length % 2 !== 0) {
    throw new Error("Use an even number of wheel slices.");
  }

  const wheelHue = normalizeWheelHue(config.wheelHue);
  const wheelTone = normalizeWheelTone(config.wheelTone);
  const slices = config.slices.map((slice, index) =>
    normalizeSlice(slice, index, { hue: wheelHue, tone: wheelTone }, config.slices.length),
  );

  if (slices.some((slice) => !slice.label)) {
    throw new Error("Every slice needs a label.");
  }

  if (
    slices.some(
      (slice) =>
        (slice.type === "amount" && (slice.value < 100 || slice.value > 100000)) ||
        (slice.type === "multiplier" &&
          (slice.value < 1 || config.spinPriceCents * slice.value > 100000)),
    )
  ) {
    throw new Error("Every paid result must be between $1 and $1,000.");
  }

  return { ...config, name, title, counterLabel, wheelHue, wheelTone, slices };
}

function configRef(creatorId: string) {
  return doc(db, "creators", creatorId, "spinConfigs", "current");
}

function stateRef(creatorId: string) {
  return doc(db, "creators", creatorId, "spinStates", "current");
}

function sessionRef(creatorId: string) {
  return doc(db, "creators", creatorId, "spinSessions", "current");
}

function receiptRef(receiptId: string) {
  return doc(db, "spinReceipts", receiptId);
}

export function spinResultAmountCents(slice: SpinSlice, baseAmountCents: number) {
  if (slice.type === "amount") {
    return slice.value;
  }

  if (slice.type === "multiplier") {
    return baseAmountCents * Math.max(1, slice.value);
  }

  if (slice.type === "action") {
    return baseAmountCents;
  }

  return 0;
}

export function maxSpinAmountCents(config: SpinConfig) {
  return Math.max(
    config.spinPriceCents,
    ...config.slices.map((slice) =>
      spinResultAmountCents(slice, config.spinPriceCents),
    ),
  );
}

export function totalWithServiceFee(amountCents: number) {
  return amountCents + Math.round(amountCents * 0.25);
}

function mapSpinConfig(
  creatorId: string,
  data: DocumentData,
  id = "current",
): SpinConfig {
  const defaults = createDefaultSpinConfig(creatorId);
  const wheelHue = normalizeWheelHue(data.wheelHue);
  const wheelTone = normalizeWheelTone(data.wheelTone);
  const storedSlices = Array.isArray(data.slices) ? data.slices : null;
  const slices = storedSlices
    ? storedSlices.map((slice, index) =>
        normalizeSlice(
          slice as SpinSlice,
          index,
          { hue: wheelHue, tone: wheelTone },
          storedSlices.length,
        ),
      )
    : defaults.slices;

  return {
    id,
    name: typeof data.name === "string" && data.name.trim() ? data.name : defaults.name,
    archived: data.archived === true,
    // Existing wheels predate these flags; offering them keeps the viewer page
    // from going empty on upgrade.
    availableToViewers: data.availableToViewers !== false,
    isDefault: data.isDefault === true,
    creatorId,
    title: typeof data.title === "string" ? data.title : defaults.title,
    // "Tribute total" was the previous default; move those wheels onto the new
    // wording while leaving any label a creator actually chose alone.
    counterLabel:
      typeof data.counterLabel === "string" && data.counterLabel !== "Tribute total"
        ? data.counterLabel
        : defaults.counterLabel,
    spinPriceCents: Number(data.spinPriceCents ?? defaults.spinPriceCents),
    isEnabled: Boolean(data.isEnabled),
    showOnProfile: data.showOnProfile !== false,
    mockModeEnabled: data.mockModeEnabled !== false,
    wheelHue,
    wheelTone,
    slices,
  };
}

function mapSpinState(creatorId: string, data: DocumentData | undefined): SpinState {
  const alert = data?.twitchBitsAlert;

  return {
    creatorId,
    counterCents: Number(data?.counterCents ?? 0),
    spinId: typeof data?.spinId === "string" ? data.spinId : null,
    queueEntryId: typeof data?.queueEntryId === "string" ? data.queueEntryId : null,
    viewerName: typeof data?.viewerName === "string" ? data.viewerName : null,
    selectedIndex: typeof data?.selectedIndex === "number" ? data.selectedIndex : null,
    wheelId: typeof data?.wheelId === "string" ? data.wheelId : null,
    nextWheelId: typeof data?.nextWheelId === "string" ? data.nextWheelId : null,
    resultLabel: typeof data?.resultLabel === "string" ? data.resultLabel : null,
    resultType:
      data?.resultType === "amount" ||
      data?.resultType === "multiplier" ||
      data?.resultType === "bonus" ||
      data?.resultType === "action"
        ? data.resultType
        : null,
    counterDeltaCents: Number(data?.counterDeltaCents ?? 0),
    startedAtMs: Number(data?.startedAtMs ?? 0),
    durationMs: Number(data?.durationMs ?? 0),
    lockedUntilMs: Number(data?.lockedUntilMs ?? 0),
    twitchBitsAlert:
      alert &&
      typeof alert.id === "string" &&
      typeof alert.viewerName === "string" &&
      Number.isInteger(alert.bits) &&
      Number.isInteger(alert.amountCents) &&
      Number.isFinite(alert.createdAtMs)
        ? {
            id: alert.id,
            viewerName: alert.viewerName,
            bits: alert.bits,
            amountCents: alert.amountCents,
            createdAtMs: alert.createdAtMs,
          }
        : null,
  };
}

function mapQueueEntry(snapshot: QueryDocumentSnapshot<DocumentData>): SpinQueueEntry {
  const data = snapshot.data();
  const timestamp = data.createdAt;

  return {
    id: snapshot.id,
    viewerName: String(data.viewerName ?? "Viewer"),
    amountCents: Number(data.amountCents ?? 0),
    authorizedTotalCents: Number(data.authorizedTotalCents ?? 0),
    source:
      data.source === "bonus"
        ? "bonus"
        : data.source === "payment"
          ? "payment"
          : "mock",
    wheelName: typeof data.wheelName === "string" ? data.wheelName : null,
    status: ["queued", "capturing", "completed", "payment_failed", "canceled"].includes(
      data.status,
    )
      ? data.status
      : "queued",
    resultLabel: typeof data.resultLabel === "string" ? data.resultLabel : null,
    createdAtMs:
      typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : Number(data.createdAtMs ?? 0),
  };
}

function mapSpinSession(creatorId: string, data: DocumentData | undefined): SpinSession {
  const hasManualState = typeof data?.manualLive === "boolean";

  return {
    creatorId,
    status: data?.status === "live" ? "live" : "offline",
    startedAtMs: Number(data?.startedAtMs ?? 0),
    heartbeatAtMs: Number(data?.heartbeatAtMs ?? 0),
    manualHeartbeatAtMs: Number(
      data?.manualHeartbeatAtMs ?? data?.heartbeatAtMs ?? 0,
    ),
    manualLive: hasManualState
      ? data?.manualLive === true
      : data?.status === "live" && data?.twitchLive !== true,
    twitchLive: data?.twitchLive === true,
  };
}

function mapSpinReceipt(receiptId: string, data: DocumentData): SpinReceipt {
  const allowedStatuses: SpinReceiptStatus[] = [
    "checkout",
    "authorized",
    "queued",
    "capturing",
    "bonus",
    "completed",
    "payment_failed",
    "canceled",
  ];

  return {
    id: receiptId,
    creatorId: String(data.creatorId ?? ""),
    creatorUsername: String(data.creatorUsername ?? ""),
    viewerName: String(data.viewerName ?? "Viewer"),
    status: allowedStatuses.includes(data.status) ? data.status : "checkout",
    resultLabel: typeof data.resultLabel === "string" ? data.resultLabel : null,
    creatorAmountCents:
      typeof data.creatorAmountCents === "number" ? data.creatorAmountCents : null,
    totalCents: typeof data.totalCents === "number" ? data.totalCents : null,
    updatedAtMs: Number(data.updatedAtMs ?? 0),
  };
}

export async function getSpinConfig(creatorId: string) {
  const snapshot = await getDoc(configRef(creatorId));
  return snapshot.exists() ? mapSpinConfig(creatorId, snapshot.data()) : null;
}

export async function getOrCreateSpinConfig(creatorId: string) {
  const existing = await getSpinConfig(creatorId);

  if (existing) {
    return existing;
  }

  const config = createDefaultSpinConfig(creatorId);
  await saveSpinConfig(config);
  return config;
}

export async function saveSpinConfig(config: SpinConfig) {
  const normalized = validateSpinConfig(config);
  const { id: _id, ...stored } = normalized;
  await setDoc(
    configRef(config.creatorId),
    { ...stored, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return normalized;
}

export function subscribeSpinConfig(
  creatorId: string,
  onChange: (config: SpinConfig | null) => void,
): Unsubscribe {
  return onSnapshot(configRef(creatorId), (snapshot) => {
    onChange(snapshot.exists() ? mapSpinConfig(creatorId, snapshot.data()) : null);
  });
}

/** Shared with the wheel library, which stores the same shape under its own id. */
export { mapSpinConfig };

export function subscribeSpinState(
  creatorId: string,
  onChange: (state: SpinState) => void,
): Unsubscribe {
  return onSnapshot(stateRef(creatorId), (snapshot) => {
    onChange(mapSpinState(creatorId, snapshot.data()));
  });
}

export function subscribeSpinSession(
  creatorId: string,
  onChange: (session: SpinSession) => void,
): Unsubscribe {
  return onSnapshot(sessionRef(creatorId), (snapshot) => {
    onChange(mapSpinSession(creatorId, snapshot.data()));
  });
}

export function subscribeSpinReceipt(
  receiptId: string,
  onChange: (receipt: SpinReceipt | null) => void,
): Unsubscribe {
  return onSnapshot(receiptRef(receiptId), (snapshot) => {
    onChange(snapshot.exists() ? mapSpinReceipt(receiptId, snapshot.data()) : null);
  });
}

export function spinSessionIsLive(session: SpinSession | null, now = Date.now()) {
  if (!session) return false;
  return (
    session.twitchLive ||
    (session.manualLive &&
      session.manualHeartbeatAtMs > 0 &&
      now - session.manualHeartbeatAtMs < 120000)
  );
}

export function subscribeSpinQueue(
  creatorId: string,
  onChange: (entries: SpinQueueEntry[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "creators", creatorId, "spinQueue"), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map(mapQueueEntry)),
  );
}

const createMockEntryCall = httpsCallable<
  { creatorId: string; viewerName: string },
  { entryId: string }
>(functions, "createMockSpinEntry");

const triggerSpinCall = httpsCallable<
  { creatorId: string },
  { spinId: string; selectedIndex: number }
>(functions, "triggerSpin");

const adjustCounterCall = httpsCallable<
  { creatorId: string; deltaCents: number },
  { counterCents: number }
>(functions, "adjustSpinCounter");

const setLiveStatusCall = httpsCallable<
  { creatorId: string; isLive: boolean },
  { status: "offline" | "live"; manualLive: boolean; heartbeatAtMs: number }
>(functions, "setSpinLiveStatus");

const heartbeatCall = httpsCallable<
  { creatorId: string },
  { heartbeatAtMs: number }
>(functions, "heartbeatSpinSession");

export async function createMockSpinEntry(creatorId: string, viewerName: string) {
  const result = await createMockEntryCall({ creatorId, viewerName: viewerName.trim() });
  return result.data;
}

export async function triggerNextSpin(creatorId: string) {
  const result = await triggerSpinCall({ creatorId });
  return result.data;
}

export async function adjustSpinCounter(creatorId: string, deltaCents: number) {
  const result = await adjustCounterCall({ creatorId, deltaCents: Math.round(deltaCents) });
  return result.data.counterCents;
}

export async function setSpinLiveStatus(creatorId: string, isLive: boolean) {
  const result = await setLiveStatusCall({ creatorId, isLive });
  return result.data;
}

export async function heartbeatSpinSession(creatorId: string) {
  const result = await heartbeatCall({ creatorId });
  return result.data;
}
