import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type AuthMode = "login" | "signup";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const {
    appUser,
    createAccountWithEmail,
    loading,
    signInWithEmail,
    signInWithGoogle,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!loading && user) {
      navigate(appUser?.onboardingComplete ? "/dashboard" : "/onboarding", {
        replace: true,
      });
    }
  }, [appUser?.onboardingComplete, loading, navigate, user]);

  if (!loading && user) {
    return (
      <Navigate
        replace
        to={appUser?.onboardingComplete ? "/dashboard" : "/onboarding"}
      />
    );
  }

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignup) {
        await createAccountWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Auth failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const runGoogle = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Auth failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-md items-center px-4 py-10 sm:px-5">
      <div className="glass-panel w-full p-6 sm:p-8">
        <p className="eyebrow">tributes.bio</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>

        <div className="mt-7 grid gap-3">
        <button
          className="secondary-button w-full"
          disabled={submitting}
          onClick={() => void runGoogle()}
          type="button"
        >
          Continue with Google
        </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-sky/70" /> or <span className="h-px flex-1 bg-sky/70" />
        </div>

        <form className="grid gap-4" onSubmit={submitEmail}>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="field"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            className="field"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="status-error">{error}</p> : null}
        <button
          className="primary-button mt-1 w-full"
          disabled={submitting}
          type="submit"
        >
          {isSignup ? "Sign up" : "Log in"}
        </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          className="font-semibold text-ink underline decoration-zinc-300 underline-offset-4"
          to={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
        </p>
      </div>
    </section>
  );
}
