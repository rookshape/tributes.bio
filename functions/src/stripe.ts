import { randomBytes } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";

export const stripeSecret = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

type ConnectStatus = "not_started" | "needs_action" | "pending" | "active" | "restricted";

type CheckoutRequest = {
  amountCents?: unknown;
  anonymous?: unknown;
  creatorId?: unknown;
  message?: unknown;
  origin?: unknown;
  senderName?: unknown;
};

type SpinCheckoutRequest = {
  anonymous?: unknown;
  creatorId?: unknown;
  origin?: unknown;
  senderName?: unknown;
};

type SpinSlice = {
  type?: unknown;
  value?: unknown;
};

function stripeClient() {
  return new Stripe(stripeSecret.value());
}

function requiredAuthUid(auth: { uid: string } | undefined) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }

  return auth.uid;
}

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

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function allowedOrigin(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Invalid return URL.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid return URL.");
  }

  const local =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  const hosted =
    url.protocol === "https:" &&
    [
      "tributes.bio",
      "www.tributes.bio",
      "tributes-bio-dev.web.app",
      "tributes-bio-dev.firebaseapp.com",
      "tributes-bio-prod.web.app",
      "tributes-bio-prod.firebaseapp.com",
    ].includes(url.hostname);

  if (!local && !hosted) {
    throw new HttpsError("permission-denied", "Return URL is not allowed.");
  }

  return url.origin;
}

function connectStatus(account: Stripe.Account): ConnectStatus {
  if (account.requirements?.disabled_reason) {
    return "restricted";
  }

  if (
    account.details_submitted &&
    account.payouts_enabled &&
    account.capabilities?.transfers === "active"
  ) {
    return "active";
  }

  if (account.details_submitted) {
    return "pending";
  }

  return "needs_action";
}

function spinResultAmountCents(slice: SpinSlice, baseAmountCents: number) {
  const value = Number(slice.value ?? 0);

  if (slice.type === "amount") {
    return Number.isInteger(value) ? Math.max(0, value) : 0;
  }

  if (slice.type === "multiplier") {
    return Number.isInteger(value)
      ? baseAmountCents * Math.max(1, value)
      : baseAmountCents;
  }

  if (slice.type === "action") {
    return baseAmountCents;
  }

  return 0;
}

function totalWithServiceFee(amountCents: number) {
  return amountCents + Math.round(amountCents * 0.25);
}

