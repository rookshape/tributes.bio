import {
  BarChart3,
  PanelsTopLeft,
  Settings,
  UserRound,
  WalletCards,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const creatorLinks = [
  { label: "Page", path: "/dashboard", icon: PanelsTopLeft, end: true },
  {
    label: "Analytics",
    path: "/dashboard/analytics",
    icon: BarChart3,
    end: false,
  },
  {
    label: "Payments",
    path: "/dashboard/payments",
    icon: WalletCards,
    end: false,
  },
  {
    label: "Settings",
    path: "/dashboard/settings",
    icon: Settings,
    end: false,
  },
];

export function DashboardLayout() {
  const { appUser } = useAuth();
  const dashboardLinks =
    appUser?.accountType === "creator"
      ? creatorLinks
      : [
          {
            label: "Account",
            path: "/dashboard",
            icon: UserRound,
            end: true,
          },
          {
            label: "Settings",
            path: "/dashboard/settings",
            icon: Settings,
            end: false,
          },
        ];

  return (
    <>
      <nav className="border-b border-zinc-200 bg-white" aria-label="Dashboard">
        <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-5">
          {dashboardLinks.map(({ end, icon: Icon, label, path }) => (
            <NavLink
              className={({ isActive }) =>
                `flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium ${
                  isActive
                    ? "border-ink text-ink"
                    : "border-transparent text-zinc-500 hover:text-ink"
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
