import {
  CreditCard,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateEmailPreferences } from "../lib/account";
import {
  openStripeDashboard,
  refreshStripeConnectStatus,
  startStripeConnectOnboarding,
  type StripeConnectStatus,
} from "../lib/payments";
import type { EmailPreferences } from "../lib/types";

export function SettingsPage() {
  const {
    appUser,
    refreshAppUser,
    sendPasswordReset,
    signOut,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<EmailPreferences>({
    paymentActivity: true,
    productUpdates: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] =
    useState<StripeConnectStatus>("not_started");
  const [connectLoading, setConnectLoading] = useState(false);
  const hasPassword = user?.providerData.some(
    (provider) => provider.providerId === "password",
  );

  useEffect(() => {
    if (appUser) {
      setPreferences(appUser.emailPreferences);
    }
  }, [appUser]);

  useEffect(() => {
    if (appUser?.accountType !== "creator") {
      return;
    }

    let active = true;
    setConnectLoading(true);
    refreshStripeConnectStatus()
      .then((status) => {
        if (active) {
          setConnectStatus(status);
        }
      })
      .catch(() => {
        if (active) {
          setError("Could not load payout status.");
        }
      })
      .finally(() => {
        if (active) {
          setConnectLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [appUser?.accountType]);

  const openConnect = async () => {
    setConnectLoading(true);
    setError(null);

    try {
      const url =
        connectStatus === "active"
          ? await openStripeDashboard()
          : await startStripeConnectOnboarding();
      window.location.assign(url);
    } catch {
      setError("Could not open Stripe. Please try again.");
      setConnectLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await updateEmailPreferences(user.uid, preferences);
      await refreshAppUser();
      setMessage("Email preferences saved.");
    } catch {
      setError("Could not save email preferences.");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await sendPasswordReset();
      setMessage("Password reset email sent.");
    } catch {
      setError("Could not send a password reset email.");
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Account and notifications</p>
      </div>

      {message ? (
        <div className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="border-b border-zinc-200 py-7">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="mt-1 break-all font-medium">{appUser?.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Account type</dt>
            <dd className="mt-1 font-medium capitalize">
              {appUser?.accountType}
            </dd>
          </div>
        </dl>

        {appUser?.accountType === "creator" && appUser.username ? (
          <Link
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-tribute"
            target="_blank"
            to={`/${appUser.username}`}
          >
            Open public page <ExternalLink size={15} />
          </Link>
        ) : null}
      </section>

      {appUser?.accountType === "creator" ? (
        <section className="border-b border-zinc-200 py-7">
          <div className="flex items-center gap-2">
            <CreditCard size={18} />
            <h2 className="font-semibold">Payouts</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            {connectStatus === "active"
              ? "Ready to receive tributes."
              : connectStatus === "pending"
                ? "Stripe is reviewing your information."
                : connectStatus === "restricted"
                  ? "Stripe needs updated information."
                  : "Connect Stripe to receive tributes."}
          </p>
          <button
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={connectLoading}
            onClick={() => void openConnect()}
            type="button"
          >
            {connectLoading ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : connectStatus === "active" ? (
              <>
                Open Stripe <ExternalLink size={15} />
              </>
            ) : connectStatus === "not_started" ? (
              "Set up payouts"
            ) : (
              "Continue setup"
            )}
          </button>
        </section>
      ) : null}

      <section className="border-b border-zinc-200 py-7">
        <div className="flex items-center gap-2">
          <Mail size={18} />
          <h2 className="font-semibold">Email notifications</h2>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="flex items-start justify-between gap-5">
            <span>
              <span className="block text-sm font-medium">Payment activity</span>
              <span className="mt-1 block text-sm text-zinc-500">
                Tips, refunds, disputes, and payout updates
              </span>
            </span>
            <input
              checked={preferences.paymentActivity}
              className="mt-1 h-4 w-4 shrink-0 accent-tribute"
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  paymentActivity: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-start justify-between gap-5 border-t border-zinc-100 pt-4">
            <span>
              <span className="block text-sm font-medium">Product updates</span>
              <span className="mt-1 block text-sm text-zinc-500">
                New features and service announcements
              </span>
            </span>
            <input
              checked={preferences.productUpdates}
              className="mt-1 h-4 w-4 shrink-0 accent-tribute"
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  productUpdates: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
        </div>
        <button
          className="mt-5 bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
          onClick={() => void savePreferences()}
          type="button"
        >
          Save preferences
        </button>
      </section>

      {hasPassword ? (
        <section className="border-b border-zinc-200 py-7">
          <div className="flex items-center gap-2">
            <KeyRound size={18} />
            <h2 className="font-semibold">Password</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Send a secure password-reset link to {appUser?.email}.
          </p>
          <button
            className="mt-4 border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
            disabled={saving}
            onClick={() => void resetPassword()}
            type="button"
          >
            Send reset email
          </button>
        </section>
      ) : null}

      <section className="py-7">
        <button
          className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50"
          onClick={() => void logOut()}
          type="button"
        >
          <LogOut size={17} /> Sign out
        </button>
      </section>
    </section>
  );
}
