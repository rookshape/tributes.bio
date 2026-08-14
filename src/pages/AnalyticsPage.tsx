import { BarChart3, MousePointerClick, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCreatorAnalytics,
  type AnalyticsRange,
} from "../lib/creatorAnalytics";
import type {
  AnalyticsSummary,
  DailyAnalytics,
  LinkAnalytics,
} from "../lib/types";

const ranges: { label: string; value: AnalyticsRange }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "All time", value: "all" },
];

const emptySummary: AnalyticsSummary = { profileViews: 0, linkClicks: 0 };

export function AnalyticsPage() {
  const { appUser } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const creatorId = appUser?.creatorId;

  const loadAnalytics = useCallback(async () => {
    if (!creatorId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const analytics = await getCreatorAnalytics(creatorId, range);
      setSummary(analytics.summary);
      setDaily(analytics.daily);
      setLinks(analytics.links);
    } catch {
      setError("Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [creatorId, range]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const clickThroughRate =
    summary.profileViews > 0
      ? (summary.linkClicks / summary.profileViews) * 100
      : 0;
  const chartMaximum = useMemo(
    () =>
      Math.max(
        1,
        ...daily.map((day) => Math.max(day.profileViews, day.linkClicks)),
      ),
    [daily],
  );

  if (appUser?.accountType !== "creator") {
    return <Navigate replace to="/dashboard" />;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Profile and link activity
          </p>
        </div>
        <button
          aria-label="Refresh analytics"
          className="grid h-10 w-10 place-items-center border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadAnalytics()}
          title="Refresh analytics"
          type="button"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 border border-zinc-300 bg-white p-1 sm:w-fit sm:grid-cols-4">
        {ranges.map((item) => (
          <button
            className={`px-4 py-2 text-sm font-medium ${
              range === item.value ? "bg-ink text-white" : "hover:bg-zinc-100"
            }`}
            key={item.label}
            onClick={() => setRange(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid border-y border-zinc-200 sm:grid-cols-3">
        <div className="py-5 sm:border-r sm:border-zinc-200 sm:pr-6">
          <p className="text-sm text-zinc-500">Profile views</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary.profileViews.toLocaleString()}
          </p>
        </div>
        <div className="border-t border-zinc-200 py-5 sm:border-r sm:border-t-0 sm:px-6">
          <p className="text-sm text-zinc-500">Link clicks</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary.linkClicks.toLocaleString()}
          </p>
        </div>
        <div className="border-t border-zinc-200 py-5 sm:border-t-0 sm:pl-6">
          <p className="text-sm text-zinc-500">Click-through rate</p>
          <p className="mt-2 text-3xl font-semibold">
            {clickThroughRate.toFixed(1)}%
          </p>
        </div>
      </div>

      <section className="mt-8 border-b border-zinc-200 pb-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Activity</h2>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-tribute" /> Views
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-coral" /> Clicks
            </span>
          </div>
        </div>

        {daily.length === 0 ? (
          <div className="mt-5 flex h-44 items-center justify-center border border-dashed border-zinc-300 text-sm text-zinc-500">
            No activity in this period.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <div
              className="flex h-44 min-w-[540px] items-end gap-1 border-b border-zinc-300"
              role="img"
              aria-label="Profile views and link clicks by day"
            >
              {daily.map((day) => (
                <div
                  className="flex h-full min-w-2 flex-1 items-end justify-center gap-px"
                  key={day.date}
                  title={`${day.date}: ${day.profileViews} views, ${day.linkClicks} clicks`}
                >
                  <span
                    className="w-1/2 min-w-1 bg-tribute"
                    style={{
                      height: `${Math.max(2, (day.profileViews / chartMaximum) * 100)}%`,
                    }}
                  />
                  <span
                    className="w-1/2 min-w-1 bg-coral"
                    style={{
                      height: `${Math.max(2, (day.linkClicks / chartMaximum) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex min-w-[540px] justify-between text-xs text-zinc-500">
              <span>{daily[0]?.date}</span>
              <span>{daily[daily.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Link performance</h2>
        {links.length === 0 ? (
          <div className="mt-5 flex items-center gap-2 py-6 text-sm text-zinc-500">
            <BarChart3 size={18} /> No link clicks yet.
          </div>
        ) : (
          <div className="mt-4 border-t border-zinc-200">
            {links.map((link) => (
              <div
                className="flex items-center justify-between gap-4 border-b border-zinc-200 py-4"
                key={link.id}
              >
                <span className="truncate font-medium">{link.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
                  <MousePointerClick size={15} />
                  {link.clicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
