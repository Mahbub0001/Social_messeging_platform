import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "./hooks/useStore";
import ProtectedRoute from "./routes/ProtectedRoutes";
import AuthLayout from "./layouts/AuthLayout";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { pushNotificationService } from "./services/pushNotificationService";

// Lazy-loaded or directly imported pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AdminRoute from "./routes/AdminRoute";

// Lazy-loaded Admin pages to preserve mobile bundle size
const AdminLayout = React.lazy(() => import("./layouts/AdminLayout"));
const AdminOverview = React.lazy(() => import("./pages/admin/AdminOverview"));
const UserManagement = React.lazy(() => import("./pages/admin/UserManagement"));
const ContentModeration = React.lazy(() => import("./pages/admin/ContentModeration"));
const SystemBroadcast = React.lazy(() => import("./pages/admin/SystemBroadcast"));

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

const NotificationDeepLinkHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const activeConversationId = useStore((state) => state.activeConversationId);
  const user = useStore((state) => state.user);

  // Sync active conversation with Android native layer to suppress alerts for active chat
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (typeof (window as any).KBNativeBridge?.setActiveConversation === "function") {
        (window as any).KBNativeBridge.setActiveConversation(activeConversationId || "");
      }
    } catch (e) {
      console.warn("Failed to set native active conversation:", e);
    }
  }, [activeConversationId]);

  // Handle deep links from native push notification clicks
  useEffect(() => {
    const handleDeepLink = (convId: string) => {
      if (!convId) return;
      console.log("[NotificationDeepLink] Navigating to conversation:", convId);
      window.dispatchEvent(new CustomEvent("kb_set_active_view", { detail: "chat" }));
      setActiveConversationId(convId);
      try {
        useStore.getState().fetchConversations();
        useStore.getState().fetchMessages(convId);
      } catch (e) {
        console.warn("Failed to fetch messages for deep link:", e);
      }
      if (location.pathname !== "/dashboard") {
        navigate("/dashboard");
      }
    };

    // 1. Hook into window for MainActivity.dispatchConversationToWebView
    (window as any).handleNotificationDeepLink = handleDeepLink;

    // 2. Register callback on pushNotificationService
    pushNotificationService.setConversationClickCallback(handleDeepLink);

    // 3. Cold-start check: read pending conversation ID from native bridge
    if (Capacitor.isNativePlatform() && typeof (window as any).KBNativeBridge?.getPendingConversationId === "function") {
      const pendingConv = (window as any).KBNativeBridge.getPendingConversationId();
      if (pendingConv) {
        handleDeepLink(pendingConv);
      }
    }

    return () => {
      if ((window as any).handleNotificationDeepLink === handleDeepLink) {
        delete (window as any).handleNotificationDeepLink;
      }
    };
  }, [location.pathname, navigate, setActiveConversationId]);

  // Sync auth credentials to Android native SharedPreferences
  useEffect(() => {
    if (user?.id) {
      pushNotificationService.syncAuthWithNative(user.id);
    }
  }, [user?.id]);

  return null;
};

export const App: React.FC = () => {
  const initializeAuth = useStore((state) => state.initializeAuth);
  const theme = useStore((state) => state.theme);
  const user = useStore((state) => state.user);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);

  useEffect(() => {
    // Start session state observer
    const unsubscribe = initializeAuth();
    return () => {
      unsubscribe();
    };
  }, [initializeAuth]);

  // Initialize WhatsApp/Messenger-style Push Notifications
  useEffect(() => {
    if (user?.id) {
      pushNotificationService.init(user.id, (conversationId) => {
        if (conversationId) {
          setActiveConversationId(conversationId);
        }
      });
    }
  }, [user?.id, setActiveConversationId]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }

    // Configure native status bar to match theme
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: theme === "light" ? "#ffffff" : "#020617" }).catch(() => {});
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <MobileNavigationHandler />
      <NotificationDeepLinkHandler />
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

        {/* Protected Admin Portal Routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="moderation" element={<ContentModeration />} />
            <Route path="broadcast" element={<SystemBroadcast />} />
          </Route>
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
