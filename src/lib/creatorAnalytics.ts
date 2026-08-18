import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type {
  AnalyticsSummary,
  DailyAnalytics,
  LinkAnalytics,
  ReferrerAnalytics,
} from "./types";

export type AnalyticsRange = 7 | 30 | 90 | "all";

export type CreatorAnalyticsDashboard = {
  summary: AnalyticsSummary;
  daily: DailyAnalytics[];
  links: LinkAnalytics[];
  referrers: ReferrerAnalytics[];
};

const getAnalyticsCall = httpsCallable<
  { range: AnalyticsRange },
  CreatorAnalyticsDashboard
>(functions, "getCreatorAnalyticsDashboard");

export async function getCreatorAnalytics(range: AnalyticsRange) {
  const result = await getAnalyticsCall({ range });
  return result.data;
}