async function syncConnectAccount(
  uid: string,
  account: Stripe.Account,
) {
  const status = connectStatus(account);
  await getFirestore().doc(`creatorSettings/${uid}`).set(
    {
      ownerUid: uid,
      stripeAccountId: account.id,
      stripeOnboardingStatus: status,
      stripePayoutsEnabled: account.payouts_enabled,
      stripeTransfersStatus: account.capabilities?.transfers ?? "inactive",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return status;
}

export const createStripeConnectOnboardingLink = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const uid = requiredAuthUid(request.auth);
    const origin = allowedOrigin(request.data?.origin);
    const firestore = getFirestore();
    const [userSnapshot, creatorSnapshot, settingsSnapshot] = await Promise.all([
      firestore.doc(`users/${uid}`).get(),
      firestore.doc(`creators/${uid}`).get(),
      firestore.doc(`creatorSettings/${uid}`).get(),
    ]);

    if (
      userSnapshot.data()?.accountType !== "creator" ||
      creatorSnapshot.data()?.ownerUid !== uid
    ) {
      throw new HttpsError("failed-precondition", "Creator account required.");
    }

    const stripe = stripeClient();
    let accountId = settingsSnapshot.data()?.stripeAccountId;

    if (typeof accountId !== "string" || !accountId.startsWith("acct_")) {
      const email = userSnapshot.data()?.email;
      const username = String(creatorSnapshot.data()?.username ?? uid);
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: typeof email === "string" ? email : undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          product_description: "Creator tips and audience support",
          url: `https://tributes.bio/${encodeURIComponent(username)}`,
        },
        metadata: {
          firebaseUid: uid,
          tributesUsername: username,
        },
      });
      accountId = account.id;
      await syncConnectAccount(uid, account);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${origin}/dashboard/settings?stripe=refresh`,
      return_url: `${origin}/dashboard/settings?stripe=return`,
    });

    return { url: accountLink.url };
  },
);

export const refreshStripeConnectStatus = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const uid = requiredAuthUid(request.auth);
    const settingsRef = getFirestore().doc(`creatorSettings/${uid}`);
    const settingsSnapshot = await settingsRef.get();
    const accountId = settingsSnapshot.data()?.stripeAccountId;

    if (typeof accountId !== "string" || !accountId.startsWith("acct_")) {
      return { status: "not_started" satisfies ConnectStatus };
    }

    const account = await stripeClient().accounts.retrieve(accountId);

    if (account.deleted) {
      await settingsRef.set(
        {
          stripeOnboardingStatus: "restricted",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { status: "restricted" satisfies ConnectStatus };
    }

    return { status: await syncConnectAccount(uid, account) };
  },
);

export const createStripeConnectDashboardLink = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const uid = requiredAuthUid(request.auth);
    const settingsSnapshot = await getFirestore()
      .doc(`creatorSettings/${uid}`)
      .get();
    const accountId = settingsSnapshot.data()?.stripeAccountId;

    if (typeof accountId !== "string" || !accountId.startsWith("acct_")) {
      throw new HttpsError(
        "failed-precondition",
        "Complete payout setup first.",
      );
    }

    const loginLink = await stripeClient().accounts.createLoginLink(accountId);
    return { url: loginLink.url };
  },
);

export const getCreatorPaymentAvailability = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");
  const firestore = getFirestore();
  const [creatorSnapshot, settingsSnapshot] = await Promise.all([
    firestore.doc(`creators/${creatorId}`).get(),
    firestore.doc(`creatorSettings/${creatorId}`).get(),
  ]);
  const creator = creatorSnapshot.data();
  const settings = settingsSnapshot.data();
  const available =
    creatorSnapshot.exists &&
    creator?.isPublished === true &&
    creator?.moderationStatus === "active" &&
    settings?.stripeOnboardingStatus === "active" &&
    settings?.stripePayoutsEnabled === true &&
    typeof settings?.stripeAccountId === "string";

  return { available };
});

export const createTributeCheckoutSession = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const data = request.data as CheckoutRequest;
    const creatorId = requiredId(data.creatorId, "creator ID");
    const origin = allowedOrigin(data.origin);
    const amountCents = data.amountCents;

    if (
      typeof amountCents !== "number" ||
      !Number.isInteger(amountCents) ||
      amountCents < 100 ||
      amountCents > 50000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Tributes must be between $1 and $500.",
      );
    }

    const firestore = getFirestore();
    const [creatorSnapshot, settingsSnapshot] = await Promise.all([
      firestore.doc(`creators/${creatorId}`).get(),
      firestore.doc(`creatorSettings/${creatorId}`).get(),
    ]);
    const creator = creatorSnapshot.data();
    const settings = settingsSnapshot.data();

    if (
      !creatorSnapshot.exists ||
      creator?.isPublished !== true ||
      creator?.moderationStatus !== "active"
    ) {
      throw new HttpsError("not-found", "Creator is unavailable.");
    }

    const accountId = settings?.stripeAccountId;

    if (
      settings?.stripeOnboardingStatus !== "active" ||
      typeof accountId !== "string"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This creator is not accepting tributes yet.",
      );
    }

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(accountId);

    if (
      account.deleted ||
      connectStatus(account) !== "active"
    ) {
      if (!account.deleted) {
        await syncConnectAccount(creatorId, account);
      }
      throw new HttpsError(
        "failed-precondition",
        "This creator is not accepting tributes yet.",
      );
    }

    const platformFeeCents = Math.round(amountCents * 0.25);
    const totalCents = amountCents + platformFeeCents;
    const anonymous = data.anonymous === true;
    const senderName = anonymous ? "" : optionalText(data.senderName, 80);
    const message = optionalText(data.message, 280);
    const paymentRef = firestore.collection("payments").doc();
    const username = String(creator.username ?? creatorId);

    await paymentRef.set({
      kind: "tribute",
      creatorId,
      payerUid: request.auth?.uid ?? null,
      senderName,
      message,
      anonymous,
      currency: "usd",
      creatorAmountCents: amountCents,
      platformFeeCents,
      totalCents,
      status: "pending_checkout",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          submit_type: "donate",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: totalCents,
                product_data: {
                  name: `Tribute to ${String(creator.displayName ?? username)}`,
                  description: `Includes a $${(platformFeeCents / 100).toFixed(2)} service fee`,
                },
              },
            },
          ],
          metadata: {
            creatorId,
            paymentId: paymentRef.id,
          },
          payment_intent_data: {
            application_fee_amount: platformFeeCents,
            transfer_data: { destination: accountId },
            metadata: {
              creatorId,
              paymentId: paymentRef.id,
            },
          },
          success_url: `${origin}/${encodeURIComponent(username)}?payment=success`,
          cancel_url: `${origin}/${encodeURIComponent(username)}?payment=canceled`,
        },
        { idempotencyKey: `tribute_checkout_${paymentRef.id}` },
      );

      if (!session.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      await paymentRef.update({
        stripeCheckoutSessionId: session.id,
        status: "checkout_created",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { url: session.url };
    } catch (error) {
      await paymentRef.update({
        status: "checkout_failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Could not start checkout.",
      );
    }
  },
);

export const createSpinCheckoutSession = onCall(
  { secrets: [stripeSecret] },
  async (request) => {
    const data = request.data as SpinCheckoutRequest;
    const creatorId = requiredId(data.creatorId, "creator ID");
    const origin = allowedOrigin(data.origin);
    const firestore = getFirestore();
    const [creatorSnapshot, settingsSnapshot, configSnapshot, sessionSnapshot] =
      await Promise.all([
        firestore.doc(`creators/${creatorId}`).get(),
        firestore.doc(`creatorSettings/${creatorId}`).get(),
        firestore.doc(`creators/${creatorId}/spinConfigs/current`).get(),
        firestore.doc(`creators/${creatorId}/spinSessions/current`).get(),
      ]);
    const creator = creatorSnapshot.data();
    const settings = settingsSnapshot.data();
    const config = configSnapshot.data();
    const session = sessionSnapshot.data();
    const liveHeartbeat = Number(session?.heartbeatAtMs ?? 0);

    if (
      !creatorSnapshot.exists ||
      creator?.isPublished !== true ||
      creator?.moderationStatus !== "active" ||
      !configSnapshot.exists ||
      config?.isEnabled !== true ||
      session?.status !== "live" ||
      Date.now() - liveHeartbeat >= 120000
    ) {
      throw new HttpsError("failed-precondition", "This creator is not accepting spins.");
    }

    const spinPriceCents = config?.spinPriceCents;

    if (
      typeof spinPriceCents !== "number" ||
      !Number.isInteger(spinPriceCents) ||
      spinPriceCents < 100 ||
      spinPriceCents > 100000
    ) {
      throw new HttpsError("failed-precondition", "The spin price is invalid.");
    }

    const accountId = settings?.stripeAccountId;

    if (
      settings?.stripeOnboardingStatus !== "active" ||
      typeof accountId !== "string"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This creator is not accepting paid spins yet.",
      );
    }

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(accountId);

    if (account.deleted || connectStatus(account) !== "active") {
      if (!account.deleted) {
        await syncConnectAccount(creatorId, account);
      }
      throw new HttpsError(
        "failed-precondition",
        "This creator is not accepting paid spins yet.",
      );
    }

    const slices = Array.isArray(config?.slices) ? (config.slices as SpinSlice[]) : [];
    const maximumCreatorAmountCents = Math.max(
      spinPriceCents,
      ...slices.map((slice) => spinResultAmountCents(slice, spinPriceCents)),
    );

    if (maximumCreatorAmountCents < 100 || maximumCreatorAmountCents > 100000) {
      throw new HttpsError(
        "failed-precondition",
        "Spin results must be between $1 and $1,000.",
      );
    }

    const authorizedTotalCents = totalWithServiceFee(maximumCreatorAmountCents);
    const anonymous = data.anonymous === true;
    const senderName = anonymous ? "" : optionalText(data.senderName, 40);
    const paymentRef = firestore.collection("payments").doc();
    const receiptId = randomBytes(24).toString("base64url");
    const receiptRef = firestore.doc(`spinReceipts/${receiptId}`);
    const username = String(creator.username ?? creatorId);

    const batch = firestore.batch();
    batch.set(paymentRef, {
        kind: "spin",
        creatorId,
        payerUid: request.auth?.uid ?? null,
        senderName,
        message: "",
        anonymous,
        currency: "usd",
        baseAmountCents: spinPriceCents,
        maximumCreatorAmountCents,
        authorizedTotalCents,
        creatorAmountCents: null,
        platformFeeCents: null,
        totalCents: null,
        spinConfigId: "current",
        queueEntryId: null,
        receiptId,
        status: "pending_checkout",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    batch.set(receiptRef, {
      creatorId,
      creatorUsername: username,
      viewerName: anonymous || !senderName ? "Anonymous" : senderName,
      status: "checkout",
      resultLabel: null,
      creatorAmountCents: null,
      totalCents: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
    });
    await batch.commit();

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          submit_type: "pay",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: authorizedTotalCents,
                product_data: {
                  name: `Maximum spin authorization for ${String(creator.displayName ?? username)}`,
                  description: "The final charge is based on the live wheel result.",
                },
              },
            },
          ],
          metadata: {
            creatorId,
            kind: "spin",
            paymentId: paymentRef.id,
          },
          payment_intent_data: {
            capture_method: "manual",
            transfer_data: { destination: accountId },
            metadata: {
              creatorId,
              kind: "spin",
              paymentId: paymentRef.id,
            },
          },
          payment_method_types: ["card"],
          success_url: `${origin}/${encodeURIComponent(username)}/spin?receipt=${encodeURIComponent(receiptId)}`,
          cancel_url: `${origin}/${encodeURIComponent(username)}`,
        },
        { idempotencyKey: `spin_checkout_${paymentRef.id}` },
      );

      if (!session.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      await paymentRef.update({
        stripeCheckoutSessionId: session.id,
        status: "checkout_created",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { url: session.url };
    } catch (error) {
      await paymentRef.update({
        status: "checkout_failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await receiptRef.set(
        {
          status: "canceled",
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtMs: Date.now(),
        },
        { merge: true },
      );
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Could not start checkout.",
      );
    }
  },
);

async function updatePaymentAndSpinQueue(
  paymentId: string,
  status: string,
  changes: Record<string, unknown>,
) {
  const firestore = getFirestore();
  const paymentRef = firestore.doc(`payments/${paymentId}`);

  await firestore.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);

    if (!paymentSnapshot.exists) {
      return;
    }

    const payment = paymentSnapshot.data()!;
    const creatorId = payment.creatorId;
    const isSpin = payment.kind === "spin" && typeof creatorId === "string";
    let effectiveStatus = status;

    if (
      payment.status === "succeeded" &&
      (status === "processing" || status === "authorized")
    ) {
      effectiveStatus = "succeeded";
    } else if (payment.status === "authorized" && status === "processing") {
      effectiveStatus = "authorized";
    } else if (
      ["failed", "canceled", "refunded", "disputed", "dispute_lost"].includes(
        payment.status,
      ) &&
      (status === "processing" || status === "authorized")
    ) {
      effectiveStatus = payment.status;
    }
    const queueRef = isSpin
      ? firestore.doc(`creators/${creatorId}/spinQueue/${paymentId}`)
      : null;
    const receiptRef =
      isSpin && typeof payment.receiptId === "string"
        ? firestore.doc(`spinReceipts/${payment.receiptId}`)
        : null;
    const [queueSnapshot, receiptSnapshot] = await Promise.all([
      queueRef ? transaction.get(queueRef) : Promise.resolve(null),
      receiptRef ? transaction.get(receiptRef) : Promise.resolve(null),
    ]);
    const paymentChanges: Record<string, unknown> = {
      ...changes,
      status: effectiveStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(paymentRef, paymentChanges, { merge: true });

    if (!queueRef || !queueSnapshot || !isSpin) {
      return;
    }

    if (effectiveStatus === "authorized") {
      const queueData = {
        paymentId,
        receiptId: payment.receiptId ?? null,
        paymentStatus: effectiveStatus,
        viewerName:
          payment.anonymous === true || !payment.senderName
            ? "Anonymous"
            : String(payment.senderName).slice(0, 40),
        amountCents: Number(payment.baseAmountCents ?? 0),
        authorizedTotalCents: Number(payment.authorizedTotalCents ?? 0),
        source: "payment",
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!queueSnapshot.exists) {
        transaction.create(queueRef, {
          ...queueData,
          status: "queued",
          resultLabel: null,
          createdAt: FieldValue.serverTimestamp(),
          createdAtMs: Date.now(),
        });
        transaction.set(
          paymentRef,
          {
            queueEntryId: queueRef.id,
            queuedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else if (queueSnapshot.data()?.status === "canceled") {
        transaction.set(queueRef, { ...queueData, status: "queued" }, { merge: true });
      } else {
        transaction.set(queueRef, queueData, { merge: true });
      }

      if (receiptRef && receiptSnapshot?.exists) {
        transaction.set(
          receiptRef,
          {
            status: "queued",
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: Date.now(),
          },
          { merge: true },
        );
      }

      return;
    }

    if (effectiveStatus === "succeeded") {
      if (queueSnapshot.exists) {
        transaction.set(
          queueRef,
          {
            paymentStatus: effectiveStatus,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      return;
    }

    if (!["failed", "canceled", "refunded", "disputed", "dispute_lost"].includes(effectiveStatus)) {
      return;
    }

    if (queueSnapshot.exists) {
      const currentQueueStatus = queueSnapshot.data()?.status;
      const queueStatus =
        currentQueueStatus === "queued" || currentQueueStatus === "capturing"
          ? effectiveStatus === "canceled"
            ? "canceled"
            : "payment_failed"
          : currentQueueStatus;

      transaction.set(
        queueRef,
        {
          paymentStatus: effectiveStatus,
          status: queueStatus,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (
      receiptRef &&
      receiptSnapshot?.exists &&
      receiptSnapshot.data()?.status !== "completed"
    ) {
      transaction.set(
        receiptRef,
        {
          status: effectiveStatus === "canceled" ? "canceled" : "payment_failed",
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtMs: Date.now(),
        },
        { merge: true },
      );
    }
  });
}

async function updatePaymentFromSession(
  session: Stripe.Checkout.Session,
  status: string,
) {
  const paymentId = session.metadata?.paymentId;

  if (!paymentId) {
    return;
  }

  await updatePaymentAndSpinQueue(
    paymentId,
    status,
    {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      payerEmail: session.customer_details?.email ?? null,
    },
  );
}

async function updatePaymentFromIntent(
  intent: Stripe.PaymentIntent,
  status: string,
) {
  const paymentId = intent.metadata.paymentId;

  if (!paymentId) {
    return;
  }

  await updatePaymentAndSpinQueue(
    paymentId,
    status,
    {
      stripePaymentIntentId: intent.id,
      amountCapturableCents: intent.amount_capturable,
      failureMessage: intent.last_payment_error?.message ?? null,
    },
  );
}

export async function captureSpinAuthorization(
  paymentId: string,
  creatorAmountCents: number,
) {
  const paymentRef = getFirestore().doc(`payments/${paymentId}`);
  const paymentSnapshot = await paymentRef.get();
  const payment = paymentSnapshot.data();

  if (
    !paymentSnapshot.exists ||
    payment?.kind !== "spin" ||
    typeof payment.stripePaymentIntentId !== "string"
  ) {
    throw new HttpsError("failed-precondition", "Spin authorization not found.");
  }

  const platformFeeCents = Math.round(creatorAmountCents * 0.25);
  const totalCents = creatorAmountCents + platformFeeCents;

  if (
    !Number.isInteger(creatorAmountCents) ||
    creatorAmountCents < 100 ||
    totalCents > Number(payment.authorizedTotalCents ?? 0)
  ) {
    throw new HttpsError("failed-precondition", "Spin result exceeds the authorization.");
  }

  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );

  if (intent.status !== "succeeded") {
    if (intent.status !== "requires_capture") {
      throw new HttpsError("failed-precondition", "The payment is not capturable.");
    }

    await stripe.paymentIntents.capture(
      intent.id,
      {
        amount_to_capture: totalCents,
        application_fee_amount: platformFeeCents,
        metadata: {
          ...intent.metadata,
          creatorAmountCents: String(creatorAmountCents),
          platformFeeCents: String(platformFeeCents),
        },
      },
      { idempotencyKey: `spin_capture_${paymentId}` },
    );
  }

  await paymentRef.set(
    {
      creatorAmountCents,
      platformFeeCents,
      totalCents,
      capturedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { platformFeeCents, totalCents };
}

export async function cancelSpinAuthorization(paymentId: string) {
  const paymentRef = getFirestore().doc(`payments/${paymentId}`);
  const paymentSnapshot = await paymentRef.get();
  const payment = paymentSnapshot.data();

  if (
    !paymentSnapshot.exists ||
    payment?.kind !== "spin" ||
    typeof payment.stripePaymentIntentId !== "string"
  ) {
    return;
  }

  const intent = await stripeClient().paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );

  if (intent.status === "requires_capture") {
    await stripeClient().paymentIntents.cancel(intent.id, undefined, {
      idempotencyKey: `spin_cancel_${paymentId}`,
    });
  }
}

async function updatePaymentByIntentId(
  paymentIntentId: string,
  changes: Record<string, unknown>,
) {
  const snapshot = await getFirestore()
    .collection("payments")
    .where("stripePaymentIntentId", "==", paymentIntentId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const status = typeof changes.status === "string" ? changes.status : "processing";
    const paymentChanges = { ...changes };
    delete paymentChanges.status;
    await updatePaymentAndSpinQueue(
      snapshot.docs[0].id,
      status,
      paymentChanges,
    );
  }
}

export const stripeWebhook = onRequest(
  { secrets: [stripeSecret, stripeWebhookSecret] },
  async (request, response) => {
    const signature = request.headers["stripe-signature"];

    if (typeof signature !== "string") {
      response.status(400).send("Missing Stripe signature.");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripeClient().webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value(),
      );
    } catch {
      response.status(400).send("Invalid Stripe signature.");
      return;
    }

    const eventRef = getFirestore().doc(`stripeEvents/${event.id}`);

    if ((await eventRef.get()).exists) {
      response.status(200).send("Already processed.");
      return;
    }

    switch (event.type) {
      case "checkout.session.completed":
        await updatePaymentFromSession(
          event.data.object,
          event.data.object.payment_status === "paid"
            ? "succeeded"
            : "processing",
        );
        break;
      case "checkout.session.async_payment_succeeded":
        await updatePaymentFromSession(event.data.object, "succeeded");
        break;
      case "checkout.session.async_payment_failed":
        await updatePaymentFromSession(event.data.object, "failed");
        break;
      case "checkout.session.expired":
        await updatePaymentFromSession(event.data.object, "canceled");
        break;
      case "payment_intent.succeeded":
        await updatePaymentFromIntent(event.data.object, "succeeded");
        break;
      case "payment_intent.amount_capturable_updated":
        await updatePaymentFromIntent(
          event.data.object,
          event.data.object.amount_capturable > 0 ? "authorized" : "processing",
        );
        break;
      case "payment_intent.payment_failed":
        await updatePaymentFromIntent(event.data.object, "failed");
        break;
      case "payment_intent.canceled":
        await updatePaymentFromIntent(event.data.object, "canceled");
        break;
      case "charge.refunded": {
        const intentId =
          typeof event.data.object.payment_intent === "string"
            ? event.data.object.payment_intent
            : event.data.object.payment_intent?.id;
        if (intentId) {
          await updatePaymentByIntentId(intentId, {
            status: event.data.object.refunded ? "refunded" : "partially_refunded",
            amountRefundedCents: event.data.object.amount_refunded,
          });
        }
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const charge = await stripeClient().charges.retrieve(
          typeof event.data.object.charge === "string"
            ? event.data.object.charge
            : event.data.object.charge.id,
        );
        const intentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intentId) {
          await updatePaymentByIntentId(intentId, {
            status:
              event.type === "charge.dispute.created"
                ? "disputed"
                : event.data.object.status === "won"
                  ? "succeeded"
                  : "dispute_lost",
            stripeDisputeId: event.data.object.id,
          });
        }
        break;
      }
      case "account.updated":
        if (event.data.object.metadata?.firebaseUid) {
          await syncConnectAccount(
            event.data.object.metadata.firebaseUid,
            event.data.object,
          );
        }
        break;
      default:
        break;
    }

    await eventRef.create({
      type: event.type,
      processedAt: FieldValue.serverTimestamp(),
    });
    response.status(200).send("Received.");
  },
);
