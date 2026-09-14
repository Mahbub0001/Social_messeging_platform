# Design Specification: Kotha Barta Admin Panel

**Date:** 2026-09-14  
**Status:** Approved by User  
**Target:** Web & Mobile (Android Capacitor)  
**Author:** Pair Programming Assistant & Mahbub  

---

## 1. Overview & Objectives

This specification describes the architecture, database schema, security policies, and user interface for the **Admin Panel** of **Kotha Barta (কথাবার্তা)**.

The Admin Panel provides complete platform governance:
1. **User Management:** View registered users, search, filter, ban/unban with reasons, and assign roles (`admin`, `moderator`, `user`).
2. **Content & Story Moderation:** View all active 24-hour stories and flagged content, delete inappropriate media with one click (including storage removal).
3. **Analytics & System Metrics:** Real-time metrics for total users, daily active users (DAU), total messages sent, active stories, and call counts.
4. **System Broadcast & Announcements:** Send platform-wide announcements with optional push notification delivery via Firebase Cloud Messaging (FCM).

---

## 2. Authentication & Access Control

### 2.1 Unified Login Experience
- The login page (`/login`) retains its standard, clean appearance with **no visible separate "Admin" login button or toggle**.
- The login input supports either **Email** or **Username** (e.g., `mahbub`).
- When logging in with `username: mahbub` and `password: mahbub`:
  - The system authenticates the user.
  - It resolves the user's profile and checks `role`.
  - If `role === 'admin'`, the app redirects **directly to `/admin`**.
  - If `role !== 'admin'`, the app redirects to `/dashboard` (standard chat).

### 2.2 Route Protection (`AdminRoute`)
- Route `/admin` and all nested routes (`/admin/*`) are protected by `<AdminRoute />`.
- `<AdminRoute />` checks:
  1. Is the session active? If not, redirect to `/login`.
  2. Is the profile loaded? If loading, show a branded loading indicator.
  3. Does `profile.role === 'admin'`?
     - If **Yes**, render the `<AdminLayout />` and requested view.
     - If **No**, render an "Access Denied" view with a prominent "Back to Chat" button redirecting to `/dashboard`.
- Regular users cannot access or view administrative controls.

### 2.3 Navigation Bridges
- In `/dashboard`, if the current user has `role === 'admin'`, the user profile dropdown / settings sidebar displays a **"🛡️ Admin Panel"** button.
- In `/admin`, the top header bar includes a **"💬 Back to Chat"** button allowing seamless return to the chat interface.

---

## 3. Database Schema & Supabase RLS

### 3.1 `profiles` Table Extensions
The existing `profiles` table is extended with:
```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;

-- Index for role and ban status queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
```

### 3.2 `system_announcements` Table
Stores announcements sent by administrators:
```sql
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text CHECK (type IN ('info', 'warning', 'critical', 'update')) DEFAULT 'info' NOT NULL,
  send_push boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.system_announcements(created_at DESC);
```

### 3.3 `content_reports` Table
Tracks reported messages, stories, and user accounts:
```sql
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_type text CHECK (target_type IN ('story', 'message', 'user')) NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending' NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
```

### 3.4 Row-Level Security (RLS) Policies & Helper Functions
1. **Admin Helper Function:**
   ```sql
   CREATE OR REPLACE FUNCTION public.is_admin()
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Profiles RLS:**
   - Any authenticated user can read public profiles.
   - Users can update their own username, avatar, bio.
   - Only admins (`is_admin() = true`) can update `role`, `is_banned`, `banned_reason`, and `banned_at`.

3. **Stories RLS:**
   - Users can delete their own stories.
   - Admins can delete ANY story (`is_admin() = true`).

4. **Messages RLS:**
   - Banned users (`is_banned = true`) are restricted from inserting new messages.

5. **Announcements RLS:**
   - All authenticated users can SELECT active announcements.
   - Only admins can INSERT, UPDATE, or DELETE announcements.

---

## 4. Admin UI Architecture & Components

The admin panel is code-split (`React.lazy`) in `src/routes/` to ensure regular chat users download zero admin bundle bytes.

### 4.1 Component Tree
```
src/
├── routes/
│   └── AdminRoute.tsx             # Guard checking session & admin role
├── layouts/
│   └── AdminLayout.tsx            # Header + Sidebar + Dynamic Content Outlet
├── pages/
│   └── admin/
│       ├── AdminOverview.tsx      # Analytics cards, platform summary, quick actions
│       ├── UserManagement.tsx     # User table, search, ban/unban modal, role selector
│       ├── ContentModeration.tsx  # Live stories gallery, 1-click purge, reports queue
│       └── SystemBroadcast.tsx    # Announcement composer, push toggle, broadcast history
└── services/
    └── adminService.ts            # Supabase queries for stats, bans, roles, stories, broadcasts
