import { ArrowLeft, MailCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authErrorMessage } from "../lib/authErrors";
import { Button, Input, StatusMessage } from "../components/ui";

type AuthMode = "login" | "signup";
/** `reset` is entered from the login form rather than routed to separately. */
type Screen = AuthMode | "reset";

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 18 18" width="16">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const {
    appUser,
    createAccountWithEmail,
    loading,
    sendPasswordResetTo,
    signInWithEmail,
    signInWithGoogle,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = screen === "signup";
  const destination = appUser?.onboardingComplete ? "/dashboard" : "/onboarding";

  // Route changes between /login and /signup swap the form without remounting.
  useEffect(() => {
    setScreen(mode);
    setError(null);
    setResetSent(false);
  }, [mode]);

  useEffect(() => {
    if (!loading && user) navigate(destination, { replace: true });
  }, [destination, loading, navigate, user]);

  if (!loading && user) return <Navigate replace to={destination} />;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setSubmitting(true);
    try {
      await action();
    } catch (caughtError) {
      setError(authErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (screen === "reset") {
      return void run(async () => {
        await sendPasswordResetTo(email);
        setResetSent(true);
      });
    }

    return void run(() =>
      isSignup
        ? createAccountWithEmail(email, password)
        : signInWithEmail(email, password),
    );
  };

  const heading =
    screen === "reset"
      ? "Reset your password"
      : isSignup
        ? "Create your account"
        : "Welcome back";

  return (
    <section className="mx-auto flex min-h-[calc(100svh-56px)] w-full max-w-md items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <h1 className="text-headline font-semibold text-content">{heading}</h1>
        <p className="mt-1.5 text-body text-content-muted">
          {screen === "reset"
            ? "We will email you a link to choose a new one."
            : isSignup
              ? "One page for your links, tips, and live spins."
              : "Log in to your Tributes dashboard."}
        </p>

        {screen === "reset" && resetSent ? (
          <div className="panel mt-7 p-5 text-center">
            <MailCheck className="mx-auto text-positive" size={28} />
            <p className="mt-3 text-body font-medium text-content">Check your inbox</p>
            <p className="mt-1 text-detail text-content-muted">
              If an account uses {email}, a reset link is on its way.
            </p>
            <Button
              className="mt-5"
              block
              iconLeft={<ArrowLeft size={16} />}
              onClick={() => {
                setScreen("login");
                setResetSent(false);
              }}
              variant="secondary"
            >
              Back to log in
            </Button>
          </div>
        ) : (
          <>
            {screen !== "reset" ? (
              <>
                <Button
                  block
                  className="mt-7"
                  disabled={submitting}
                  iconLeft={<GoogleMark />}
                  onClick={() => void run(signInWithGoogle)}
                  variant="secondary"
                >
                  Continue with Google
                </Button>

                <div className="my-6 flex items-center gap-3 text-caption text-content-subtle">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            ) : null}

            <form
              className={`grid gap-4 ${screen === "reset" ? "mt-7" : ""}`}
              onSubmit={submit}
            >
              <Input
                autoComplete="email"
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />

              {screen !== "reset" ? (
                <Input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  hint={isSignup ? "At least 6 characters." : undefined}
                  label="Password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  trailing={
                    isSignup ? undefined : (
                      <button
                        className="font-medium text-accent hover:underline"
                        onClick={() => {
                          setScreen("reset");
                          setError(null);
                        }}
                        type="button"
                      >
                        Forgot password?
                      </button>
                    )
                  }
                  type="password"
                  value={password}
                />
              ) : null}

              <StatusMessage tone="error">{error}</StatusMessage>

              <Button block loading={submitting} type="submit" variant="accent">
                {screen === "reset"
                  ? "Send reset link"
                  : isSignup
                    ? "Create account"
                    : "Log in"}
              </Button>
            </form>

            {screen === "reset" ? (
              <Button
                block
                className="mt-4"
                iconLeft={<ArrowLeft size={16} />}
                onClick={() => setScreen("login")}
                variant="ghost"
              >
                Back to log in
              </Button>
            ) : (
              <p className="mt-6 text-center text-detail text-content-muted">
                {isSignup ? "Already have an account?" : "Need an account?"}{" "}
                <Link
                  className="font-medium text-accent hover:underline"
                  to={isSignup ? "/login" : "/signup"}
                >
                  {isSignup ? "Log in" : "Sign up"}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
