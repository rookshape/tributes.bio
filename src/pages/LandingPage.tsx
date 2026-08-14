import { Link } from "react-router-dom";
import { firebaseProjectId } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export function LandingPage() {
  const { appUser, user } = useAuth();

  return (
    <section className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-5xl content-center gap-8 px-5 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase text-tribute">
          Tributes Spin
        </p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">
          Paid spins and live counters for streamers.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-700">
          Create a creator account, claim a username, and start configuring the
          Twitch spinner MVP.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Link
              className="bg-ink px-5 py-3 font-semibold text-white"
              to={appUser?.onboardingComplete ? "/dashboard" : "/onboarding"}
            >
              {appUser?.onboardingComplete
                ? "Open dashboard"
                : "Continue setup"}
            </Link>
          ) : (
            <>
              <Link
                className="bg-ink px-5 py-3 font-semibold text-white"
                to="/signup"
              >
                Create account
              </Link>
              <Link
                className="border border-zinc-300 px-5 py-3 font-semibold"
                to="/login"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-zinc-500">Firebase: {firebaseProjectId}</p>
    </section>
  );
}
