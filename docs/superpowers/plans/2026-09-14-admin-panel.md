# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a comprehensive, all-in-one Admin Panel into Kotha Barta (`কথাবার্তা`), featuring User Management (ban/unban, role assignment), Content & Story Moderation (1-click purge), System Analytics, Global Broadcasts with FCM push notifications, and direct `/admin` redirection for `username: mahbub` / `password: mahbub`.

**Architecture:** An integrated, lazy-loaded sub-portal under `/admin/*` protected by `<AdminRoute />`. Database state is managed in Supabase PostgreSQL with RLS policies, indexed columns on `profiles` (`role`, `is_banned`), and new tables `system_announcements` and `content_reports`. Normal users never download the admin code bundle on web or mobile.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Supabase (PostgreSQL, Auth, Storage, Edge Functions), Capacitor Android.

## Global Constraints

- Never break existing chat, WebRTC calls, or push notification functionality.
- Lazy load all admin pages with `React.lazy()` to preserve mobile/web bundle size.
- Login page must NOT contain separate admin buttons or radio choices; handle `username: mahbub` and `password: mahbub` seamlessly in the unified login form.
- Direct redirection: `admin` role users route directly to `/admin`, regular users route to `/dashboard`.
- Strict RLS security: Banned users cannot insert messages or stories; only admins can modify roles, ban flags, or delete foreign stories.
- All code changes must pass `npm run build` cleanly without TypeScript or linting errors.

---

### Task 1: Database Migration & RLS Security

**Files:**
- Create: `supabase/migrations/20260914_admin_panel.sql`
- Modify: `schema.sql:10-18,80-100`

**Interfaces:**
- Produces: Database columns (`role`, `is_banned`, `banned_reason`, `banned_at`) on `profiles`, `system_announcements` table, `content_reports` table, `is_admin()` SQL function, and RLS policies.

- [ ] **Step 1: Write the SQL migration script**

```sql
-- supabase/migrations/20260914_admin_panel.sql

-- 1. Extend profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. Create system_announcements table
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

-- 3. Create content_reports table
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

-- 4. Admin verification function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Announcements: anyone authenticated can read, only admin can manage
DROP POLICY IF EXISTS "Anyone authenticated can view active announcements" ON public.system_announcements;
CREATE POLICY "Anyone authenticated can view active announcements" 
  ON public.system_announcements FOR SELECT 
  TO authenticated 
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert announcements" ON public.system_announcements;
CREATE POLICY "Admins can insert announcements" 
  ON public.system_announcements FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update announcements" ON public.system_announcements;
CREATE POLICY "Admins can update announcements" 
  ON public.system_announcements FOR UPDATE 
  TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.system_announcements;
CREATE POLICY "Admins can delete announcements" 
  ON public.system_announcements FOR DELETE 
  TO authenticated 
  USING (public.is_admin());

-- Stories: Admins can delete any story
DROP POLICY IF EXISTS "Admins can delete any story" ON public.stories;
CREATE POLICY "Admins can delete any story" 
  ON public.stories FOR DELETE 
  TO authenticated 
  USING (public.is_admin() OR auth.uid() = user_id);

-- Messages: Prevent banned users from sending messages
DROP POLICY IF EXISTS "Active users can insert messages" ON public.messages;
CREATE POLICY "Active users can insert messages" 
  ON public.messages FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() = sender_id AND 
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned = true)
  );

-- Profiles: Only admins can change roles or ban flags
DROP POLICY IF EXISTS "Admins can update user roles and ban status" ON public.profiles;
CREATE POLICY "Admins can update user roles and ban status" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (public.is_admin() OR auth.uid() = id);
```

- [ ] **Step 2: Append migration definitions to root `schema.sql`**
- [ ] **Step 3: Commit migration script**

```bash
git add supabase/migrations/20260914_admin_panel.sql schema.sql
git commit -m "feat(db): add admin panel tables, columns, and RLS security policies"
```

---

### Task 2: Admin Service Layer (`adminService.ts`)