```

### 4.2 Module Breakdown

#### A. `AdminOverview.tsx` (Dashboard Home)
- **Top Metrics Row:**
  - Total Users registered.
  - Active Users Today (DAU).
  - Total Messages exchanged.
  - Active Stories currently live.
- **Quick Links:** Quick buttons to Moderate Stories, Ban a User, Send Announcement.
- **Recent Registrations:** Compact list of the latest 5 users.

#### B. `UserManagement.tsx`
- **Search & Filter:** Search by username or user ID; filter by status (All, Active, Banned) and role (All, Admin, Moderator, User).
- **User Table:** Columns: User (Avatar + Name), Role Badge, Status Badge (Active / Banned), Last Seen, Actions.
- **Ban / Unban Action:**
  - Modal to input ban reason (e.g., "Violating community standards", "Spamming").
  - On confirm, marks user `is_banned = true` and records `banned_reason`.
  - Unban button reverses status with 1 click.
- **Role Elevation:** Modal/dropdown to promote or demote user role (`admin`, `moderator`, `user`).

#### C. `ContentModeration.tsx`
- **Active Stories Grid:**
  - Displays cards for all currently active 24-hour stories from all users.
  - Preview thumbnail/video, author info, creation timestamp, time remaining until expiration.
  - **"Delete Story"** button: Prompts confirmation, deletes story from `stories` table, and removes file from Supabase Storage bucket `stories`.
- **Report Queue:**
  - List of user-submitted reports from `content_reports`.
  - Actions: "Dismiss", "Delete Content", "Ban User".

#### D. `SystemBroadcast.tsx`
- **Announcement Composer:**
  - Input for Title and Content.
  - Priority selector: `Info` (blue), `Warning` (yellow), `Critical` (red), `Update` (green).
  - Checkbox: `[x] Send Push Notification to all users' devices`.
- **Delivery Mechanism:**
  - Writes to `system_announcements`.
  - If push is enabled, triggers the Edge Function to send FCM notification to all registered tokens in `device_tokens`.
- **History Table:** Shows previous announcements with delete action.

---

## 5. User Account Setup (`mahbub`)
- To ensure `username: mahbub` with `password: mahbub` functions immediately:
  1. An admin user will be created or verified in Supabase auth with email `mahbub@kothabarta.com` (or user's existing email) and password `mahbub`.
  2. The profile record in `public.profiles` for `mahbub` is updated with `role = 'admin'` and `is_banned = false`.
  3. Login logic in `src/services/authService.ts` and `src/pages/Login.tsx` handles identifier `mahbub`, looks up or maps the admin user, authenticates, and navigates directly to `/admin`.

---

## 6. Verification & Testing Plan

1. **Direct Admin Login Verification:**
   - Go to `/login`.
   - Enter `mahbub` in Email/Username field and `mahbub` in Password.
   - Click "Sign In".
   - Confirm automatic redirect directly to `/admin`.
2. **Normal User Login Verification:**
   - Log in with a standard user account.
   - Confirm redirect to `/dashboard` (chat).
   - Manually navigate to `/admin` -> Verify "Access Denied" screen displays.
3. **User Management Test:**
   - In `/admin/users`, search for a test user.
   - Click "Ban User", enter reason, confirm.
   - Verify user status shows `Banned`.
   - Log in with banned user -> Verify sending messages is blocked by RLS.
   - Click "Unban" in admin panel -> Verify normal functionality restored.
4. **Story Moderation Test:**
   - Upload a test story from user account.
   - Open `/admin/moderation` -> Confirm story appears in Live Stories Grid.
   - Click "Delete Story" -> Confirm story is deleted from grid, database, and storage bucket.
5. **Broadcast Test:**
   - Post an announcement with push notification enabled.
   - Verify announcement appears in active announcements.
6. **Build & Sync Verification:**
   - Run `npm run build` to confirm TypeScript types, imports, and lazy chunks compile cleanly.
   - Run `npx cap sync android` to ensure Android project is in sync.
