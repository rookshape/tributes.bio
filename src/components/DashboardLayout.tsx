import {
  BarChart3,
  Disc3,
  Radio,
  PanelsTopLeft,
  Settings,
  UserRound,
  WalletCards,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const creatorLinks = [
  { label: "Page", path: "/dashboard", icon: PanelsTopLeft, end: true },
  { label: "Wheels", path: "/dashboard/spin", icon: Disc3, end: false },
  { label: "Live", path: "/dashboard/live", icon: Radio, end: false },
  { label: "Analytics", path: "/dashboard/analytics", icon: BarChart3, end: false },
  { label: "Payments", path: "/dashboard/payments", icon: WalletCards, end: false },
  { label: "Settings", path: "/dashboard/settings", icon: Settings, end: false },
];

const personalLinks = [
  { label: "Account", path: "/dashboard", icon: UserRound, end: true },
  { label: "Settings", path: "/dashboard/settings", icon: Settings, end: false },
];

export function DashboardLayout() {
  const { appUser } = useAuth();
  const dashboardLinks =
    appUser?.accountType === "creator" ? creatorLinks : personalLinks;

  return (
    <>
      <nav
        aria-label="Dashboard"
        className="sticky top-14 z-40 border-b border-line bg-canvas/90 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl gap-6 overflow-x-auto px-4 sm:px-6">
          {dashboardLinks.map(({ end, icon: Icon, label, path }) => (
            <NavLink
              className={({ isActive }) =>
                // The active tab is marked by an accent underline rather than a
                // pill, so the nav reads as one continuous strip.
                `-mb-px flex h-12 shrink-0 items-center gap-2 border-b-2 text-detail font-medium transition-colors duration-fast ${
                  isActive
                    ? "border-accent text-content"
                    : "border-transparent text-content-muted hover:text-content"
                }`
              }
              end={end}
              key={path}
              to={path}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
