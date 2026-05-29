import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "./hooks/useStore";
import ProtectedRoute from "./routes/ProtectedRoutes";
import AuthLayout from "./layouts/AuthLayout";

// Lazy-loaded or directly imported pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";

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
  }, [theme]);

  return (
    <BrowserRouter>
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
