import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";

export function AppLayout() {
  const { appUser, user } = useAuth();
  const [creatorPhotoURL, setCreatorPhotoURL] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser?.creatorId) {
      setCreatorPhotoURL(null);
      return;
    }

    return onSnapshot(doc(db, "creators", appUser.creatorId), (snapshot) => {
      const photoURL = snapshot.data()?.photoURL;
      setCreatorPhotoURL(typeof photoURL === "string" ? photoURL : null);
    });
  }, [appUser?.creatorId]);

  const avatarURL = creatorPhotoURL ?? appUser?.photoURL ?? user?.photoURL;
  const accountLabel =
    appUser?.displayName ?? appUser?.email ?? user?.displayName ?? "Account";
  const accountInitial = accountLabel.charAt(0).toUpperCase() || "A";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
          <Link className="font-semibold" to="/">
            tributes.bio
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                {!appUser?.onboardingComplete ? (
                  <Link
                    className="bg-ink px-4 py-2 font-semibold text-white"
                    to="/onboarding"
                  >
                    Continue setup
                  </Link>
                ) : null}
                <Link
                  aria-label="Open account settings"
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white"
                  title="Account settings"
                  to={
                    appUser?.onboardingComplete
                      ? "/dashboard/settings"
                      : "/onboarding"
                  }
                >
                  {avatarURL ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={avatarURL}
                    />
                  ) : (
                    accountInitial
                  )}
                </Link>
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
