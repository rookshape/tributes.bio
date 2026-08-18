import {
  CreditCard,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  MailCheck,
  RadioTower,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateEmailPreferences } from "../lib/account";
import {
  openStripeDashboard,
  refreshStripeConnectStatus,
  startStripeConnectOnboarding,
  type StripeConnectStatus,
} from "../lib/payments";
import type { EmailPreferences } from "../lib/types";
import {
  disconnectTwitch,
  getTwitchConnection,
  startTwitchConnection,
  updateTwitchSettings,
  type TwitchConnection,
  type TwitchSettings,
} from "../lib/twitch";

export function SettingsPage() {
  const {
    appUser,
    refreshAppUser,
    sendPasswordReset,
    sendVerificationEmail,
    signOut,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [twitchConnection, setTwitchConnection] =
    useState<TwitchConnection | null>(null);
  const [twitchSettings, setTwitchSettings] = useState<TwitchSettings>({
    autoLiveEnabled: true,
    bitsCounterEnabled: false,
    showBitsAlerts: false,
  });
  const [twitchLoading, setTwitchLoading] = useState(false);
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

  useEffect(() => {
    const twitchResult = searchParams.get("twitch");
    if (!twitchResult) return;

    if (twitchResult === "connected") {
      setMessage("Twitch connected.");
    } else {
      setError(searchParams.get("reason") ?? "Could not connect Twitch.");
    }

    const next = new URLSearchParams(searchParams);
    next.delete("twitch");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (appUser?.accountType !== "creator") return;

    let active = true;
    setTwitchLoading(true);
    getTwitchConnection()
      .then((connection) => {
        if (!active) return;
        setTwitchConnection(connection);
        setTwitchSettings({
          autoLiveEnabled: connection.autoLiveEnabled,
          bitsCounterEnabled: connection.bitsCounterEnabled,
          showBitsAlerts: connection.showBitsAlerts,
        });
      })
      .catch(() => {
        if (active) setError("Could not load Twitch status.");
      })
      .finally(() => {
        if (active) setTwitchLoading(false);
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

  const connectTwitch = async () => {
    setTwitchLoading(true);
    setError(null);
    try {
      window.location.assign(await startTwitchConnection());
    } catch {
      setError("Could not open Twitch. Please try again.");
      setTwitchLoading(false);
    }
  };

  const saveTwitchSettings = async () => {
    setTwitchLoading(true);
    setMessage(null);
    setError(null);
    try {
      const next = await updateTwitchSettings(twitchSettings);
      setTwitchSettings(next);
      setTwitchConnection((current) =>
        current ? { ...current, ...next } : current,
      );
      setMessage("Twitch settings saved.");
    } catch {
      setError("Could not save Twitch settings.");
    } finally {
      setTwitchLoading(false);
    }
  };

  const removeTwitch = async () => {
    setTwitchLoading(true);
    setMessage(null);
    setError(null);
    try {
      await disconnectTwitch();
      setTwitchConnection(null);
      setMessage("Twitch disconnected.");
    } catch {
      setError("Could not disconnect Twitch.");
    } finally {
      setTwitchLoading(false);
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

  const verifyEmail = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await sendVerificationEmail();
      setMessage("Verification email sent.");
    } catch {
      setError("Could not send a verification email.");
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <section className="page-shell max-w-3xl">
      <div className="page-header border-b border-line">
        <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account and notifications</p>
        </div>
      </div>

      {message ? (
        <div className="status-success mt-5">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="status-error mt-5">
          {error}
        </div>
      ) : null}

      <section className="panel mt-6 p-5 sm:p-6">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-content-muted">Email</dt>
            <dd className="mt-1 break-all font-medium">{appUser?.email}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Account type</dt>
            <dd className="mt-1 font-medium capitalize">
              {appUser?.accountType}
            </dd>
          </div>
        </dl>

        {appUser?.accountType === "creator" && appUser.username ? (
          <Link
            className="secondary-button mt-5 min-h-10"
            target="_blank"
            to={`/${appUser.username}`}
          >
            Open public page <ExternalLink size={15} />
          </Link>
        ) : null}
        {user && !user.emailVerified && hasPassword ? (
          <button
            className="secondary-button mt-5 min-h-10 sm:ml-2"
            disabled={saving}
            onClick={() => void verifyEmail()}
            type="button"
          >
            <MailCheck size={15} /> Verify email
          </button>
        ) : null}
      </section>

      {appUser?.accountType === "creator" ? (
        <section className="panel mt-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CreditCard size={18} />
            <h2 className="font-semibold">Payouts</h2>
          </div>
          <p className="mt-2 text-sm text-content-muted">
            {connectStatus === "active"
              ? "Ready to receive tributes."
              : connectStatus === "pending"
                ? "Stripe is reviewing your information."
                : connectStatus === "restricted"
                  ? "Stripe needs updated information."
                  : "Connect Stripe to receive tributes."}
          </p>
          <button
            className="primary-button mt-4 min-h-10"
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

      {appUser?.accountType === "creator" ? (
        <section className="panel mt-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <RadioTower size={18} />
            <h2 className="font-semibold">Twitch</h2>
          </div>

          {twitchConnection?.connected ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                {twitchConnection.broadcasterProfileImageUrl ? (
                  <img
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                    src={twitchConnection.broadcasterProfileImageUrl}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {twitchConnection.broadcasterDisplayName}
                  </p>
                  <p className="text-xs text-content-muted">
                    {twitchConnection.isLive ? "Live on Twitch" : "Connected"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-content-muted">
                {twitchConnection.subscriptions["stream.online"]?.status === "enabled" &&
                twitchConnection.subscriptions["stream.offline"]?.status === "enabled"
                  ? "Stream events ready"
                  : "Stream events pending"}
                {twitchConnection.subscriptions["channel.cheer"]?.status === "enabled"
                  ? " | Bits events ready"
                  : " | Bits events pending"}
              </p>

              <div className="panel-flat mt-5 grid gap-4 p-4">
                <label className="flex items-start justify-between gap-5">
                  <span>
                    <span className="block text-sm font-medium">Sync live status</span>
                    <span className="mt-1 block text-sm text-content-muted">
                      Open and close Spin with your Twitch stream
                    </span>
                  </span>
                  <input
                    checked={twitchSettings.autoLiveEnabled}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    onChange={(event) =>
                      setTwitchSettings({
                        ...twitchSettings,
                        autoLiveEnabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="flex items-start justify-between gap-5 border-t border-line pt-4">
                  <span>
                    <span className="block text-sm font-medium">Add Bits to counter</span>
                    <span className="mt-1 block text-sm text-content-muted">
                      Count one cent per Bit
                    </span>
                  </span>
                  <input
                    checked={twitchSettings.bitsCounterEnabled}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    onChange={(event) =>
                      setTwitchSettings({
                        ...twitchSettings,
                        bitsCounterEnabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="flex items-start justify-between gap-5 border-t border-line pt-4">
                  <span>
                    <span className="block text-sm font-medium">Show Bits alerts</span>
                    <span className="mt-1 block text-sm text-content-muted">
                      Show the name and Bits amount on the overlay
                    </span>
                  </span>
                  <input
                    checked={twitchSettings.showBitsAlerts}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    onChange={(event) =>
                      setTwitchSettings({
                        ...twitchSettings,
                        showBitsAlerts: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="primary-button min-h-10"
                  disabled={twitchLoading}
                  onClick={() => void saveTwitchSettings()}
                  type="button"
                >
                  Save Twitch settings
                </button>
                <button
                  className="secondary-button min-h-10"
                  disabled={twitchLoading}
                  onClick={() => void removeTwitch()}
                  type="button"
                >
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-content-muted">
                {twitchConnection?.status === "reconnect_required"
                  ? "Reconnect Twitch to resume stream events."
                  : "Connect your channel for live status and Bits."}
              </p>
              <button
                className="primary-button mt-4 min-h-10"
                disabled={twitchLoading}
                onClick={() => void connectTwitch()}
                type="button"
              >
                {twitchLoading ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <RadioTower size={17} />
                )}
                {twitchConnection?.status === "reconnect_required"
                  ? "Reconnect Twitch"
                  : "Connect Twitch"}
              </button>
            </>
          )}
        </section>
      ) : null}

      <section className="panel mt-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Mail size={18} />
          <h2 className="font-semibold">Email notifications</h2>
        </div>
        <div className="panel-flat mt-5 grid gap-4 p-4">
          <label className="flex items-start justify-between gap-5">
            <span>
              <span className="block text-sm font-medium">Payment activity</span>
              <span className="mt-1 block text-sm text-content-muted">
                Tips, refunds, disputes, and payout updates
              </span>
            </span>
            <input
              checked={preferences.paymentActivity}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  paymentActivity: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-start justify-between gap-5 border-t border-line pt-4">
            <span>
              <span className="block text-sm font-medium">Product updates</span>
              <span className="mt-1 block text-sm text-content-muted">
                New features and service announcements
              </span>
            </span>
            <input
              checked={preferences.productUpdates}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
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
          className="primary-button mt-5 min-h-10"
          disabled={saving}
          onClick={() => void savePreferences()}
          type="button"
        >
          Save preferences
        </button>
      </section>

      {hasPassword ? (
        <section className="panel mt-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <KeyRound size={18} />
            <h2 className="font-semibold">Password</h2>
          </div>
          <p className="mt-2 text-sm text-content-muted">
            Send a secure password-reset link to {appUser?.email}.
          </p>
          <button
            className="secondary-button mt-4 min-h-10"
            disabled={saving}
            onClick={() => void resetPassword()}
            type="button"
          >
            Send reset email
          </button>
        </section>
      ) : null}

      <section className="py-6">
        <button
          className="secondary-button min-h-10"
          onClick={() => void logOut()}
          type="button"
        >
          <LogOut size={17} /> Sign out
        </button>
      </section>
    </section>
  );
}