**Files:**
- Create: `src/services/adminService.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AdminStats {
    totalUsers: number;
    activeUsersToday: number;
    totalMessages: number;
    activeStories: number;
  }
  export interface AdminUser {
    id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    role: 'admin' | 'moderator' | 'user';
    is_banned: boolean;
    banned_reason: string | null;
    banned_at: string | null;
    last_seen: string | null;
    created_at?: string;
  }
  export interface LiveStoryItem {
    id: string;
    user_id: string;
    media_url: string;
    media_type: 'image' | 'video';
    caption: string | null;
    created_at: string;
    expires_at: string;
    profiles?: { username: string; avatar_url: string | null };
  }
  export interface AnnouncementItem {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'critical' | 'update';
    send_push: boolean;
    is_active: boolean;
    created_at: string;
  }
  ```
  - `adminService.getStats(): Promise<AdminStats>`
  - `adminService.getUsers(search?: string, roleFilter?: string, statusFilter?: string): Promise<AdminUser[]>`
  - `adminService.updateUserBan(userId: string, isBanned: boolean, reason?: string): Promise<boolean>`
  - `adminService.updateUserRole(userId: string, role: 'admin' | 'moderator' | 'user'): Promise<boolean>`
  - `adminService.getLiveStories(): Promise<LiveStoryItem[]>`
  - `adminService.deleteStory(storyId: string, mediaUrl: string): Promise<boolean>`
  - `adminService.createAnnouncement(data: Omit<AnnouncementItem, 'id' | 'created_at' | 'is_active'>): Promise<boolean>`
  - `adminService.getAnnouncements(): Promise<AnnouncementItem[]>`
  - `adminService.deleteAnnouncement(id: string): Promise<boolean>`

- [ ] **Step 1: Write `src/services/adminService.ts` with complete Supabase RPC and query handlers**
- [ ] **Step 2: Commit admin service**

```bash
git add src/services/adminService.ts
git commit -m "feat(admin): implement adminService data access layer"
```

---

### Task 3: Unified Login & Direct `/admin` Routing

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/services/authService.ts`
- Create: `src/routes/AdminRoute.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `authService.signIn`, `useStore`
- Produces: Automatic redirect to `/admin` if authenticated user has role `admin`. Route protection preventing regular users from accessing `/admin`.

- [ ] **Step 1: Update `src/services/authService.ts` to support username or email identifier**
  - If identifier doesn't contain `@` and is `mahbub`, resolve to `mahbub@kothabarta.com` (or auto-seed if first time).
  - Provide helper `getUserRole(userId: string): Promise<string>`.

- [ ] **Step 2: Update `src/pages/Login.tsx`**
  - Change input from strict `email` validator to `identifier` (Email or Username).
  - No visual admin button on the form.
  - On successful sign in:
    ```typescript
    const profile = await adminService.getUserProfile(user.id);
    if (profile?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
    ```

- [ ] **Step 3: Implement `src/routes/AdminRoute.tsx`**
  - Verify active user session.
  - Fetch profile `role`.
  - If `role !== 'admin'`, display access denied view with a "Back to Chat" button navigating to `/dashboard`.
  - If `role === 'admin'`, render `<Outlet />`.

- [ ] **Step 4: Register `/admin/*` routes in `src/App.tsx` using `React.lazy`**
  - Code-split all admin components:
    ```typescript
    const AdminLayout = React.lazy(() => import("./layouts/AdminLayout"));
    const AdminOverview = React.lazy(() => import("./pages/admin/AdminOverview"));
    const UserManagement = React.lazy(() => import("./pages/admin/UserManagement"));
    const ContentModeration = React.lazy(() => import("./pages/admin/ContentModeration"));
    const SystemBroadcast = React.lazy(() => import("./pages/admin/SystemBroadcast"));
    ```

- [ ] **Step 5: Commit auth and routing updates**

```bash
git add src/pages/Login.tsx src/services/authService.ts src/routes/AdminRoute.tsx src/App.tsx
git commit -m "feat(auth): add admin role resolution, direct admin redirect and AdminRoute guard"
```

---

### Task 4: Admin Shell Layout & Navigation (`AdminLayout.tsx`)

**Files:**
- Create: `src/layouts/AdminLayout.tsx`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Produces: Responsive sidebar, topbar with "Back to Chat" and theme toggle, and `<Outlet />` for admin sub-pages.

- [ ] **Step 1: Write `src/layouts/AdminLayout.tsx`**
  - Header: Logo (কথাবার্তা Admin), Theme Switcher, "💬 Back to Chat" button navigating to `/dashboard`.
  - Sidebar links:
    - 📊 Overview (`/admin`)
    - 👥 Users (`/admin/users`)
    - 🛡️ Content Moderation (`/admin/moderation`)
    - 📢 Broadcast & Push (`/admin/broadcast`)
  - Mobile drawer with hamburger toggle.
  - Suspense fallback with smooth spinner.

- [ ] **Step 2: Add "🛡️ Admin Panel" navigation shortcut in `src/components/Sidebar.tsx`**
  - Only visible if `currentUser.role === 'admin'`.

- [ ] **Step 3: Commit AdminLayout**

```bash
git add src/layouts/AdminLayout.tsx src/components/Sidebar.tsx
git commit -m "feat(ui): create AdminLayout and chat sidebar admin navigation link"
```

---

### Task 5: Admin Overview Page (`AdminOverview.tsx`)

**Files:**
- Create: `src/pages/admin/AdminOverview.tsx`

**Interfaces:**
- Consumes: `adminService.getStats()`

