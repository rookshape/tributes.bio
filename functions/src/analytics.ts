import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

type AnalyticsEventType = "profile_view" | "creator_link_click";
type AnalyticsRange = 7 | 30 | 90 | "all";

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

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dateKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function referrerLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Direct";

  try {
    return new URL(value).hostname.replace(/^www\./, "") || "Direct";
  } catch {
    return "Other";
  }
}

function timestampDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString().slice(0, 10) : "";
}

export const recordAnalyticsEvent = onCall(async (request) => {
  const data = request.data as AnalyticsRequest;
  const creatorId = requiredId(data.creatorId, "creator ID");
  const eventId = requiredId(data.eventId, "event ID");
  const eventType = data.eventType;

  if (eventType !== "profile_view" && eventType !== "creator_link_click") {
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
  const linkRef = linkId ? creatorRef.collection("links").doc(linkId) : null;
  const linkAnalyticsRef = linkId
    ? summaryRef.collection("links").doc(linkId)
    : null;

  const accepted = await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, eventSnapshot, linkSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      transaction.get(eventRef),
      linkRef ? transaction.get(linkRef) : Promise.resolve(null),
    ]);

    if (eventSnapshot.exists) return false;

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

export const getCreatorAnalyticsDashboard = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");

  const rangeValue = request.data?.range;
  const range: AnalyticsRange =
    rangeValue === "all" || [7, 30, 90].includes(rangeValue)
      ? rangeValue
      : 30;
  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${uid}`);
  const summaryRef = firestore.doc(`creatorAnalytics/${uid}`);
  const [creatorSnapshot, summarySnapshot, daysSnapshot, linksSnapshot, paymentsSnapshot, eventsSnapshot] =
    await Promise.all([
      creatorRef.get(),
      summaryRef.get(),
      summaryRef.collection("days").limit(400).get(),
      summaryRef.collection("links").limit(200).get(),
      firestore.collection("payments").where("creatorId", "==", uid).limit(5000).get(),
      firestore.collection("analyticsEvents").where("creatorId", "==", uid).limit(5000).get(),
    ]);

  if (!creatorSnapshot.exists || creatorSnapshot.data()?.ownerUid !== uid) {
    throw new HttpsError("failed-precondition", "Creator account required.");
  }

  const startDate = range === "all" ? "" : dateKey(range - 1);
  const dailyMap = new Map<string, {
    date: string;
    profileViews: number;
    linkClicks: number;
    earningsCents: number;
    tipCount: number;
    spinCount: number;
  }>();

  for (const document of daysSnapshot.docs) {
    if (startDate && document.id < startDate) continue;
    const data = document.data();
    dailyMap.set(document.id, {
      date: document.id,
      profileViews: numberValue(data.profileViews),
      linkClicks: numberValue(data.linkClicks),
      earningsCents: 0,
      tipCount: 0,
      spinCount: 0,
    });
  }

  let earningsCents = 0;
  let tipCount = 0;
  let spinCount = 0;
  for (const document of paymentsSnapshot.docs) {
    const payment = document.data();
    if (payment.status !== "succeeded") continue;
    const paymentDate = timestampDate(payment.createdAt);
    if (startDate && (!paymentDate || paymentDate < startDate)) continue;

    const amount = numberValue(payment.creatorAmountCents);
    earningsCents += amount;
    if (payment.kind === "spin") spinCount += 1;
    else tipCount += 1;

    if (paymentDate) {
      const day = dailyMap.get(paymentDate) ?? {
        date: paymentDate,
        profileViews: 0,
        linkClicks: 0,
        earningsCents: 0,
        tipCount: 0,
        spinCount: 0,
      };
      day.earningsCents += amount;
      if (payment.kind === "spin") day.spinCount += 1;
      else day.tipCount += 1;
      dailyMap.set(paymentDate, day);
    }
  }

  const events = eventsSnapshot.docs
    .map((document) => document.data())
    .filter((event) => !startDate || String(event.date ?? "") >= startDate);
  const referrers = new Map<string, { views: number; clicks: number }>();
  const rangeLinkClicks = new Map<string, number>();

  for (const event of events) {
    const label = referrerLabel(event.referrer);
    const totals = referrers.get(label) ?? { views: 0, clicks: 0 };
    if (event.eventType === "profile_view") totals.views += 1;
    if (event.eventType === "creator_link_click") {
      totals.clicks += 1;
      const linkId = String(event.linkId ?? "");
      if (linkId) rangeLinkClicks.set(linkId, (rangeLinkClicks.get(linkId) ?? 0) + 1);
    }
    referrers.set(label, totals);
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const rangeActivity = daily.reduce(
    (totals, day) => ({
      profileViews: totals.profileViews + day.profileViews,
      linkClicks: totals.linkClicks + day.linkClicks,
    }),
    { profileViews: 0, linkClicks: 0 },
  );
  const storedSummary = summarySnapshot.data();
  const profileViews =
    range === "all" ? numberValue(storedSummary?.profileViews) : rangeActivity.profileViews;
  const linkClicks =
    range === "all" ? numberValue(storedSummary?.linkClicks) : rangeActivity.linkClicks;
  const successfulPayments = tipCount + spinCount;

  const links = linksSnapshot.docs
    .map((document) => {
      const clicks =
        range === "all"
          ? numberValue(document.data().clicks)
          : rangeLinkClicks.get(document.id) ?? 0;
      return {
        id: document.id,
        title: String(document.data().title ?? "Link"),
        clicks,
        clickThroughRate: profileViews > 0 ? (clicks / profileViews) * 100 : 0,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  return {
    summary: {
      profileViews,
      linkClicks,
      earningsCents,
      tipCount,
      spinCount,
      successfulPayments,
      averageTipCents: tipCount > 0 ? Math.round(
        paymentsSnapshot.docs.reduce((total, document) => {
          const payment = document.data();
          const paymentDate = timestampDate(payment.createdAt);
          return payment.status === "succeeded" &&
            payment.kind !== "spin" &&
            (!startDate || paymentDate >= startDate)
            ? total + numberValue(payment.creatorAmountCents)
            : total;
        }, 0) / tipCount,
      ) : 0,
      conversionRate: profileViews > 0 ? (successfulPayments / profileViews) * 100 : 0,
    },
    daily,
    links,
    referrers: [...referrers.entries()]
      .map(([source, totals]) => ({ source, ...totals, total: totals.views + totals.clicks }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
  };
});
