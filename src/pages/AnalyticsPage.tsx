import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ActivityChart, SERIES } from "../components/analytics/ActivityChart";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/ui";
import {
  getCreatorAnalytics,
  type AnalyticsRange,
} from "../lib/creatorAnalytics";
import type {
  AnalyticsSummary,
  DailyAnalytics,
  LinkAnalytics,
  ReferrerAnalytics,
} from "../lib/types";

const ranges: { label: string; value: AnalyticsRange }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "All time", value: "all" },
];

const emptySummary: AnalyticsSummary = {
  profileViews: 0,
  linkClicks: 0,
  earningsCents: 0,
  tipCount: 0,
  spinCount: 0,
  successfulPayments: 0,
  averageTipCents: 0,
  conversionRate: 0,
};

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Stat tile values compact rather than wrap: 1,284 · 12.9K · 1.4M */
function compact(value: number) {
  if (value < 10000) return value.toLocaleString();
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-caption text-content-muted">{label}</p>
      {/* Proportional figures: tabular digits make a large value look loose. */}
      <p className="mt-1.5 text-headline font-semibold text-content">{value}</p>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { key: string; cells: string[] }[];
}) {
  return (
    <div className="data-table-shell">
      <table className="w-full text-detail">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column, index) => (
              <th
                className={`px-4 py-2.5 font-medium text-content-muted ${
                  index === 0 ? "text-left" : "text-right"
                }`}
                key={column}
                scope="col"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-line last:border-0" key={row.key}>
              {row.cells.map((cell, index) => (
                <td
                  className={`px-4 py-2.5 ${
                    index === 0
                      ? "truncate font-medium text-content"
                      : "text-right text-content-muted [font-variant-numeric:tabular-nums]"
                  }`}
                  key={index}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsPage() {
  const { appUser } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [referrers, setReferrers] = useState<ReferrerAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (appUser?.accountType !== "creator") return;
    setLoading(true);
    setError(null);
    try {
      const analytics = await getCreatorAnalytics(range);
      setSummary(analytics.summary);
      setDaily(analytics.daily);
      setLinks(analytics.links);
      setReferrers(analytics.referrers);
    } catch {
      setError("Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [appUser?.accountType, range]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (appUser?.accountType !== "creator") {
    return <Navigate replace to="/dashboard" />;
  }

  const metrics = [
    { label: "Earnings", value: currency(summary.earningsCents) },
    { label: "Tips", value: compact(summary.tipCount) },
    { label: "Spins", value: compact(summary.spinCount) },
    { label: "Profile views", value: compact(summary.profileViews) },
    { label: "Link clicks", value: compact(summary.linkClicks) },
    { label: "Conversion", value: `${summary.conversionRate.toFixed(1)}%` },
  ];

  return (
    <section className="page-shell">
      <header className="page-header">
        <h1 className="page-title">Analytics</h1>
        <button
          aria-label="Refresh analytics"
          className="icon-button"
          disabled={loading}
          onClick={() => void loadAnalytics()}
          title="Refresh analytics"
          type="button"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
        </button>
      </header>

      {/* One filter row, above everything it scopes. */}
      <div className="segmented-control grid-cols-2 sm:w-fit sm:grid-cols-4">
        {ranges.map((item) => (
          <button
            className={`segmented-item ${
              range === item.value ? "segmented-item-active" : ""
            }`}
            key={item.label}
            onClick={() => setRange(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="status-error mt-5">{error}</p> : null}

      {/* Held at reduced opacity while refetching, so there is no skeleton flash
          and no layout jump. */}
      <div
        className={`transition-opacity duration-base ${
          loading ? "opacity-60" : "opacity-100"
        }`}
      >
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <StatTile key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        <section className="panel mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title font-semibold text-content">Activity</h2>
            <div className="flex items-center gap-4">
              {/* Legend is always present for two series — identity never rests
                  on color alone. */}
              <div className="flex items-center gap-4 text-caption text-content-muted">
                {SERIES.map((series) => (
                  <span className="flex items-center gap-1.5" key={series.key}>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    {series.label}
                  </span>
                ))}
              </div>
              <button
                className="text-caption font-medium text-accent hover:underline"
                onClick={() => setShowTable((current) => !current)}
                type="button"
              >
                {showTable ? "Show chart" : "Show table"}
              </button>
            </div>
          </div>

          {daily.length === 0 ? (
            <EmptyState
              className="mt-5"
              description="Views and clicks will appear here once people visit your page."
              title="No activity in this period"
            />
          ) : showTable ? (
            <div className="mt-5">
              <DataTable
                columns={["Day", "Profile views", "Link clicks"]}
                rows={daily.map((day) => ({
                  key: day.date,
                  cells: [
                    day.date,
                    day.profileViews.toLocaleString(),
                    day.linkClicks.toLocaleString(),
                  ],
                }))}
              />
            </div>
          ) : (
            <div className="mt-5">
              <ActivityChart daily={daily} />
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-title font-semibold text-content">Link performance</h2>
            {links.length === 0 ? (
              <EmptyState
                className="mt-5"
                description="Clicks on your links will be broken down here."
                title="No link clicks yet"
              />
            ) : (
              <div className="mt-5">
                <DataTable
                  columns={["Link", "Clicks", "CTR"]}
                  rows={links.map((link) => ({
                    key: link.id,
                    cells: [
                      link.title,
                      link.clicks.toLocaleString(),
                      `${link.clickThroughRate.toFixed(1)}%`,
                    ],
                  }))}
                />
              </div>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="text-title font-semibold text-content">Top referrers</h2>
            {referrers.length === 0 ? (
              <EmptyState
                className="mt-5"
                description="Where your visitors came from will show up here."
                title="No referrer data yet"
              />
            ) : (
              <div className="mt-5">
                <DataTable
                  columns={["Source", "Views", "Clicks"]}
                  rows={referrers.map((referrer) => ({
                    key: referrer.source,
                    cells: [
                      referrer.source,
                      referrer.views.toLocaleString(),
                      referrer.clicks.toLocaleString(),
                    ],
                  }))}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
