import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout() {
  const { appUser, signOut, user } = useAuth();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Link className="font-semibold" to="/">
            tributes.bio
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                {appUser?.onboardingComplete ? (
                  <Link className="text-zinc-600 hover:text-ink" to="/dashboard">
                    Dashboard
                  </Link>
                ) : (
                  <Link className="text-zinc-600 hover:text-ink" to="/onboarding">
                    Onboarding
                  </Link>
                )}
                <button
                  className="font-medium text-zinc-600 hover:text-ink"
                  onClick={signOut}
                  type="button"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="text-zinc-600 hover:text-ink" to="/login">
                  Log in
                </Link>
                <Link className="font-semibold text-tribute" to="/signup">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
    </main>
  );
}
