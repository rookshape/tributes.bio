import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  createDefaultSpinConfig,
  defaultSpinSlices,
  mapSpinConfig,
  validateSpinConfig,
} from "./spin";
import { DEFAULT_WHEEL_APPEARANCE, sliceColor } from "./wheelPalette";
import type { SpinConfig, SpinSlice } from "./types";

/**
 * Wheel library.
 *
 * Creators keep several named wheels. `spinConfigs/{wheelId}` holds the library;
 * `spinConfigs/current` holds a copy of whichever wheel is active, because the
 * Cloud Functions — including the Stripe checkout path — read that fixed
 * document. Keeping it means the server is untouched by this feature.
 *
 * It also gives the isolation the product needs: editing a stored wheel cannot
 * alter a session already running. Changes reach the stream only on activation.
 */

const ACTIVE_ID = "current";

function libraryRef(creatorId: string) {
  return collection(db, "creators", creatorId, "spinConfigs");
}

function wheelRef(creatorId: string, wheelId: string) {
  return doc(db, "creators", creatorId, "spinConfigs", wheelId);
}

/** Fields the stored document carries; `id` is the document key, not a field. */
function toStored(config: SpinConfig) {
  const { id: _id, ...stored } = validateSpinConfig(config);
  return stored;
}

export async function listWheels(creatorId: string): Promise<SpinConfig[]> {
  const snapshot = await getDocs(libraryRef(creatorId));

  return snapshot.docs
    .filter((entry) => entry.id !== ACTIVE_ID)
    .map((entry) => mapSpinConfig(creatorId, entry.data(), entry.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeWheels(
  creatorId: string,
  onChange: (wheels: SpinConfig[]) => void,
): Unsubscribe {
  return onSnapshot(libraryRef(creatorId), (snapshot) => {
    onChange(
      snapshot.docs
        .filter((entry) => entry.id !== ACTIVE_ID)
        .map((entry) => mapSpinConfig(creatorId, entry.data(), entry.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  });
}

export async function getWheel(creatorId: string, wheelId: string) {
  const snapshot = await getDoc(wheelRef(creatorId, wheelId));
  return snapshot.exists()
    ? mapSpinConfig(creatorId, snapshot.data(), snapshot.id)
    : null;
}

/** The library id currently copied into the active document. */
export async function getActiveWheelId(creatorId: string) {
  const snapshot = await getDoc(wheelRef(creatorId, ACTIVE_ID));
  const value = snapshot.data()?.activeWheelId;
  return typeof value === "string" ? value : null;
}

export function subscribeActiveWheelId(
  creatorId: string,
  onChange: (wheelId: string | null) => void,
): Unsubscribe {
  return onSnapshot(wheelRef(creatorId, ACTIVE_ID), (snapshot) => {
    const value = snapshot.data()?.activeWheelId;
    onChange(typeof value === "string" ? value : null);
  });
}

export async function saveWheel(wheel: SpinConfig) {
  const normalized = validateSpinConfig(wheel);
  await setDoc(
    wheelRef(wheel.creatorId, wheel.id),
    { ...toStored(wheel), updatedAt: serverTimestamp() },
    { merge: true },
  );
  return normalized;
}

export async function createWheel(creatorId: string, wheel: Omit<SpinConfig, "id">) {
  const ref = doc(libraryRef(creatorId));
  const created = { ...wheel, id: ref.id, creatorId } as SpinConfig;
  await setDoc(ref, { ...toStored(created), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return created;
}

export async function duplicateWheel(wheel: SpinConfig) {
  return createWheel(wheel.creatorId, {
    ...wheel,
    name: `${wheel.name} copy`.slice(0, 60),
    archived: false,
  });
}

export async function renameWheel(wheel: SpinConfig, name: string) {
  return saveWheel({ ...wheel, name });
}

export async function setWheelArchived(wheel: SpinConfig, archived: boolean) {
  return saveWheel({ ...wheel, archived });
}

export async function deleteWheel(creatorId: string, wheelId: string) {
  await deleteDoc(wheelRef(creatorId, wheelId));
}

/**
 * Copies a stored wheel into the active document. This is the only path by
 * which a wheel reaches the overlay, the viewer page, and checkout.
 */
export async function activateWheel(wheel: SpinConfig) {
  await setDoc(
    wheelRef(wheel.creatorId, ACTIVE_ID),
    {
      ...toStored(wheel),
      activeWheelId: wheel.id,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Moves a creator who predates the library onto it: their existing active
 * wheel becomes the first stored entry, so nothing is lost and the active
 * document keeps serving the same wheel throughout.
 */
export async function ensureWheelLibrary(creatorId: string) {
  const existing = await listWheels(creatorId);

  if (existing.length > 0) return existing;

  const activeSnapshot = await getDoc(wheelRef(creatorId, ACTIVE_ID));
  const source = activeSnapshot.exists()
    ? mapSpinConfig(creatorId, activeSnapshot.data(), ACTIVE_ID)
    : createDefaultSpinConfig(creatorId);

  const migrated = await createWheel(creatorId, {
    ...source,
    name: source.name || "Default wheel",
    archived: false,
  });

  await activateWheel(migrated);
  return [migrated];
}

/** Slice list from a start, end, and increment, labelled from the values. */
export function generateAmountSlices(
  startCents: number,
  endCents: number,
  stepCents: number,
): Omit<SpinSlice, "color">[] {
  const slices: Omit<SpinSlice, "color">[] = [];

  for (let value = startCents; value <= endCents && slices.length < 12; value += stepCents) {
    slices.push({
      id: crypto.randomUUID(),
      label: `$${Math.round(value / 100)}`,
      type: "amount",
      value,
      action: "",
    });
  }

  // The wheel alternates two shades, so the count has to stay even.
  if (slices.length % 2 === 1) slices.pop();

  return slices;
}

function withColors(slices: Omit<SpinSlice, "color">[]): SpinSlice[] {
  return slices.map((slice, index) => ({
    ...slice,
    color: sliceColor(DEFAULT_WHEEL_APPEARANCE, index, slices.length),
  }));
}

export type WheelTemplate = {
  id: string;
  name: string;
  description: string;
  slices: SpinSlice[];
};

const template = (
  id: string,
  name: string,
  description: string,
  slices: Omit<SpinSlice, "color">[],
): WheelTemplate => ({ id, name, description, slices: withColors(slices) });

const amount = (label: string, value: number) => ({
  id: crypto.randomUUID(),
  label,
  type: "amount" as const,
  value,
  action: "",
});

export const WHEEL_TEMPLATES: WheelTemplate[] = [
  template("amounts", "Simple amounts", "Six fixed tips, low to high.", [
    amount("$5", 500),
    amount("$10", 1000),
    amount("$15", 1500),
    amount("$20", 2000),
    amount("$25", 2500),
    amount("$50", 5000),
  ]),
  template(
    "multipliers",
    "Amounts and multipliers",
    "Fixed tips mixed with multipliers of the spin price.",
    [
      amount("$5", 500),
      { id: crypto.randomUUID(), label: "2x", type: "multiplier", value: 2, action: "" },
      amount("$15", 1500),
      { id: crypto.randomUUID(), label: "3x", type: "multiplier", value: 3, action: "" },
      amount("$25", 2500),
      { id: crypto.randomUUID(), label: "5x", type: "multiplier", value: 5, action: "" },
    ],
  ),
  template("bonus", "Bonus spins", "Amounts with free extra spins mixed in.", [
    amount("$5", 500),
    { id: crypto.randomUUID(), label: "+1 spin", type: "bonus", value: 1, action: "" },
    amount("$10", 1000),
    { id: crypto.randomUUID(), label: "+2 spins", type: "bonus", value: 2, action: "" },
    amount("$20", 2000),
    amount("$30", 3000),
  ]),
  template("choice", "Viewer choice", "Actions your chat picks, priced the same.", [
    { id: crypto.randomUUID(), label: "Chat picks", type: "action", value: 0, action: "Chat chooses" },
    amount("$10", 1000),
    { id: crypto.randomUUID(), label: "Next game", type: "action", value: 0, action: "Viewer picks the next game" },
    amount("$20", 2000),
    { id: crypto.randomUUID(), label: "Shoutout", type: "action", value: 0, action: "Shoutout on stream" },
    amount("$15", 1500),
  ]),
  template("blank", "Blank wheel", "Four empty slices to fill in yourself.", [
    amount("$5", 500),
    amount("$10", 1000),
    amount("$15", 1500),
    amount("$20", 2000),
  ]),
];

export function wheelFromTemplate(
  creatorId: string,
  templateId: string,
  name: string,
): Omit<SpinConfig, "id"> {
  const chosen =
    WHEEL_TEMPLATES.find((entry) => entry.id === templateId) ?? WHEEL_TEMPLATES[0];

  return {
    ...createDefaultSpinConfig(creatorId),
    name,
    slices: chosen.slices.map((slice) => ({ ...slice, id: crypto.randomUUID() })),
  };
}

export { defaultSpinSlices };
