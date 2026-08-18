import { randomInt, randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  cancelSpinAuthorization,
  captureSpinAuthorization,
  stripeSecret,
} from "./stripe.js";
import {
  spinSessionIsLive,
} from "./spin-session.js";

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
  name: string;
  title: string;
  counterLabel: string;
  spinPriceCents: number;
  isEnabled: boolean;
  showOnProfile: boolean;
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

    if (
      (slice.type === "amount" && (slice.value < 100 || slice.value > 100000)) ||
      (slice.type === "multiplier" &&
        (slice.value < 1 || data.spinPriceCents * slice.value > 100000))
    ) {
      throw new HttpsError("failed-precondition", "Spin results must be between $1 and $1,000.");
    }
  }

  return {
    title: data.title,
    counterLabel: data.counterLabel,
    spinPriceCents: data.spinPriceCents,
    name: typeof data?.name === "string" ? data.name : "Wheel",
    isEnabled: data.isEnabled === true,
    showOnProfile: data.showOnProfile !== false,
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

  if (slice.type === "action") {
    return amountCents;
  }

  return 0;
}

export const setSpinLiveStatus = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const creatorId = requiredId(request.data?.creatorId, "creator ID");
    const isLive = request.data?.isLive === true;

    if (!request.auth || request.auth.uid !== creatorId) {
      throw new HttpsError("permission-denied", "Only the creator can change live status.");
    }

    const firestore = getFirestore();
    const creatorRef = firestore.doc(`creators/${creatorId}`);
    const configRef = creatorRef.collection("spinConfigs").doc("current");
    const sessionRef = creatorRef.collection("spinSessions").doc("current");
    const [creatorSnapshot, configSnapshot, sessionSnapshot] = await Promise.all([
      creatorRef.get(),
      configRef.get(),
      sessionRef.get(),
    ]);

    if (
      !creatorSnapshot.exists ||
      creatorSnapshot.data()?.ownerUid !== request.auth.uid
    ) {
      throw new HttpsError("permission-denied", "Only the creator can change live status.");
    }

    const config = parseConfig(configSnapshot.data());

    if (isLive && !config.isEnabled) {
      throw new HttpsError("failed-precondition", "Enable Spin before going live.");
    }

    const now = Date.now();
    const session = sessionSnapshot.data();
    const effectiveLive = isLive || session?.twitchLive === true;
    await sessionRef.set(
      {
        creatorId,
        manualLive: isLive,
        status: effectiveLive ? "live" : "offline",
        heartbeatAtMs: now,
        manualHeartbeatAtMs: now,
        ...(isLive ? { startedAtMs: now } : { endedAtMs: now }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (!effectiveLive) {
      const queuedSnapshot = await creatorRef
        .collection("spinQueue")
        .where("status", "==", "queued")
        .limit(50)
        .get();
      await Promise.allSettled(
        queuedSnapshot.docs
          .map((snapshot) => snapshot.data().paymentId)
          .filter((paymentId): paymentId is string => typeof paymentId === "string")
          .map((paymentId) => cancelSpinAuthorization(paymentId)),
      );
    }

    return {
      status: effectiveLive ? "live" as const : "offline" as const,
      manualLive: isLive,
      heartbeatAtMs: now,
    };
  },
);

export const heartbeatSpinSession = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");

  if (!request.auth || request.auth.uid !== creatorId) {
    throw new HttpsError("permission-denied", "Only the creator can update the live session.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const sessionRef = creatorRef.collection("spinSessions").doc("current");
  const [creatorSnapshot, sessionSnapshot] = await Promise.all([
    creatorRef.get(),
    sessionRef.get(),
  ]);
  const session = sessionSnapshot.data();
  const manualLiveRequested =
    typeof session?.manualLive === "boolean"
      ? session.manualLive === true
      : session?.status === "live" && session?.twitchLive !== true;

  if (
    !creatorSnapshot.exists ||
    creatorSnapshot.data()?.ownerUid !== request.auth.uid ||
    !manualLiveRequested
  ) {
    throw new HttpsError("failed-precondition", "Spin is not live.");
  }

  const heartbeatAtMs = Date.now();
  await sessionRef.set(
    {
      heartbeatAtMs,
      manualHeartbeatAtMs: heartbeatAtMs,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { heartbeatAtMs };
});

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
      wheelId: "current",
      wheelName: typeof config.name === "string" ? config.name : null,
      status: "queued",
      resultLabel: null,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { entryId: entryRef.id };
});

export const triggerSpin = onCall({ secrets: [stripeSecret] }, async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");

  if (!request.auth || request.auth.uid !== creatorId) {
    throw new HttpsError("permission-denied", "Only the creator can trigger a spin.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const configRef = creatorRef.collection("spinConfigs").doc("current");
  const stateRef = creatorRef.collection("spinStates").doc("current");
  const sessionRef = creatorRef.collection("spinSessions").doc("current");
  const queueRef = creatorRef.collection("spinQueue");
  const now = Date.now();
  const durationMs = 5500;
  const spinId = randomUUID();
  let selectedIndex = 0;
  let selectedEntryId = "";
  let selectedPaymentId: string | null = null;
  let selectedReceiptId: string | null = null;
  let selectedResultAmountCents = 0;
  let selectedResultLabel = "";
  let selectedResultType: SpinSliceType = "action";

  await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, configSnapshot, stateSnapshot, sessionSnapshot, queueSnapshot] =
      await Promise.all([
        transaction.get(creatorRef),
        transaction.get(configRef),
        transaction.get(stateRef),
        transaction.get(sessionRef),
        transaction.get(queueRef.orderBy("createdAt", "asc").limit(50)),
      ]);
    const creator = creatorSnapshot.data();

    if (!creatorSnapshot.exists || creator?.ownerUid !== request.auth?.uid) {
      throw new HttpsError("permission-denied", "Only the creator can trigger a spin.");
    }

    const state = stateSnapshot.data();
    const session = sessionSnapshot.data();

    if (
      !spinSessionIsLive(session, now)
    ) {
      throw new HttpsError("failed-precondition", "Go live before spinning.");
    }

    if (Number(state?.lockedUntilMs ?? 0) > now) {
      throw new HttpsError("failed-precondition", "The wheel is already spinning.");
    }

    const queuedEntries = queueSnapshot.docs.filter(
      (snapshot) => snapshot.data().status === "queued",
    );
    const queueEntry = queuedEntries[0];

    if (!queueEntry) {
      throw new HttpsError("failed-precondition", "The queue is empty.");
    }

    // Every read must precede the first write in a transaction, so the
    // paid-for wheel is fetched here rather than alongside the others above.
    const entryWheelId =
      typeof queueEntry.data().wheelId === "string"
        ? (queueEntry.data().wheelId as string)
        : "current";
    const entryWheelSnapshot =
      entryWheelId === "current"
        ? configSnapshot
        : await transaction.get(
            creatorRef.collection("spinConfigs").doc(entryWheelId),
          );
    // A wheel deleted since the viewer paid falls back to the active one, so a
    // paid entry still resolves rather than being stranded in the queue.
    const config = parseConfig(
      entryWheelSnapshot.exists ? entryWheelSnapshot.data() : configSnapshot.data(),
    );

    // What the overlay shows next: the following viewer's wheel if there is
    // one, otherwise it stays on the wheel just spun.
    const nextEntry = queuedEntries[1];
    const nextWheelId =
      nextEntry && typeof nextEntry.data().wheelId === "string"
        ? (nextEntry.data().wheelId as string)
        : entryWheelId;

    const previousSelectedIndex = Number(queueEntry.data().selectedIndex);
    selectedIndex =
      Number.isInteger(previousSelectedIndex) &&
      previousSelectedIndex >= 0 &&
      previousSelectedIndex < config.slices.length
        ? previousSelectedIndex
        : randomInt(config.slices.length);
    const slice = config.slices[selectedIndex];
    const entry = queueEntry.data();
    const amountCents = Number(entry.amountCents ?? config.spinPriceCents);
    const deltaCents = counterDelta(slice, amountCents);
    const paymentId = typeof entry.paymentId === "string" ? entry.paymentId : null;
    const requiresCapture = Boolean(
      paymentId &&
        entry.paymentStatus === "authorized" &&
        Number(entry.authorizedTotalCents ?? 0) > 0,
    );
    const receiptId = typeof entry.receiptId === "string" ? entry.receiptId : null;
    const receiptRef = receiptId ? firestore.doc(`spinReceipts/${receiptId}`) : null;
    selectedEntryId = queueEntry.id;
    selectedPaymentId = requiresCapture ? paymentId : null;
    selectedReceiptId = receiptId;
    selectedResultAmountCents = deltaCents;
    selectedResultLabel = slice.label;
    selectedResultType = slice.type;

    if (slice.type === "bonus") {
      transaction.update(queueEntry.ref, {
        status: "queued",
        resultLabel: slice.label,
        selectedIndex: null,
        selectedSliceId: slice.id,
        capturePending: false,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (receiptRef) {
        transaction.set(
          receiptRef,
          {
            status: "bonus",
            resultLabel: slice.label,
            creatorAmountCents: null,
            totalCents: null,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: now,
          },
          { merge: true },
        );
      }

      transaction.set(
        stateRef,
        {
          creatorId,
          counterCents: Number(state?.counterCents ?? 0),
          spinId,
          queueEntryId: queueEntry.id,
          viewerName: String(entry.viewerName ?? "Viewer"),
          selectedIndex,
          resultLabel: slice.label,
          resultType: slice.type,
          counterDeltaCents: 0,
          startedAtMs: now,
          durationMs,
          lockedUntilMs: now + durationMs,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    if (requiresCapture) {
      transaction.update(queueEntry.ref, {
        status: "capturing",
        selectedIndex,
        selectedSliceId: slice.id,
        resultLabel: slice.label,
        resultAmountCents: deltaCents,
        captureOperationId: spinId,
        capturePending: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (receiptRef) {
        transaction.set(
          receiptRef,
          {
            status: "capturing",
            resultLabel: null,
            creatorAmountCents: null,
            totalCents: null,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: now,
          },
          { merge: true },
        );
      }

      transaction.set(
        stateRef,
        {
          creatorId,
          spinId: null,
          queueEntryId: queueEntry.id,
          viewerName: String(entry.viewerName ?? "Viewer"),
          selectedIndex: null,
          resultLabel: null,
          lockedUntilMs: now + 30000,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const nextCounter = Math.max(0, Number(state?.counterCents ?? 0) + deltaCents);
    transaction.update(queueEntry.ref, {
      status: "completed",
      resultLabel: slice.label,
      selectedSliceId: slice.id,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      stateRef,
      {
        creatorId,
        counterCents: nextCounter,
        spinId,
        queueEntryId: queueEntry.id,
        viewerName: String(entry.viewerName ?? "Viewer"),
        // The wheel this spin ran on, and the one the overlay should show once
        // it settles — the next viewer's, or this one if nobody is waiting.
        wheelId: entryWheelId,
        nextWheelId,
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

  if (selectedPaymentId && selectedResultAmountCents > 0) {
    let capturedTotalCents = 0;

    try {
      const capture = await captureSpinAuthorization(
        selectedPaymentId,
        selectedResultAmountCents,
      );
      capturedTotalCents = capture.totalCents;
    } catch (error) {
      const batch = firestore.batch();
      batch.set(
        queueRef.doc(selectedEntryId),
        {
          status: "queued",
          capturePending: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batch.set(
        stateRef,
        { lockedUntilMs: 0, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      if (selectedReceiptId) {
        batch.set(
          firestore.doc(`spinReceipts/${selectedReceiptId}`),
          {
            status: "queued",
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: Date.now(),
          },
          { merge: true },
        );
      }
      await batch.commit();
      throw error;
    }

    const animationStartedAt = Date.now();
    await firestore.runTransaction(async (transaction) => {
      const [entrySnapshot, stateSnapshot] = await Promise.all([
        transaction.get(queueRef.doc(selectedEntryId)),
        transaction.get(stateRef),
      ]);

      if (
        !entrySnapshot.exists ||
        entrySnapshot.data()?.captureOperationId !== spinId
      ) {
        throw new HttpsError("aborted", "The queue entry changed during capture.");
      }

      const nextCounter = Math.max(
        0,
        Number(stateSnapshot.data()?.counterCents ?? 0) + selectedResultAmountCents,
      );
      transaction.set(
        entrySnapshot.ref,
        {
          status: "completed",
          capturePending: false,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(
        stateRef,
        {
          creatorId,
          counterCents: nextCounter,
          spinId,
          queueEntryId: selectedEntryId,
          viewerName: String(entrySnapshot.data()?.viewerName ?? "Viewer"),
          selectedIndex,
          resultLabel: selectedResultLabel,
          resultType: selectedResultType,
          counterDeltaCents: selectedResultAmountCents,
          startedAtMs: animationStartedAt,
          durationMs,
          lockedUntilMs: animationStartedAt + durationMs,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (selectedReceiptId) {
        transaction.set(
          firestore.doc(`spinReceipts/${selectedReceiptId}`),
          {
            status: "completed",
            resultLabel: selectedResultLabel,
            creatorAmountCents: selectedResultAmountCents,
            totalCents: capturedTotalCents,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: animationStartedAt,
          },
          { merge: true },
        );
      }
    });
  }

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
