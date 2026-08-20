import { doc, onSnapshot } from "firebase/firestore";
import { LogOut, PanelsTopLeft, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { checkAdminAccess } from "../lib/admin";
import { cn } from "../lib/cn";
import { ButtonLink, Menu } from "./ui";

export function AppLayout() {
  const { appUser, signOut, user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
                        ? "border-[#82aefc]/45 bg-white/65 text-content hover:bg-white"
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
                <Menu
                  items={[
                    {
                      label: "Your page",
                      icon: <PanelsTopLeft size={16} />,
                      onSelect: () => navigate("/dashboard"),
                    },
                    {
                      label: "Settings",
                      icon: <Settings size={16} />,
                      onSelect: () => navigate("/dashboard/settings"),
                    },
                    {
                      label: "Sign out",
                      icon: <LogOut size={16} />,
                      destructive: true,
                      onSelect: () => void signOut(),
                    },
                  ]}
                  trigger={(triggerProps) => (
                    <button
                      {...triggerProps}
                      aria-label={`Account menu for ${accountLabel}`}
                      className={cn(
                        "grid h-9 w-9 place-items-center overflow-hidden rounded-full border text-detail font-semibold",
                        onLanding
                          ? "border-[#82aefc]/45 bg-white/70 text-content"
                          : "border-line bg-surface-raised text-content",
                      )}
                      type="button"
                    >
                      {avatarURL ? (
                        <img alt="" className="h-full w-full object-cover" src={avatarURL} />
                      ) : (
                        accountInitial
                      )}
                    </button>
                  )}
                />
              </>
            ) : (
              <>
                <Link
                  className={cn(
                    "rounded-control px-3 py-2 font-medium",
                    onLanding
                      ? "text-content-muted hover:text-content"
                      : "text-content-muted hover:text-content",
                  )}
                  to="/login"
                >
                  Log in
                </Link>
                <ButtonLink
                  className="rounded-full px-5"
                  size="sm"
                  to="/signup"
                  variant={onLanding ? "primary" : "accent"}
                >
                  Sign Up
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
