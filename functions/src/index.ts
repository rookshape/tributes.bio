import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

type AnalyticsEventType = "profile_view" | "creator_link_click";

type AnalyticsRequest = {
  creatorId?: unknown;
  eventId?: unknown;
  eventType?: unknown;
  linkId?: unknown;
  referrer?: unknown;
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

export const recordAnalyticsEvent = onCall(async (request) => {
  const data = request.data as AnalyticsRequest;
  const creatorId = requiredId(data.creatorId, "creator ID");
  const eventId = requiredId(data.eventId, "event ID");
  const eventType = data.eventType;

  if (
    eventType !== "profile_view" &&
    eventType !== "creator_link_click"
  ) {
    throw new HttpsError("invalid-argument", "Invalid analytics event.");
  }

  const linkId =
    eventType === "creator_link_click"
      ? requiredId(data.linkId, "link ID")
      : null;
  const referrer =
    typeof data.referrer === "string" ? data.referrer.slice(0, 500) : "";
  const date = new Date().toISOString().slice(0, 10);
  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const eventRef = firestore.doc(`analyticsEvents/${eventId}`);
  const summaryRef = firestore.doc(`creatorAnalytics/${creatorId}`);
  const dayRef = summaryRef.collection("days").doc(date);
  const linkRef = linkId
    ? creatorRef.collection("links").doc(linkId)
    : null;
  const linkAnalyticsRef = linkId
    ? summaryRef.collection("links").doc(linkId)
    : null;

  const accepted = await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, eventSnapshot, linkSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      transaction.get(eventRef),
      linkRef ? transaction.get(linkRef) : Promise.resolve(null),
    ]);

    if (eventSnapshot.exists) {
      return false;
    }

    const creator = creatorSnapshot.data();

    if (
      !creatorSnapshot.exists ||
      creator?.isPublished !== true ||
      creator?.moderationStatus !== "active"
    ) {
      throw new HttpsError("failed-precondition", "Profile is unavailable.");
    }

    if (
      eventType === "creator_link_click" &&
      (!linkSnapshot?.exists || linkSnapshot.data()?.isActive !== true)
    ) {
      throw new HttpsError("failed-precondition", "Link is unavailable.");
    }

    const increments =
      eventType === "profile_view"
        ? { profileViews: FieldValue.increment(1) }
        : { linkClicks: FieldValue.increment(1) };

    transaction.create(eventRef, {
      creatorId,
      eventType,
      linkId,
      referrer,
      date,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      summaryRef,
      { ...increments, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    transaction.set(
      dayRef,
      { ...increments, date, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    if (linkAnalyticsRef && linkSnapshot) {
      transaction.set(
        linkAnalyticsRef,
        {
          title: String(linkSnapshot.data()?.title ?? "Link"),
          clicks: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return true;
  });

  return { accepted };
});

export {
  createStripeConnectDashboardLink,
  createStripeConnectOnboardingLink,
  createSpinCheckoutSession,
  createTributeCheckoutSession,
  getCreatorPaymentAvailability,
  refreshStripeConnectStatus,
  stripeWebhook,
} from "./stripe.js";

export {
  adjustSpinCounter,
  createMockSpinEntry,
  heartbeatSpinSession,
  setSpinLiveStatus,
  triggerSpin,
} from "./spin.js";
