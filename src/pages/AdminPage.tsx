import {
  ClipboardList,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  changeCreatorUsername,
  checkAdminAccess,
  getAdminOverview,
  resolveContentReport,
  searchAdminRecords,
  setAdminUserDisabled,
  setCreatorModerationStatus,
  type AdminCreator,
  type AdminOverview,
  type AdminReport,
  type AdminSearchResult,
} from "../lib/admin";

type AdminTab = "overview" | "lookup" | "reports" | "payments" | "audit";

const fieldClass =
  "field py-2.5";

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function dateTime(value: number | null) {
  return value ? new Date(value).toLocaleString() : "Pending";
}

export function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AdminSearchResult | null>(null);
  const [reason, setReason] = useState("");
  const [username, setUsername] = useState("");
  const [moderationStatus, setModerationStatus] = useState<AdminCreator["moderationStatus"]>("active");
  const [reportDrafts, setReportDrafts] = useState<Record<string, { status: AdminReport["status"]; resolution: string }>>({});
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      setOverview(await getAdminOverview());
    } catch {
      setError("Could not load admin data.");
    } finally {
      setWorking(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    checkAdminAccess()
      .then(async (allowed) => {
        if (!active) return;
        setAuthorized(allowed);
        if (allowed) await loadOverview();
      })
      .catch(() => {
        if (active) setAuthorized(false);
      });
    return () => { active = false; };
  }, [loadOverview]);

  useEffect(() => {
    if (!overview) return;
    setReportDrafts(Object.fromEntries(overview.reports.map((report) => [
      report.id,
      { status: report.status, resolution: report.resolution },
    ])));
  }, [overview]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const next = await searchAdminRecords(query);
      setResult(next);
      setUsername(next.creator?.username ?? "");
      setModerationStatus(next.creator?.moderationStatus ?? "active");
    } catch {
      setError("No matching records found.");
      setResult(null);
    } finally {
      setWorking(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    if (!reason.trim()) {
      setError("Enter a reason for this action.");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await loadOverview();
      if (query) {
        const next = await searchAdminRecords(query);
        setResult(next);
      }
    } catch {
      setError("The admin action could not be completed.");
    } finally {
      setWorking(false);
    }
  };

  const updateReport = async (reportId: string) => {
    const draft = reportDrafts[reportId];
    if (!draft?.resolution.trim()) {
      setError("Enter a resolution note.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await resolveContentReport(reportId, draft.status, draft.resolution);
      setMessage("Report updated.");
      await loadOverview();
    } catch {
      setError("Could not update the report.");
    } finally {
      setWorking(false);
    }
  };

  const openReports = useMemo(
    () => overview?.reports.filter((report) => report.status === "open" || report.status === "review") ?? [],
    [overview],
  );

  if (authorized === null) {
    return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin" size={24} /></div>;
  }
  if (!authorized) {
    return <section className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-semibold">Admin access required</h1></section>;
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "lookup", label: "Lookup" },
    { id: "reports", label: `Reports${openReports.length ? ` (${openReports.length})` : ""}` },
    { id: "payments", label: "Payments" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <section className="page-shell">
      <div className="page-header border-b liquid-divider">
        <div>
          <h1 className="page-title flex items-center gap-2"><ShieldCheck size={22} /> Admin</h1>
          <p className="page-subtitle">Operations and moderation</p>
        </div>
        <button aria-label="Refresh admin data" className="icon-button" disabled={working} onClick={() => void loadOverview()} title="Refresh" type="button"><RefreshCw className={working ? "animate-spin" : ""} size={17} /></button>
      </div>

      <div className="segmented-control mt-6 flex w-fit max-w-full overflow-x-auto">
        {tabs.map((item) => <button className={`segmented-item shrink-0 ${tab === item.id ? "segmented-item-active" : ""}`} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
      </div>

      {error ? <p className="status-error mt-5">{error}</p> : null}
      {message ? <p className="status-success mt-5">{message}</p> : null}

      {tab === "overview" && overview ? (
        <div>
          <div className="glass-panel mt-6 grid overflow-hidden sm:grid-cols-4">
            {[
              ["Users", overview.counts.users, UsersRound],
              ["Creators", overview.counts.creators, UserRoundSearch],
              ["Payments", overview.counts.payments, CreditCard],
              ["Open reports", overview.counts.openReports, ClipboardList],
            ].map(([label, value, Icon], index) => {
              const MetricIcon = Icon as typeof UsersRound;
              return <div className={`p-5 ${index ? "border-t border-sky/50 sm:border-l sm:border-t-0" : ""}`} key={String(label)}><p className="flex items-center gap-2 text-sm text-zinc-500"><MetricIcon size={15} /> {String(label)}</p><p className="mt-2 text-3xl font-semibold">{Number(value).toLocaleString()}</p></div>;
            })}
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <section><h2 className="font-semibold">Recent users</h2><div className="mt-4 border-t border-zinc-200">{overview.users.slice(0, 8).map((user) => <button className="flex w-full items-center justify-between gap-4 border-b border-zinc-200 py-4 text-left" key={user.uid} onClick={() => { setQuery(user.uid); setTab("lookup"); }} type="button"><span className="min-w-0"><span className="block truncate font-medium">{user.displayName || user.email || user.uid}</span><span className="block truncate text-xs text-zinc-500">{user.email}</span></span><span className="text-xs capitalize text-zinc-500">{user.accountType ?? "new"}</span></button>)}</div></section>
            <section><h2 className="font-semibold">Recent creators</h2><div className="mt-4 border-t border-zinc-200">{overview.creators.slice(0, 8).map((creator) => <button className="flex w-full items-center justify-between gap-4 border-b border-zinc-200 py-4 text-left" key={creator.id} onClick={() => { setQuery(creator.username); setTab("lookup"); }} type="button"><span className="min-w-0"><span className="block truncate font-medium">{creator.displayName}</span><span className="block text-xs text-zinc-500">@{creator.username}</span></span><span className="text-xs capitalize text-zinc-500">{creator.moderationStatus}</span></button>)}</div></section>
          </div>
        </div>
      ) : null}

      {tab === "lookup" ? (
        <div className="py-6">
          <form className="flex max-w-2xl gap-2" onSubmit={search}><input aria-label="Search users, creators, or payments" className={fieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Email, UID, username, payment ID" value={query} /><button aria-label="Search" className="icon-button border-ink bg-ink text-white" disabled={working} title="Search" type="submit"><Search size={18} /></button></form>
          {result ? (
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <section>
                <h2 className="font-semibold">Account</h2>
                {result.user ? <div className="mt-4 border-y border-zinc-200 py-5 text-sm"><p className="font-medium">{result.user.displayName || result.user.email}</p><p className="mt-1 text-zinc-500">{result.user.email}</p><p className="mt-1 break-all text-xs text-zinc-500">{result.user.uid}</p><p className="mt-3 capitalize">{result.user.disabled ? "Disabled" : result.user.accountStatus}</p><button className={`mt-5 px-4 py-2.5 text-sm font-semibold text-white ${result.user.disabled ? "bg-tribute" : "bg-red-600"}`} disabled={working} onClick={() => void runAction(() => setAdminUserDisabled(result.user!.uid, !result.user!.disabled, reason), result.user!.disabled ? "Account enabled." : "Account disabled.")} type="button">{result.user.disabled ? "Enable account" : "Disable account"}</button></div> : <p className="mt-4 text-sm text-zinc-500">No account match.</p>}
              </section>
              <section>
                <h2 className="font-semibold">Creator</h2>
                {result.creator ? <div className="mt-4 border-y border-zinc-200 py-5 text-sm"><p className="font-medium">{result.creator.displayName}</p><p className="mt-1 text-zinc-500">@{result.creator.username}</p><p className="mt-1">Payouts: <span className="capitalize">{result.creator.stripeOnboardingStatus}</span></p><label className="mt-5 grid gap-1.5 font-medium">Username<input className={fieldClass} onChange={(event) => setUsername(event.target.value)} value={username} /></label><button className="mt-2 bg-ink px-4 py-2.5 text-sm font-semibold text-white" disabled={working} onClick={() => void runAction(() => changeCreatorUsername(result.creator!.id, username, reason), "Username changed.")} type="button">Change username</button><label className="mt-5 grid gap-1.5 font-medium">Profile status<select className={fieldClass} onChange={(event) => setModerationStatus(event.target.value as AdminCreator["moderationStatus"])} value={moderationStatus}><option value="active">Active</option><option value="review">Review</option><option value="suspended">Suspended</option></select></label><button className="mt-2 bg-ink px-4 py-2.5 text-sm font-semibold text-white" disabled={working} onClick={() => void runAction(() => setCreatorModerationStatus(result.creator!.id, moderationStatus, reason), "Profile status updated.")} type="button">Update status</button></div> : <p className="mt-4 text-sm text-zinc-500">No creator match.</p>}
              </section>
              <label className="grid gap-1.5 text-sm font-medium lg:col-span-2">Reason for admin action<textarea className={`${fieldClass} min-h-20 resize-y`} maxLength={300} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
              <section className="lg:col-span-2"><h2 className="font-semibold">Related payments</h2><PaymentTable payments={result.payments} /></section>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "reports" && overview ? (
        <div className="py-6"><h2 className="font-semibold">Moderation queue</h2>{overview.reports.length === 0 ? <p className="py-10 text-sm text-zinc-500">No reports.</p> : <div className="mt-4 border-t border-zinc-200">{overview.reports.map((report) => { const draft = reportDrafts[report.id] ?? { status: report.status, resolution: report.resolution }; return <section className="border-b border-zinc-200 py-5" key={report.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium">{report.targetLabel}</p><p className="mt-1 text-sm capitalize text-zinc-500">{report.category.replaceAll("_", " ")} · {dateTime(report.createdAtMs)}</p></div><span className="text-xs font-medium uppercase text-zinc-500">{report.status}</span></div>{report.details ? <p className="mt-3 max-w-3xl text-sm">{report.details}</p> : null}<div className="mt-4 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]"><select className={fieldClass} onChange={(event) => setReportDrafts((current) => ({ ...current, [report.id]: { ...draft, status: event.target.value as AdminReport["status"] } }))} value={draft.status}><option value="open">Open</option><option value="review">Review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select><input className={fieldClass} onChange={(event) => setReportDrafts((current) => ({ ...current, [report.id]: { ...draft, resolution: event.target.value } }))} placeholder="Resolution note" value={draft.resolution} /><button className="bg-ink px-4 py-2.5 text-sm font-semibold text-white" disabled={working} onClick={() => void updateReport(report.id)} type="button">Update</button></div></section>; })}</div>}</div>
      ) : null}

      {tab === "payments" && overview ? <section className="py-6"><h2 className="font-semibold">Recent payments</h2><PaymentTable payments={overview.payments} /></section> : null}
      {tab === "audit" && overview ? <section className="py-6"><h2 className="font-semibold">Admin audit trail</h2><div className="mt-4 border-t border-zinc-200">{overview.audits.map((audit) => <div className="grid gap-1 border-b border-zinc-200 py-4 text-sm sm:grid-cols-[180px_180px_minmax(0,1fr)]" key={audit.id}><span className="font-medium">{audit.action}</span><span className="truncate text-zinc-500">{audit.targetType}: {audit.targetId}</span><span className="text-zinc-500">{audit.reason} · {dateTime(audit.createdAtMs)}</span></div>)}</div></section> : null}
    </section>
  );
}

function PaymentTable({ payments }: { payments: AdminSearchResult["payments"] }) {
  if (payments.length === 0) return <p className="py-10 text-sm text-zinc-500">No payments.</p>;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="py-3 pr-4 font-medium">Payment</th><th className="px-4 py-3 font-medium">Creator</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th><th className="py-3 pl-4 text-right font-medium">Amount</th></tr></thead><tbody>{payments.map((payment) => <tr className="border-b border-zinc-100" key={payment.id}><td className="py-4 pr-4 font-mono text-xs">{payment.id}</td><td className="px-4 py-4 font-mono text-xs">{payment.creatorId}</td><td className="px-4 py-4 capitalize">{payment.kind}</td><td className="px-4 py-4 capitalize">{payment.status.replaceAll("_", " ")}</td><td className="px-4 py-4 text-zinc-500">{dateTime(payment.createdAtMs)}</td><td className="py-4 pl-4 text-right font-semibold">{currency(payment.totalCents)}</td></tr>)}</tbody></table></div>;
}
