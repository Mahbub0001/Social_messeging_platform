import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "./hooks/useStore";
import ProtectedRoute from "./routes/ProtectedRoutes";
import AuthLayout from "./layouts/AuthLayout";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

// Lazy-loaded or directly imported pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";

const MobileNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastExitPress = 0;

    const backListenerPromise = CapApp.addListener("backButton", () => {
      // Dashboard has its own internal back button handler for chat, panels and modals
      if (location.pathname === "/dashboard") {
        return;
      }

      if (location.pathname !== "/") {
        navigate(-1);
        return;
      }

      // If at root "/", double press to exit app
      const now = Date.now();
      if (now - lastExitPress < 2000) {
        CapApp.exitApp();
      } else {
        lastExitPress = now;
      }
    });

    return () => {
      backListenerPromise.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate]);

  return null;
};

export const App: React.FC = () => {
  const initializeAuth = useStore((state) => state.initializeAuth);
  const theme = useStore((state) => state.theme);

  useEffect(() => {
    // Start session state observer
    const unsubscribe = initializeAuth();
    return () => {
      unsubscribe();
    };
  }, [initializeAuth]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }

    // Configure native status bar to match theme
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: theme === "light" ? "#ffffff" : "#020617" }).catch(() => {});
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <MobileNavigationHandler />
      <Routes>
        {/* Public Marketing Route */}
        <Route path="/" element={<Landing />} />

        {/* Public Authentication Routes (Wrapped in AuthLayout) */}
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <Register />
            </AuthLayout>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <AuthLayout>
              <ForgotPassword />
            </AuthLayout>
          }
        />

        {/* Protected Dashboard/Messaging Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Settings and other layouts are loaded as tab modules in Dashboard page for clean SPA layout */}
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
