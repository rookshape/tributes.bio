import { randomInt, randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

type SpinSliceType = "amount" | "multiplier" | "bonus" | "action";

type SpinSlice = {
  id: string;
  label: string;
  type: SpinSliceType;
  value: number;
  action: string;
  color: string;
};

type SpinConfig = {
  title: string;
  counterLabel: string;
  spinPriceCents: number;
  isEnabled: boolean;
  mockModeEnabled: boolean;
  slices: SpinSlice[];
};

function requiredId(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(value)
  ) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }

  return value;
}

function viewerName(value: unknown) {
  if (typeof value !== "string") {
    return "Viewer";
  }

  const normalized = value.trim().slice(0, 40);
  return normalized || "Viewer";
}

function parseConfig(data: FirebaseFirestore.DocumentData | undefined): SpinConfig {
  const slices = Array.isArray(data?.slices) ? (data.slices as SpinSlice[]) : [];

  if (
    !data ||
    typeof data.title !== "string" ||
    typeof data.counterLabel !== "string" ||
    !Number.isInteger(data.spinPriceCents) ||
    data.spinPriceCents < 100 ||
    data.spinPriceCents > 100000 ||
    slices.length < 2 ||
    slices.length > 12
  ) {
    throw new HttpsError("failed-precondition", "The wheel configuration is invalid.");
  }

  for (const slice of slices) {
    if (
      !slice ||
      typeof slice.id !== "string" ||
      typeof slice.label !== "string" ||
      !["amount", "multiplier", "bonus", "action"].includes(slice.type) ||
      !Number.isInteger(slice.value) ||
      typeof slice.action !== "string" ||
      typeof slice.color !== "string"
    ) {
      throw new HttpsError("failed-precondition", "The wheel configuration is invalid.");
    }
  }

  return {
    title: data.title,
    counterLabel: data.counterLabel,
    spinPriceCents: data.spinPriceCents,
    isEnabled: data.isEnabled === true,
    mockModeEnabled: data.mockModeEnabled === true,
    slices,
  };
}

function counterDelta(slice: SpinSlice, amountCents: number) {
  if (slice.type === "amount") {
    return Math.min(slice.value, 10000000);
  }

  if (slice.type === "multiplier") {
    return Math.min(amountCents * Math.max(1, slice.value), 10000000);
  }

  return amountCents;
}

export const createMockSpinEntry = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");
  const name = viewerName(request.data?.viewerName);
  const projectId = String(getApp().options.projectId ?? process.env.GCLOUD_PROJECT ?? "");

  if (!projectId.endsWith("-dev") && projectId !== "demo-tributes-bio-dev") {
    throw new HttpsError("failed-precondition", "Mock spins are only available in development.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const configRef = creatorRef.collection("spinConfigs").doc("current");
  const queueRef = creatorRef.collection("spinQueue");
  const entryRef = queueRef.doc();

  await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, configSnapshot, queuedSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      transaction.get(configRef),
      transaction.get(queueRef.orderBy("createdAt", "asc").limit(30)),
    ]);
    const creator = creatorSnapshot.data();
    const config = parseConfig(configSnapshot.data());
    const isOwner = request.auth?.uid === creator?.ownerUid;

    if (!creatorSnapshot.exists || creator?.moderationStatus !== "active") {
      throw new HttpsError("not-found", "Creator not found.");
    }

    if (!isOwner && (creator?.isPublished !== true || !config.isEnabled)) {
      throw new HttpsError("failed-precondition", "Spins are not available.");
    }

    if (!config.mockModeEnabled) {
      throw new HttpsError("failed-precondition", "Mock spins are disabled.");
    }

    const queuedCount = queuedSnapshot.docs.filter(
      (snapshot) => snapshot.data().status === "queued",
    ).length;

    if (queuedCount >= 25) {
      throw new HttpsError("resource-exhausted", "The test queue is full.");
    }

    transaction.create(entryRef, {
      viewerName: name,
      amountCents: config.spinPriceCents,
      source: "mock",
      status: "queued",
      resultLabel: null,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { entryId: entryRef.id };
});

