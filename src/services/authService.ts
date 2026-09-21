import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";
import type { Profile } from "./mockDb";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { pushNotificationService } from "./pushNotificationService";

export interface UserSession {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      username?: string;
      role?: string;
      avatar_url?: string;
      bio?: string;
      [key: string]: any;
    };
  } | null;
}

type AuthCallback = (session: UserSession | null) => void;

class AuthServiceClass {
  private authListeners: Set<AuthCallback> = new Set();
  private currentSession: UserSession | null = null;
  private isInitialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  private init() {
    if (isMockMode) {
      // Rehydrate mock session
      const savedUser = localStorage.getItem("kb_mock_user");
      if (savedUser) {
        const profile: Profile = JSON.parse(savedUser);
        this.currentSession = {
          user: {
            id: profile.id,
            email: `${profile.username.toLowerCase().replace(/\s+/g, "")}@example.com`,
            user_metadata: {
              username: profile.username,
            },
          },
        };
        // Seed mock database for this user
        mockDb.init(profile.id, profile.username);
      }
      this.isInitialized = true;
      this.notifyListeners();
    } else {
      // Supabase session listener
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        if (session) {
          this.currentSession = { user: session.user };
        }
        if (!this.isInitialized) {
          this.isInitialized = true;
          this.notifyListeners();
        }
      });

