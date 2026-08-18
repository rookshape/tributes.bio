import { doc, onSnapshot } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { checkAdminAccess } from "../lib/admin";
import { cn } from "../lib/cn";
import { ButtonLink } from "./ui";

export function AppLayout() {
  const { appUser, user } = useAuth();
  const { pathname } = useLocation();
  const onLanding = pathname === "/";
  const [creatorPhotoURL, setCreatorPhotoURL] = useState<string | null>(null);
  const [adminAccess, setAdminAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setAdminAccess(false);
      return;
    }
    let active = true;
    checkAdminAccess()
      .then((allowed) => {
        if (active) setAdminAccess(allowed);
      })
      .catch(() => {
        if (active) setAdminAccess(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

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
    <div className="app-canvas">
      <header
        className={
          // The landing hero owns the top of the page, so the controls float
          // over it with no bar behind them.
          onLanding
            ? "absolute inset-x-0 top-0 z-50"
            : "app-bar sticky top-0 z-50 border-b"
        }
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo slot — intentionally empty until the real mark is supplied. */}
          <span />
          <nav className="flex items-center gap-2 text-body">
            {user ? (
              <>
                {adminAccess ? (
                  <Link
                    aria-label="Open admin"
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-control border",
                      onLanding
                        ? "border-white/45 text-white hover:bg-white/15"
                        : "icon-button",
                    )}
                    title="Admin"
                    to="/admin"
                  >
                    <ShieldCheck size={16} />
                  </Link>
                ) : null}
                {!appUser?.onboardingComplete ? (
                  <ButtonLink size="sm" to="/onboarding" variant="primary">
                    Continue setup
                  </ButtonLink>
                ) : null}
                <Link
                  aria-label="Open account settings"
                  className={cn(
                    "grid h-9 w-9 place-items-center overflow-hidden rounded-full border text-detail font-semibold",
                    onLanding
                      ? "border-white/45 bg-white/15 text-white"
                      : "border-line bg-surface-raised text-content",
                  )}
                  title="Account settings"
                  to={appUser?.onboardingComplete ? "/dashboard/settings" : "/onboarding"}
                >
                  {avatarURL ? (
                    <img alt="" className="h-full w-full object-cover" src={avatarURL} />
                  ) : (
                    accountInitial
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  className={cn(
                    "rounded-control px-3 py-2 font-medium",
                    onLanding
                      ? "text-white/85 hover:text-white"
                      : "text-content-muted hover:text-content",
                  )}
                  to="/login"
                >
                  Log in
                </Link>
                <ButtonLink
                  size="sm"
                  to="/signup"
                  variant={onLanding ? "primary" : "accent"}
                >
                  Create account
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