export const triggerSpin = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");

  if (!request.auth || request.auth.uid !== creatorId) {
    throw new HttpsError("permission-denied", "Only the creator can trigger a spin.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const configRef = creatorRef.collection("spinConfigs").doc("current");
  const stateRef = creatorRef.collection("spinStates").doc("current");
  const queueRef = creatorRef.collection("spinQueue");
  const now = Date.now();
  const durationMs = 5500;
  const spinId = randomUUID();
  let selectedIndex = 0;

  await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, configSnapshot, stateSnapshot, queueSnapshot] =
      await Promise.all([
        transaction.get(creatorRef),
        transaction.get(configRef),
        transaction.get(stateRef),
        transaction.get(queueRef.orderBy("createdAt", "asc").limit(50)),
      ]);
    const creator = creatorSnapshot.data();

    if (!creatorSnapshot.exists || creator?.ownerUid !== request.auth?.uid) {
      throw new HttpsError("permission-denied", "Only the creator can trigger a spin.");
    }

    const config = parseConfig(configSnapshot.data());
    const state = stateSnapshot.data();

    if (Number(state?.lockedUntilMs ?? 0) > now) {
      throw new HttpsError("failed-precondition", "The wheel is already spinning.");
    }

    const queueEntry = queueSnapshot.docs.find(
      (snapshot) => snapshot.data().status === "queued",
    );

    if (!queueEntry) {
      throw new HttpsError("failed-precondition", "The queue is empty.");
    }

    selectedIndex = randomInt(config.slices.length);
    const slice = config.slices[selectedIndex];
    const entry = queueEntry.data();
    const amountCents = Number(entry.amountCents ?? config.spinPriceCents);
    const deltaCents = counterDelta(slice, amountCents);
    const nextCounter = Math.max(0, Number(state?.counterCents ?? 0) + deltaCents);

    transaction.update(queueEntry.ref, {
      status: "completed",
      resultLabel: slice.label,
      selectedSliceId: slice.id,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (slice.type === "bonus") {
      const bonusRef = queueRef.doc();
      transaction.create(bonusRef, {
        viewerName: String(entry.viewerName ?? "Viewer"),
        amountCents,
        source: "bonus",
        status: "queued",
        resultLabel: null,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(
      stateRef,
      {
        creatorId,
        counterCents: nextCounter,
        spinId,
        queueEntryId: queueEntry.id,
        viewerName: String(entry.viewerName ?? "Viewer"),
        selectedIndex,
        resultLabel: slice.label,
        resultType: slice.type,
        counterDeltaCents: deltaCents,
        startedAtMs: now,
        durationMs,
        lockedUntilMs: now + durationMs,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { spinId, selectedIndex };
});

export const adjustSpinCounter = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");
  const deltaCents = Number(request.data?.deltaCents);

  if (!request.auth || request.auth.uid !== creatorId) {
    throw new HttpsError("permission-denied", "Only the creator can adjust the counter.");
  }

  if (!Number.isInteger(deltaCents) || Math.abs(deltaCents) > 1000000) {
    throw new HttpsError("invalid-argument", "Invalid counter adjustment.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const stateRef = creatorRef.collection("spinStates").doc("current");
  let counterCents = 0;

  await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      transaction.get(stateRef),
    ]);

    if (
      !creatorSnapshot.exists ||
      creatorSnapshot.data()?.ownerUid !== request.auth?.uid
    ) {
      throw new HttpsError("permission-denied", "Only the creator can adjust the counter.");
    }

    counterCents = Math.max(0, Number(stateSnapshot.data()?.counterCents ?? 0) + deltaCents);
    transaction.set(
      stateRef,
      {
        creatorId,
        counterCents,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { counterCents };
});