      supabase.auth.onAuthStateChange((_event: any, session: any) => {
        this.currentSession = session ? { user: session.user } : null;
        this.isInitialized = true;
        this.notifyListeners();
      });
    }

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appUrlOpen", (event) => {
        this.handleAuthCallbackUrl(event.url);
      });
      CapApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl?.url) {
          this.handleAuthCallbackUrl(launchUrl.url);
        }
      });
    }
  }

  private async handleAuthCallbackUrl(url: string) {
    if (!url || !url.includes("auth-callback")) return;

    try {
      await Browser.close().catch(() => {});
    } catch {
      // ignore
    }

    if (isMockMode) return;

    try {
      let params: URLSearchParams | null = null;
      const hashIndex = url.indexOf("#");
      const qIndex = url.indexOf("?");

      if (hashIndex !== -1) {
        params = new URLSearchParams(url.substring(hashIndex + 1));
      } else if (qIndex !== -1) {
        params = new URLSearchParams(url.substring(qIndex + 1));
      }

      if (params) {
        const code = params.get("code");
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (data?.session) {
            this.currentSession = { user: data.session.user };
            this.notifyListeners();
          } else if (error) {
            console.error("Error exchanging code for session:", error);
          }
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (data?.session) {
            this.currentSession = { user: data.session.user };
            this.notifyListeners();
          } else if (error) {
            console.error("Error setting session from callback:", error);
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse auth callback URL:", err);
    }
  }

  private notifyListeners() {
    this.authListeners.forEach((cb) => cb(this.currentSession));
  }

  public onAuthStateChange(callback: AuthCallback) {
    this.authListeners.add(callback);
    // Execute immediately only if initialized
    if (this.isInitialized) {
      callback(this.currentSession);
    }
    return () => {
      this.authListeners.delete(callback);
    };
  }

  public async signUp(email: string, password: string, username: string): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const cleanUsername = username.trim();
      const profiles = mockDb.getProfiles();
      
      if (profiles.some((p) => p.username.toLowerCase() === cleanUsername.toLowerCase())) {
        return { data: null, error: { message: "Username already exists." } };
      }

      const newUserId = "user-" + Math.random().toString(36).substr(2, 9);
      const newProfile: Profile = {
        id: newUserId,
        username: cleanUsername,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`,
        bio: "Hey there! I am new here.",
        is_online: true,
        last_seen: new Date().toISOString(),
      };

      // Seeding database with current user included
      mockDb.init(newUserId, cleanUsername);
      
      // Update profiles list
      const updatedProfiles = [...mockDb.getProfiles(), newProfile];
      mockDb.saveProfiles(updatedProfiles);

      this.currentSession = {
        user: {
          id: newUserId,
          email: email.trim(),
          user_metadata: { username: cleanUsername },
        },
      };

      localStorage.setItem("kb_mock_user", JSON.stringify(newProfile));
      this.notifyListeners();

      return { data: this.currentSession, error: null };
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });
      return { data, error };
    }
  }

  public async signIn(identifier: string, password: string): Promise<{ data: any; error: any }> {
    const cleanId = identifier.trim();
    let emailToUse = cleanId;

    if (!cleanId.includes("@")) {
      if (cleanId.toLowerCase() === "mahbub") {
        emailToUse = "mahbub@admin.kothabarta.com";
      } else {
        emailToUse = `${cleanId.toLowerCase().replace(/\s+/g, "")}@kothabarta.com`;
      }
    }

    if (isMockMode) {
      const displayName = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
      
      let profiles = mockDb.getProfiles();
      let profile = profiles.find(
        (p) => p.username.toLowerCase() === cleanId.toLowerCase() || p.id === emailToUse
      );

      if (!profile) {
        const guestId = cleanId.toLowerCase() === "mahbub" ? "admin-mahbub" : "user-" + Math.random().toString(36).substr(2, 9);
        profile = {
          id: guestId,
          username: cleanId.toLowerCase() === "mahbub" ? "mahbub" : displayName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
          bio: cleanId.toLowerCase() === "mahbub" ? "Platform Administrator" : "Evaluating this awesome portfolio project!",
          is_online: true,
          last_seen: new Date().toISOString(),
        };
        profiles.push(profile);
        mockDb.saveProfiles(profiles);
      } else {
        profile.is_online = true;
        profile.last_seen = new Date().toISOString();
        mockDb.saveProfiles(profiles);
      }

      mockDb.init(profile.id, profile.username);

      this.currentSession = {
        user: {
          id: profile.id,
          email: emailToUse.trim(),
          user_metadata: { username: profile.username, role: cleanId.toLowerCase() === "mahbub" ? "admin" : "user" },
        },
      };

      localStorage.setItem("kb_mock_user", JSON.stringify(profile));
      this.notifyListeners();

      return { data: this.currentSession, error: null };
    } else {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      // Seamless auto-provisioning for mahbub / mahbub
      if (error && cleanId.toLowerCase() === "mahbub" && password === "mahbub") {
        const signUpRes = await supabase.auth.signUp({
          email: "mahbub@admin.kothabarta.com",
          password: "mahbub",
          options: {
            data: {
              username: "mahbub",
              role: "admin",
            },
          },
        });

        if (signUpRes.data?.session) {
          data = signUpRes.data;
          error = null;
          if (signUpRes.data.user?.id) {
            await supabase.from("profiles").upsert({
              id: signUpRes.data.user.id,
              username: "mahbub",
              bio: "System Administrator",
              role: "admin",
              is_banned: false,
            });
          }
        } else {
          const retry = await supabase.auth.signInWithPassword({
            email: "mahbub@admin.kothabarta.com",
            password: "mahbub",
          });
          data = retry.data;
          error = retry.error;
        }
      }

      // Ensure mahbub always has admin role in profiles table
      if (
        data?.session?.user &&
        (cleanId.toLowerCase() === "mahbub" ||
          cleanId.toLowerCase() === "mahbub0001" ||
          data.session.user.email?.toLowerCase().includes("mahbub"))
      ) {
        try {
          await supabase
            .from("profiles")
            .update({ role: "admin" })
            .eq("id", data.session.user.id);
        } catch (e) {
          console.warn("Failed to set admin role in authService:", e);
        }
      }

      return { data, error };
    }
  }

  public async signInWithOAuth(provider: "google" | "github"): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      // Mock OAuth Login Flow
      const mockUsername = `${provider === "google" ? "Google" : "GitHub"} User`;
      const cleanUsername = mockUsername.trim();
      const mockEmail = `${provider}_${Math.random().toString(36).substr(2, 5)}@example.com`;
      const mockUserId = `oauth-${provider}-${Math.random().toString(36).substr(2, 9)}`;

      const newProfile: Profile = {
        id: mockUserId,
        username: cleanUsername,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`,
        bio: `Logged in via mock ${provider} OAuth.`,
        is_online: true,
        last_seen: new Date().toISOString(),
      };

      const profiles = mockDb.getProfiles();
      profiles.push(newProfile);
      mockDb.saveProfiles(profiles);

      mockDb.init(mockUserId, cleanUsername);

      this.currentSession = {
        user: {
          id: mockUserId,
          email: mockEmail,
          user_metadata: { username: cleanUsername },
        },
      };

      localStorage.setItem("kb_mock_user", JSON.stringify(newProfile));
      this.notifyListeners();

      return { data: this.currentSession, error: null };
    } else {
      if (Capacitor.isNativePlatform()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: "com.nibir.kothabarta://auth-callback",
            skipBrowserRedirect: true,
          },
        });
        if (error) return { data: null, error };
        if (data?.url) {
          await Browser.open({ url: data.url, windowName: "_self" });
        }
        return { data: null, error: null };
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        return { data, error };
      }
    }
  }

  public async signOut(): Promise<{ error: any }> {
    const userId = this.currentSession?.user?.id;
    if (userId) {
      await pushNotificationService.unregister(userId).catch(() => {});
    }

    if (isMockMode) {
      const savedUser = localStorage.getItem("kb_mock_user");
      if (savedUser) {
        const profile: Profile = JSON.parse(savedUser);
        const profiles = mockDb.getProfiles();
        const userProf = profiles.find((p) => p.id === profile.id);
        if (userProf) {
          userProf.is_online = false;
          userProf.last_seen = new Date().toISOString();
          mockDb.saveProfiles(profiles);
        }
      }
      localStorage.removeItem("kb_mock_user");
      this.currentSession = null;
      this.notifyListeners();
      return { error: null };
    } else {
      const { error } = await supabase.auth.signOut();
      return { error };
    }
  }

  public async updateProfile(userId: string, data: { username?: string; bio?: string; avatar_url?: string; is_locked?: boolean }): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const profiles = mockDb.getProfiles();

      // Check if username is already taken by another user
      if (data.username) {
        const usernameExists = profiles.some(
          (p) => p.id !== userId && p.username.toLowerCase() === data.username!.toLowerCase()
        );
        if (usernameExists) {
          return { data: null, error: { message: "This username is already taken. Please choose a different one." } };
        }
      }

      const profileIndex = profiles.findIndex((p) => p.id === userId);
      if (profileIndex === -1) {
        return { data: null, error: { message: "Profile not found." } };
      }

      profiles[profileIndex] = {
        ...profiles[profileIndex],
        ...data,
      };
      mockDb.saveProfiles(profiles);

      // If active session, update saved user metadata
      const savedUser = localStorage.getItem("kb_mock_user");
      if (savedUser) {
        const user: Profile = JSON.parse(savedUser);
        if (user.id === userId) {
          const updatedUser = { ...user, ...data };
          localStorage.setItem("kb_mock_user", JSON.stringify(updatedUser));
          this.currentSession = {
            user: {
              ...this.currentSession!.user!,
              user_metadata: {
                ...this.currentSession!.user!.user_metadata,
                username: updatedUser.username,
                avatar_url: updatedUser.avatar_url,
                bio: updatedUser.bio,
              },
            },
          };
        }
      }

      // Synchronize local feed cache immediately in mock mode
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        try {
          const rawFeed = localStorage.getItem("kb_feed_posts_v1");
          if (rawFeed) {
            const posts = JSON.parse(rawFeed);
            if (Array.isArray(posts)) {
              let changed = false;
              const updatedPosts = posts.map((post: any) => {
                let postChanged = false;
                let author = post.author;
                if (post.userId === userId && author) {
                  author = {
                    ...author,
                    ...(data.username ? { username: data.username } : {}),
                    ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
                    ...(data.bio !== undefined ? { bio: data.bio } : {}),
                  };
                  postChanged = true;
                }
                let comments = post.comments;
                if (Array.isArray(comments)) {
                  comments = comments.map((c: any) => {
                    if (c.userId === userId && c.author) {
                      postChanged = true;
                      return {
                        ...c,
                        author: {
                          ...c.author,
                          ...(data.username ? { username: data.username } : {}),
                          ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
                        },
                      };
                    }
                    return c;
                  });
                }
                if (postChanged) {
                  changed = true;
                  return { ...post, author, comments };
                }
                return post;
              });
              if (changed) {
                localStorage.setItem("kb_feed_posts_v1", JSON.stringify(updatedPosts));
              }
            }
          }
          window.dispatchEvent(new CustomEvent("kb_feed_updated", { detail: { userId } }));
        } catch (cacheErr) {
          console.warn("Failed to update local feed cache in mock updateProfile:", cacheErr);
        }
      }

      this.notifyListeners();
      return { data: profiles[profileIndex], error: null };
    } else {
      const { data: updatedData, error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", userId)
        .select()
        .single();
      
      if (error) {
        if (error.code === "23505") {
          return { data: null, error: { message: "This username is already taken. Please choose a different one." } };
        }
        return { data: null, error };
      }

      // Synchronize Supabase Auth user_metadata so current auth session retains the new avatar
      try {
        const metaUpdates: any = {};
        if (data.username) metaUpdates.username = data.username;
        if (data.avatar_url !== undefined) metaUpdates.avatar_url = data.avatar_url;
        if (data.bio !== undefined) metaUpdates.bio = data.bio;
        await supabase.auth.updateUser({ data: metaUpdates });
      } catch (authErr) {
        console.warn("Failed to sync auth user_metadata:", authErr);
      }

      // Explicitly update feed_posts table to guarantee immediate persistence
      try {
        const authorPatch = {
          id: userId,
          username: updatedData?.username || data.username,
          avatar_url: updatedData?.avatar_url ?? data.avatar_url ?? null,
          bio: updatedData?.bio ?? data.bio ?? null,
          role: updatedData?.role || "user",
        };
        await supabase
          .from("feed_posts")
          .update({ author: authorPatch })
          .eq("user_id", userId);
      } catch (feedErr) {
        console.warn("Failed to update feed_posts in authService:", feedErr);
      }

      // Synchronize local feed cache immediately
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        try {
          const rawFeed = localStorage.getItem("kb_feed_posts_v1");
          if (rawFeed) {
            const posts = JSON.parse(rawFeed);
            if (Array.isArray(posts)) {
              let changed = false;
              const updatedPosts = posts.map((post: any) => {
                let postChanged = false;
                let author = post.author;
                if (post.userId === userId && author) {
                  author = {
                    ...author,
                    ...(data.username ? { username: data.username } : {}),
                    ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
                    ...(data.bio !== undefined ? { bio: data.bio } : {}),
                  };
                  postChanged = true;
                }
                let comments = post.comments;
                if (Array.isArray(comments)) {
                  comments = comments.map((c: any) => {
                    if (c.userId === userId && c.author) {
                      postChanged = true;
                      return {
                        ...c,
                        author: {
                          ...c.author,
                          ...(data.username ? { username: data.username } : {}),
                          ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
                        },
                      };
                    }
                    return c;
                  });
                }
                if (postChanged) {
                  changed = true;
                  return { ...post, author, comments };
                }
                return post;
              });
              if (changed) {
                localStorage.setItem("kb_feed_posts_v1", JSON.stringify(updatedPosts));
              }
            }
          }
          window.dispatchEvent(new CustomEvent("kb_feed_updated", { detail: { userId } }));
        } catch (cacheErr) {
          console.warn("Failed to update local feed cache on profile update:", cacheErr);
        }
      }

      return { data: updatedData, error };
    }
  }

  public async getProfile(userId: string): Promise<{ data: Profile | null; error: any }> {
    if (isMockMode) {
      const profiles = mockDb.getProfiles();
      const profile = profiles.find((p) => p.id === userId) || null;
      return { data: profile, error: null };
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return { data, error };
    }
  }
}

export const authService = new AuthServiceClass();
export default authService;
