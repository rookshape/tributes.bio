import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { AuthPage } from "./pages/AuthPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { SettingsPage } from "./pages/SettingsPage";

const SpinDashboardPage = lazy(() =>
  import("./pages/SpinDashboardPage").then((module) => ({
    default: module.SpinDashboardPage,
  })),
);
const PublicSpinPage = lazy(() =>
  import("./pages/PublicSpinPage").then((module) => ({
    default: module.PublicSpinPage,
  })),
);
const SpinOverlayPage = lazy(() =>
  import("./pages/SpinOverlayPage").then((module) => ({
    default: module.SpinOverlayPage,
  })),
);

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { appUser, loading, user } = useAuth();

  if (loading) {
    return <div className="p-6">Loading</div>;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  if (!appUser?.onboardingComplete) {
    return <Navigate replace to="/onboarding" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route element={<AuthPage mode="login" />} path="login" />
          <Route element={<AuthPage mode="signup" />} path="signup" />
          <Route element={<OnboardingPage />} path="onboarding" />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
            path="dashboard"
          >
            <Route index element={<DashboardPage />} />
            <Route element={<SpinDashboardPage />} path="spin" />
            <Route element={<AnalyticsPage />} path="analytics" />
            <Route element={<PaymentsPage />} path="payments" />
            <Route element={<SettingsPage />} path="settings" />
          </Route>
        </Route>
        <Route element={<SpinOverlayPage />} path="overlay/:creatorId/spin" />
        <Route element={<PublicSpinPage />} path=":username/spin" />
        <Route element={<PublicProfilePage />} path=":username" />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
