import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { httpsCallable } from "firebase/functions";
import { firebaseApp, functions } from "./firebase";

type AnalyticsEventName = "profile_view" | "creator_link_click";

const analyticsPromise =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
    ? Promise.resolve(null)
    : isSupported().then((supported) =>
        supported ? getAnalytics(firebaseApp) : null,
      );

const recordCreatorAnalytics = httpsCallable(functions, "recordAnalyticsEvent");

async function recordEvent(
  eventType: AnalyticsEventName,
  eventId: string,
  creatorId: string,
  username: string,
  linkId?: string,
) {
  const analytics = await analyticsPromise;
  const referrer = document.referrer;
  const tasks: Promise<unknown>[] = [
    recordCreatorAnalytics({
      creatorId,
      eventId,
      eventType,
      linkId,
      referrer,
    }),
  ];

  if (analytics) {
    logEvent(analytics, eventType, {
      creator_id: creatorId,
      username,
      link_id: linkId,
    });
  }

  await Promise.allSettled(tasks);
}

export function trackProfileView(creatorId: string, username: string) {
  const sessionKey = `tributes-profile-view:${creatorId}`;

  if (sessionStorage.getItem(sessionKey)) {
    return;
  }

  const eventId = `view_${crypto.randomUUID()}`;
  sessionStorage.setItem(sessionKey, eventId);
  void recordEvent("profile_view", eventId, creatorId, username);
}

export function trackCreatorLinkClick(
  creatorId: string,
  username: string,
  linkId: string,
) {
  void recordEvent(
    "creator_link_click",
    `click_${crypto.randomUUID()}`,
    creatorId,
    username,
    linkId,
  );
}
