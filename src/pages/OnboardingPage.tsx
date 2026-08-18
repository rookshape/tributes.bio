import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, UserRound, WandSparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  completePersonalOnboarding,
  reserveCreatorUsername,
  suggestUsername,
  validateUsername,
} from "../lib/account";
import type { AccountType } from "../lib/types";

export function OnboardingPage() {
  const { appUser, loading, refreshAppUser, user } = useAuth();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>("creator");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const usernameError = useMemo(
    () => (accountType === "creator" ? validateUsername(username) : null),
    [accountType, username],
  );

  useEffect(() => {
    if (user && !username) {
      setUsername(suggestUsername(user));
    }
  }, [user, username]);

  if (!loading && !user) {
    return <Navigate replace to="/login" />;
  }

  if (!loading && appUser?.onboardingComplete) {
    return <Navigate replace to="/dashboard" />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (accountType === "creator" && usernameError) {
      setError(usernameError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (accountType === "personal") {
        await completePersonalOnboarding(user);
      } else {
        await reserveCreatorUsername(user, username);
      }

      await refreshAppUser();
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not finish onboarding.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-2xl items-center px-4 py-10 sm:px-5">
      <div className="glass-panel w-full p-6 sm:p-9">
        <p className="eyebrow">One quick step</p>
        <h1 className="mt-3 text-3xl font-semibold">Choose how you will use Tributes</h1>
        <form className="mt-8 grid gap-7" onSubmit={submit}>
        <fieldset className="grid gap-3">
          <legend className="sr-only">Account type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["creator", "personal"] as AccountType[]).map((type) => (
              <label
                className={`relative cursor-pointer rounded-lg border p-5 transition ${
                  accountType === type
                    ? "border-tribute/60 bg-mist shadow-sm"
                    : "border-sky/60 bg-white/60 hover:bg-white"
                }`}
                key={type}
              >
                <input
                  checked={accountType === type}
                  className="sr-only"
                  name="accountType"
                  onChange={() => setAccountType(type)}
                  type="radio"
                />
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-tribute shadow-sm">
                    {type === "creator" ? <WandSparkles size={19} /> : <UserRound size={19} />}
                  </span>
                  <span>
                    <span className="block font-semibold capitalize">{type}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                      {type === "creator" ? "Publish links and receive tributes" : "Track your support"}
                    </span>
                  </span>
                </span>
                {accountType === type ? <Check className="absolute right-4 top-4 text-tribute" size={17} /> : null}
              </label>
            ))}
          </div>
        </fieldset>

        {accountType === "creator" ? (
          <label className="grid gap-2 text-sm font-medium">
            Username
            <div className="flex overflow-hidden rounded-2xl border border-sky/80 bg-white/75 focus-within:ring-4 focus-within:ring-sky/40">
              <span className="border-r border-sky/70 px-3 py-3 text-zinc-400">
                tributes.bio/
              </span>
              <input
                className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </div>
            {usernameError ? (
              <span className="text-sm text-zinc-500">{usernameError}</span>
            ) : null}
          </label>
        ) : null}

        {error ? <p className="status-error">{error}</p> : null}
        <button
          className="primary-button w-full"
          disabled={submitting}
          type="submit"
        >
          Continue
        </button>
        </form>
      </div>
    </section>
  );
}
