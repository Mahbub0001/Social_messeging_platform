import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";
import type { Profile } from "./mockDb";

export interface UserSession {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      username?: string;
    };
  } | null;
}

type AuthCallback = (session: UserSession | null) => void;

class AuthServiceClass {
  private authListeners: Set<AuthCallback> = new Set();
  private currentSession: UserSession | null = null;

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
    } else {
      // Supabase session listener
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        if (session) {
          this.currentSession = { user: session.user };
          this.notifyListeners();
        }
      });

      supabase.auth.onAuthStateChange((_event: any, session: any) => {
        this.currentSession = session ? { user: session.user } : null;
        this.notifyListeners();
      });
    }
  }

  private notifyListeners() {
    this.authListeners.forEach((cb) => cb(this.currentSession));
  }

  public onAuthStateChange(callback: AuthCallback) {
    this.authListeners.add(callback);
    // Execute immediately with current state
    callback(this.currentSession);
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

  public async signIn(email: string, password: string): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      // In mock mode, we look up if user profile exists by matching email (or we just create/log them in)
      const username = email.split("@")[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      
      let profiles = mockDb.getProfiles();
      let profile = profiles.find(
        (p) => p.username.toLowerCase() === displayName.toLowerCase() || p.id === email
      );

      if (!profile) {
        // If not found, let's create a new guest profile
        const guestId = "user-" + Math.random().toString(36).substr(2, 9);
        profile = {
          id: guestId,
          username: displayName,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
          bio: "Evaluating this awesome portfolio project!",
          is_online: true,
          last_seen: new Date().toISOString(),
        };
        profiles.push(profile);
        mockDb.saveProfiles(profiles);
      } else {
        // Set online status
        profile.is_online = true;
        profile.last_seen = new Date().toISOString();
        mockDb.saveProfiles(profiles);
      }

      // Seeding databases
      mockDb.init(profile.id, profile.username);

      this.currentSession = {
        user: {
          id: profile.id,
          email: email.trim(),
          user_metadata: { username: profile.username },
        },
      };

      localStorage.setItem("kb_mock_user", JSON.stringify(profile));
      this.notifyListeners();

      return { data: this.currentSession, error: null };
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    }
  }

  public async signOut(): Promise<{ error: any }> {
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

  public async updateProfile(userId: string, data: { username?: string; bio?: string; avatar_url?: string }): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const profiles = mockDb.getProfiles();
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
              },
            },
          };
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
