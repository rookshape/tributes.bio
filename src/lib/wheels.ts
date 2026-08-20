import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  MAX_WHEEL_SLICES,
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

/**
 * Exactly one wheel is the default, so promoting one demotes the rest.
 *
 * This writes the single field rather than saving each other wheel whole. Going
 * through saveWheel re-validated wheels the streamer was not editing and
 * rewrote every one of their fields as a side effect, so one unrelated wheel
 * that no longer passed validation was enough to abandon the demotion halfway
 * and leave two wheels claiming to be the default.
 */
export async function clearOtherDefaultWheels(creatorId: string, keepId: string) {
  const others = await listWheels(creatorId);

  await Promise.all(
    others
      .filter((other) => other.id !== keepId && other.isDefault)
      .map((other) =>
        updateDoc(wheelRef(creatorId, other.id), {
          isDefault: false,
          updatedAt: serverTimestamp(),
        }),
      ),
  );
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
/**
 * Concurrent callers share one migration. Without this, React's development
 * double-invoke fires two calls that both observe an empty library and both
 * create a wheel.
 */
const migrations = new Map<string, Promise<SpinConfig[]>>();

export function ensureWheelLibrary(creatorId: string) {
  const existing = migrations.get(creatorId);
  if (existing) return existing;

  const run = migrateWheelLibrary(creatorId).finally(() => {
    migrations.delete(creatorId);
  });

  migrations.set(creatorId, run);
  return run;
}

async function migrateWheelLibrary(creatorId: string) {
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

  for (
    let value = startCents;
    value <= endCents && slices.length < MAX_WHEEL_SLICES;
    value += stepCents
  ) {
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

/** Cash and a free spin off one slice — the "$5 + spin" wedge. */
const amountPlusSpin = (label: string, value: number, bonusSpins = 1) => ({
  ...amount(label, value),
  bonusSpins,
});

const multiplier = (label: string, value: number) => ({
  id: crypto.randomUUID(),
  label,
  type: "multiplier" as const,
  value,
  action: "",
});

const bonus = (label: string, value: number) => ({
  id: crypto.randomUUID(),
  label,
  type: "bonus" as const,
  value,
  action: "",
});

const act = (label: string, action: string) => ({
  id: crypto.randomUUID(),
  label,
  type: "action" as const,
  value: 0,
  action,
});

export const WHEEL_TEMPLATES: WheelTemplate[] = [
  template("amounts", "Simple amounts", "Twelve fixed tips, low to high.", [
    amount("$5", 500),
    amount("$8", 800),
    amount("$10", 1000),
    amount("$12", 1200),
    amount("$15", 1500),
    amount("$18", 1800),
    amount("$20", 2000),
    amount("$25", 2500),
    amount("$30", 3000),
    amount("$35", 3500),
    amount("$40", 4000),
    amount("$50", 5000),
  ]),
  template(
    "multipliers",
    "Amounts and multipliers",
    "Fixed tips with multipliers that arm the next cash result.",
    [
      amount("$5", 500),
      multiplier("2x next", 2),
      amount("$10", 1000),
      amount("$15", 1500),
      multiplier("3x next", 3),
      amount("$20", 2000),
      amount("$8", 800),
      multiplier("2x next", 2),
      amount("$25", 2500),
      amount("$12", 1200),
      multiplier("5x next", 5),
      amount("$30", 3000),
    ],
  ),
  template("bonus", "Bonus spins", "Amounts with free extra spins mixed in.", [
    amount("$5", 500),
    bonus("+1 spin", 1),
    amount("$10", 1000),
    amountPlusSpin("$5 + spin", 500),
    amount("$15", 1500),
    bonus("+2 spins", 2),
    amount("$8", 800),
    amountPlusSpin("$10 + spin", 1000),
    amount("$20", 2000),
    bonus("+1 spin", 1),
    amount("$25", 2500),
    amount("$30", 3000),
  ]),
  template("choice", "Viewer choice", "Actions your chat picks, priced the same.", [
    act("Chat picks", "Chat chooses"),
    amount("$10", 1000),
    act("Next game", "Viewer picks the next game"),
    amount("$20", 2000),
    act("Shoutout", "Shoutout on stream"),
    amount("$15", 1500),
    act("Dealer's choice", "Streamer picks the forfeit"),
    amount("$5", 500),
    act("Rename me", "Viewer picks a nickname for the stream"),
    amount("$25", 2500),
    amountPlusSpin("$5 + spin", 500),
    amount("$30", 3000),
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
