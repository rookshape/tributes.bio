import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AnalyticsSummary,
  DailyAnalytics,
  LinkAnalytics,
} from "./types";

export type AnalyticsRange = 7 | 30 | 90 | "all";

const emptySummary: AnalyticsSummary = {
  profileViews: 0,
  linkClicks: 0,
};

function numberValue(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function dateKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export async function getCreatorAnalytics(
  creatorId: string,
  range: AnalyticsRange,
) {
  const summaryRef = doc(db, "creatorAnalytics", creatorId);
  const daysRef = collection(summaryRef, "days");
  const startDate = dateKey(range === "all" ? 29 : range - 1);

  const [summarySnapshot, daysSnapshot, linksSnapshot] = await Promise.all([
    getDoc(summaryRef),
    getDocs(query(daysRef, where(documentId(), ">=", startDate))),
    getDocs(
      query(collection(summaryRef, "links"), orderBy("clicks", "desc")),
    ),
  ]);

  const summaryData = summarySnapshot.data();
  const allTimeSummary = summarySnapshot.exists()
    ? {
        profileViews: numberValue(summaryData?.profileViews),
        linkClicks: numberValue(summaryData?.linkClicks),
      }
    : emptySummary;
  const daily: DailyAnalytics[] = daysSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        date: snapshot.id,
        profileViews: numberValue(data.profileViews),
        linkClicks: numberValue(data.linkClicks),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const rangeSummary = daily.reduce<AnalyticsSummary>(
    (totals, day) => ({
      profileViews: totals.profileViews + day.profileViews,
      linkClicks: totals.linkClicks + day.linkClicks,
    }),
    { ...emptySummary },
  );
  const links: LinkAnalytics[] = linksSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    title: String(snapshot.data().title ?? "Link"),
    clicks: numberValue(snapshot.data().clicks),
  }));

  return {
    summary: range === "all" ? allTimeSummary : rangeSummary,
    daily,
    links,
  };
}
