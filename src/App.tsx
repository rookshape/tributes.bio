import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ToastProvider } from "./components/ui";
import { DashboardLayout } from "./components/DashboardLayout";
import { AuthPage } from "./pages/AuthPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RefundsPage } from "./pages/RefundsPage";
import { TermsPage } from "./pages/TermsPage";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({
    default: module.AdminPage,
  })),
);

const WheelEditorPage = lazy(() =>
  import("./pages/WheelEditorPage").then((module) => ({
    default: module.WheelEditorPage,
  })),
);
const LiveControlPage = lazy(() =>
  import("./pages/LiveControlPage").then((module) => ({
    default: module.LiveControlPage,
  })),
);
const WheelLibraryPage = lazy(() =>
  import("./pages/WheelLibraryPage").then((module) => ({
    default: module.WheelLibraryPage,
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

  if (appUser?.accountStatus === "disabled") {
    return <Navigate replace to="/" />;
  }

  if (!appUser?.onboardingComplete) {
    return <Navigate replace to="/onboarding" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route element={<TermsPage />} path="terms" />
          <Route element={<PrivacyPage />} path="privacy" />
          <Route element={<RefundsPage />} path="refunds" />
          <Route element={<AuthPage mode="login" />} path="login" />
          <Route element={<AuthPage mode="signup" />} path="signup" />
          <Route element={<OnboardingPage />} path="onboarding" />
          <Route
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
            path="admin"
          />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
            path="dashboard"
          >
            <Route index element={<DashboardPage />} />
            <Route element={<WheelLibraryPage />} path="spin" />
            <Route element={<WheelEditorPage />} path="spin/:wheelId" />
            <Route element={<LiveControlPage />} path="live" />
            <Route element={<AnalyticsPage />} path="analytics" />
            <Route element={<PaymentsPage />} path="payments" />
            <Route element={<SettingsPage />} path="settings" />
          </Route>
        </Route>
        {/* Each overlay part is its own URL so OBS can take three sources. */}
        <Route element={<SpinOverlayPage />} path="overlay/:creatorId/spin" />
        <Route element={<SpinOverlayPage />} path="overlay/:creatorId/spin/:part" />
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
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
