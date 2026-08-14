import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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
    <section className="mx-auto w-full max-w-xl px-5 py-14">
      <h1 className="text-3xl font-semibold">Set up your account</h1>
      <form className="mt-8 grid gap-6" onSubmit={submit}>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Account type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["creator", "personal"] as AccountType[]).map((type) => (
              <label
                className={`border p-4 ${
                  accountType === type
                    ? "border-tribute bg-emerald-50"
                    : "border-zinc-300 bg-white"
                }`}
                key={type}
              >
                <input
                  checked={accountType === type}
                  className="mr-2"
                  name="accountType"
                  onChange={() => setAccountType(type)}
                  type="radio"
                />
                <span className="capitalize">{type}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {accountType === "creator" ? (
          <label className="grid gap-2 text-sm font-medium">
            Username
            <div className="flex border border-zinc-300 bg-white">
              <span className="border-r border-zinc-300 px-3 py-3 text-zinc-500">
                tributes.bio/
              </span>
              <input
                className="min-w-0 flex-1 px-3 py-3 outline-none"
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
