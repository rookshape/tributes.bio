import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";

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
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route element={<AuthPage mode="login" />} path="login" />
        <Route element={<AuthPage mode="signup" />} path="signup" />
        <Route element={<OnboardingPage />} path="onboarding" />
        <Route
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
          path="dashboard"
        />
        <Route element={<PublicProfilePage />} path=":username" />
      </Route>
    </Routes>
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
