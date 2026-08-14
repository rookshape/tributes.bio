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
    <section className="mx-auto w-full max-w-md px-5 py-14">
      <h1 className="text-3xl font-semibold">
        {isSignup ? "Create account" : "Log in"}
      </h1>

      <div className="mt-6 grid gap-3">
        <button
          className="border border-zinc-300 bg-white px-4 py-3 font-semibold"
          disabled={submitting}
          onClick={() => void runGoogle()}
          type="button"
        >
          Continue with Google
        </button>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={submitEmail}>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="border border-zinc-300 bg-white px-3 py-3"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            className="border border-zinc-300 bg-white px-3 py-3"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {isSignup ? "Sign up" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          className="font-semibold text-tribute"
          to={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </section>
  );
}
