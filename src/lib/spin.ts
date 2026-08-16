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

const sliceColors = [
  "#111827",
  "#0f8f6f",
  "#f05d4e",
  "#d99a2b",
  "#2f5f9f",
  "#7a4f9f",
];

export const defaultSpinSlices: SpinSlice[] = [
  { id: "five", label: "$5", type: "amount", value: 500, action: "", color: sliceColors[1] },
  { id: "double", label: "2x", type: "multiplier", value: 2, action: "", color: sliceColors[2] },
  { id: "bonus", label: "+1", type: "bonus", value: 1, action: "", color: sliceColors[3] },
  { id: "twenty", label: "$20", type: "amount", value: 2000, action: "", color: sliceColors[4] },
  { id: "prompt", label: "Chat", type: "action", value: 0, action: "Chat chooses", color: sliceColors[5] },
  { id: "ten", label: "$10", type: "amount", value: 1000, action: "", color: sliceColors[0] },
];

export function createDefaultSpinConfig(creatorId: string): SpinConfig {
  return {
    creatorId,
    title: "Spin the wheel",
    counterLabel: "Tribute total",
    spinPriceCents: 1000,
    isEnabled: false,
    showOnProfile: true,
    mockModeEnabled: true,
    slices: defaultSpinSlices.map((slice) => ({ ...slice })),
  };
}

function validColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeSlice(slice: SpinSlice, index: number): SpinSlice {
  const type: SpinSliceType = ["amount", "multiplier", "bonus", "action"].includes(slice.type)
    ? slice.type
    : "action";

  return {
    id: slice.id || `slice-${index}`,
    label: slice.label.trim().slice(0, 18),
    type,
    value: Number.isFinite(slice.value) ? Math.max(0, Math.round(slice.value)) : 0,
    action: slice.action.trim().slice(0, 80),
    color: validColor(slice.color) ? slice.color : sliceColors[index % sliceColors.length],
  };
}

export function validateSpinConfig(config: SpinConfig) {
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

  if (config.slices.length < 2 || config.slices.length > 12) {
    throw new Error("Use between 2 and 12 wheel slices.");
  }

  const slices = config.slices.map(normalizeSlice);

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

  return { ...config, title, counterLabel, slices };
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

function mapSpinConfig(creatorId: string, data: DocumentData): SpinConfig {
  const defaults = createDefaultSpinConfig(creatorId);
  const slices = Array.isArray(data.slices)
    ? data.slices.map((slice, index) => normalizeSlice(slice as SpinSlice, index))
    : defaults.slices;

  return {
    creatorId,
    title: typeof data.title === "string" ? data.title : defaults.title,
    counterLabel:
      typeof data.counterLabel === "string" ? data.counterLabel : defaults.counterLabel,
    spinPriceCents: Number(data.spinPriceCents ?? defaults.spinPriceCents),
    isEnabled: Boolean(data.isEnabled),
    showOnProfile: data.showOnProfile !== false,
    mockModeEnabled: data.mockModeEnabled !== false,
    slices,
  };
}

function mapSpinState(creatorId: string, data: DocumentData | undefined): SpinState {
  return {
    creatorId,
    counterCents: Number(data?.counterCents ?? 0),
    spinId: typeof data?.spinId === "string" ? data.spinId : null,
    queueEntryId: typeof data?.queueEntryId === "string" ? data.queueEntryId : null,
    viewerName: typeof data?.viewerName === "string" ? data.viewerName : null,
    selectedIndex: typeof data?.selectedIndex === "number" ? data.selectedIndex : null,
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
  return {
    creatorId,
    status: data?.status === "live" ? "live" : "offline",
    startedAtMs: Number(data?.startedAtMs ?? 0),
    heartbeatAtMs: Number(data?.heartbeatAtMs ?? 0),
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
  await setDoc(
    configRef(config.creatorId),
    { ...normalized, updatedAt: serverTimestamp() },
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
  return Boolean(
    session?.status === "live" &&
      session.heartbeatAtMs > 0 &&
      now - session.heartbeatAtMs < 120000,
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
  { status: "offline" | "live"; heartbeatAtMs: number }
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