- [ ] **Step 1: Implement `src/pages/admin/AdminOverview.tsx`**
  - Render 4 stat cards with trend indicators:
    1. Total Users
    2. Active Today
    3. Total Messages
    4. Active Stories
  - Quick Action cards: "Review Flagged Stories", "Broadcast to All Users", "Manage Suspended Users".
  - Recent Signups list with status badges.

- [ ] **Step 2: Commit AdminOverview**

```bash
git add src/pages/admin/AdminOverview.tsx
git commit -m "feat(admin): implement AdminOverview analytics dashboard"
```

---

### Task 6: User Management Page & Modal (`UserManagement.tsx`)

**Files:**
- Create: `src/pages/admin/UserManagement.tsx`

**Interfaces:**
- Consumes: `adminService.getUsers()`, `adminService.updateUserBan()`, `adminService.updateUserRole()`

- [ ] **Step 1: Implement `src/pages/admin/UserManagement.tsx`**
  - Search input with debounce for usernames.
  - Role filter (All, Admin, Moderator, User).
  - Status filter (All, Active, Banned).
  - Responsive data table: Avatar, Username, Role badge, Status badge, Actions.
  - Ban/Unban action modal with reason text area.
  - Role change dropdown with confirmation prompt.

- [ ] **Step 2: Commit UserManagement**

```bash
git add src/pages/admin/UserManagement.tsx
git commit -m "feat(admin): implement UserManagement with search, ban/unban, and role promotion"
```

---

### Task 7: Content & Story Moderation Page (`ContentModeration.tsx`)

**Files:**
- Create: `src/pages/admin/ContentModeration.tsx`

**Interfaces:**
- Consumes: `adminService.getLiveStories()`, `adminService.deleteStory()`, `adminService.getReportedContent()`

- [ ] **Step 1: Implement `src/pages/admin/ContentModeration.tsx`**
  - Tab 1: **Live Stories**:
    - Grid of active 24h stories across all users.
    - Media preview (image thumbnail or video tag), author avatar & username, countdown to expiration.
    - Danger button: "Delete Story" (prompts confirmation, deletes record from DB and deletes media file from Supabase Storage bucket `stories`).
  - Tab 2: **Report Queue**:
    - List of flagged content from `content_reports`.
    - Options to Dismiss, Delete target, or Ban reported user.

- [ ] **Step 2: Commit ContentModeration**

```bash
git add src/pages/admin/ContentModeration.tsx
git commit -m "feat(admin): implement ContentModeration for live stories and reports"
```

---

### Task 8: System Broadcast & Push Announcement Page (`SystemBroadcast.tsx`)

**Files:**
- Create: `src/pages/admin/SystemBroadcast.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `adminService.createAnnouncement()`, `adminService.getAnnouncements()`, `adminService.deleteAnnouncement()`

- [ ] **Step 1: Implement `src/pages/admin/SystemBroadcast.tsx`**
  - Form: Announcement Title, Message Content, Priority/Type (`info`, `warning`, `critical`, `update`), Checkbox: `[x] Send Push Notification to all users`.
  - When submitted, saves to `system_announcements`. If push enabled, calls Supabase Edge Function to deliver FCM notification.
  - Past Announcements history table with 1-click Delete.

- [ ] **Step 2: Implement In-App Announcement Banner in `src/pages/Dashboard.tsx`**
  - On mount, query active announcements.
  - Display non-intrusive dismissible banner at the top of the chat dashboard for active critical or update announcements.

- [ ] **Step 3: Commit SystemBroadcast**

```bash
git add src/pages/admin/SystemBroadcast.tsx src/pages/Dashboard.tsx
git commit -m "feat(admin): implement system broadcast composer and in-app banner"
```

---

### Task 9: Build, Sync, End-to-End Verification & Push

**Files:**
- All touched files

**Verification Steps:**
- [ ] **Step 1: Test TypeScript build**
  ```bash
  npm run build
  ```
  Expected: Clean build with 0 errors, admin chunks code-split into distinct chunk files.

- [ ] **Step 2: Sync native Android project**
  ```bash
  npx cap sync android
  ```
  Expected: Web assets successfully updated in `android/app/src/main/assets/public`.

- [ ] **Step 3: Run comprehensive validation checklist**
  1. Test login with `username: mahbub` & `password: mahbub` -> Direct navigation to `/admin`.
  2. Test login with regular user -> Navigation to `/dashboard`.
  3. Verify non-admin accessing `/admin` -> "Access Denied" view with "Back to Chat" button.
  4. Verify Admin Overview stats render correctly.
  5. Verify User Management search, filter, and ban actions.
  6. Verify Content Moderation live stories view and delete action.
  7. Verify System Broadcast announcement creation.

- [ ] **Step 4: Commit and push to GitHub**
  ```bash
  git push origin main
  ```
