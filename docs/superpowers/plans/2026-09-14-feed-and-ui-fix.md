# UI Fix & Twitter-Style Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dashboard sidebar header icon overflow bug and build an interactive, professional Twitter/X-style Social Feed featuring text/image/video posting, animated reactions (hover on web, long-press on mobile), and 1-click sharing (repost, send to chat, copy link).

**Architecture:** 
- A dedicated `feedService` manages posts, reactions, comments, and shares with Supabase integration and offline `localStorage` fallback.
- Modular React components (`FeedView`, `CreatePostCard`, `PostCard`, `ReactionPicker`, `ShareModal`, `PostCommentsModal`) handle the UI with `framer-motion` for fluid spring physics.
- `Sidebar.tsx` and `Dashboard.tsx` are refactored to eliminate icon spillover, widen the desktop sidebar to `360px`, and introduce a dual-mode navigation switcher for **[ 💬 চ্যাট ]** and **[ ✨ ফিড ]**.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Supabase, Capacitor Android.

## Global Constraints
- Desktop sidebar width: `360px` (`md:w-[360px] lg:w-[380px]`).
- Zero button overflow past the sidebar boundary.
- Emojis supported: Love ❤️ (`love`), Wow 😮 (`wow`), Sad 😢 (`sad`), Angry 😡 (`angry`), Like 👍 (`like`).
- Web: hover popup dock with `scale: 1.45` bounce and Bengali tooltips.
- Mobile: touch long-press (>350ms) with haptic feedback (`navigator.vibrate`) and drag-to-pick.
- Share options: Repost to Feed, Send directly to active Chat conversation, Copy Link.
- Clean build: `npm run build` with 0 TypeScript/lint errors.

---

### Task 1: Feed Service & Data Models

**Files:**
- Create: `src/services/feedService.ts`
- Modify: `src/services/mockDb.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface FeedReaction {
    userId: string;
    username: string;
    reactionType: "love" | "wow" | "sad" | "angry" | "like";
    createdAt: string;
  }
  export interface FeedComment {
    id: string;
    postId: string;
    userId: string;
    author: { id: string; username: string; avatar_url?: string | null };
    content: string;
    createdAt: string;
  }
  export interface FeedPost {
    id: string;
    userId: string;
    author: {
      id: string;
      username: string;
      avatar_url?: string | null;
      bio?: string | null;
      role?: "admin" | "user";
    };
    content: string;
    mediaUrls: string[];
    mediaType: "none" | "image" | "video";
    createdAt: string;
    reactions: Record<string, FeedReaction[]>;
    userReaction?: "love" | "wow" | "sad" | "angry" | "like" | null;
    sharesCount: number;
    repostedFrom?: FeedPost | null;
    commentsCount: number;
  }
  ```

- [ ] **Step 1: Write `src/services/feedService.ts`** with local storage fallback and Supabase table query support.
- [ ] **Step 2: Add initial mock posts in `feedService.ts`** so new users see engaging Bengali and English posts upon opening the Feed for the first time.
- [ ] **Step 3: Verify TypeScript compilation** using `npx tsc --noEmit`.
- [ ] **Step 4: Commit:**
  ```bash
  git add src/services/feedService.ts
  git commit -m "feat(feed): implement feedService with offline-first persistence"
  ```

---

### Task 2: Animated Reaction Picker Component

**Files:**
- Create: `src/components/feed/ReactionPicker.tsx`

**Interfaces:**
- Consumes: `FeedReaction`, reaction type definition.
- Props:
  ```typescript
  interface ReactionPickerProps {
    currentReaction?: "love" | "wow" | "sad" | "angry" | "like" | null;
    onSelectReaction: (type: "love" | "wow" | "sad" | "angry" | "like") => void;
    onToggleDefault: () => void;
  }
  ```

- [ ] **Step 1: Create `ReactionPicker.tsx`** with:
  - Reactions: Love ❤️, Wow 😮, Sad 😢, Angry 😡, Like 👍.
  - Desktop hover detection with spring floating dock (`framer-motion`).
  - Individual emoji hover bounce (`scale: 1.45`, `y: -8px`) with tooltip badge ("ভালোবাসা", "অবাক", "কষ্ট", "রাগ", "পছন্দ").
  - Mobile touch handlers (`onTouchStart` > 350ms, `navigator.vibrate`, drag selection on `onTouchMove`, selection on `onTouchEnd`).
  - Quick tap triggers `onToggleDefault()`.
- [ ] **Step 2: Verify component imports & styling.**
- [ ] **Step 3: Commit:**
  ```bash
  git add src/components/feed/ReactionPicker.tsx
  git commit -m "feat(feed): add animated reaction picker with web hover and mobile long-press"
  ```

---

### Task 3: Post Creation Composer Component

**Files:**
- Create: `src/components/feed/CreatePostCard.tsx`

**Interfaces:**
- Consumes: `feedService.createPost`, `storageService.uploadMedia`, `useStore.user`.
- Props:
  ```typescript
  interface CreatePostCardProps {
    onPostCreated: (newPost: FeedPost) => void;
  }
  ```

- [ ] **Step 1: Create `CreatePostCard.tsx`** with:
  - User avatar and auto-expanding textarea (`"কী ভাবছেন, [Username]? কিছু শেয়ার করুন..."`).
  - Image file picker (multi-image support, image grid preview with remove button).
  - Video file picker (video preview with play/pause and remove button).
  - Emoji picker button.
  - Character count indicator and "পোস্ট করুন (Post)" button with loading spinner.
- [ ] **Step 2: Connect file upload** using `storageService.uploadMedia(file, "chat-media")`.
- [ ] **Step 3: Commit:**
  ```bash
  git add src/components/feed/CreatePostCard.tsx
  git commit -m "feat(feed): create rich post composer supporting text, image gallery, and video"
  ```

---

### Task 4: Post Card with Media Gallery & Video Player

**Files:**
- Create: `src/components/feed/PostCard.tsx`

**Interfaces:**
- Consumes: `FeedPost`, `ReactionPicker`, `feedService.toggleReaction`.
- Props:
  ```typescript
  interface PostCardProps {
    post: FeedPost;
    currentUserId?: string;
    onReaction: (postId: string, reaction: "love" | "wow" | "sad" | "angry" | "like") => void;
    onShare: (post: FeedPost) => void;
    onOpenComments: (post: FeedPost) => void;
    onDeletePost?: (postId: string) => void;
  }
  ```

- [ ] **Step 1: Create `PostCard.tsx`** with:
  - Author header: Avatar, username, `@handle`, relative timestamp in Bengali/English, admin badge.
  - Repost header: `"🔄 [Name] রিশেয়ার করেছেন"` if `post.repostedFrom` is present.
  - Content parser: Text with styled `#hashtags` and `@mentions`.
  - Media display:
    - Images: Responsive grid (1 image full width, 2 images side-by-side, 3+ images grid) with click-to-zoom lightbox.
    - Video: HTML5 video player with rounded corners, play/pause, sound toggle, and timeline controls.
  - Reaction summary pill: Top emoji icons + total count (e.g. `❤️😮 14`).
  - Interactive Action Bar:
    - Animated `ReactionPicker` button.
    - Comment button with count.
    - Share button with count.
    - Three-dots menu (Delete post for author/admin, Copy link).
- [ ] **Step 2: Commit:**
  ```bash
  git add src/components/feed/PostCard.tsx
  git commit -m "feat(feed): create interactive PostCard with rich media and engagement bar"
  ```

---

### Task 5: Share Modal & Comments Drawer

**Files:**
- Create: `src/components/feed/ShareModal.tsx`
- Create: `src/components/feed/PostCommentsModal.tsx`

**Interfaces:**
- Consumes: `feedService.repost`, `feedService.addComment`, `feedService.getComments`, `chatService.sendMessage`, `useStore.conversations`.

- [ ] **Step 1: Build `ShareModal.tsx`**:
  - Modal with 3 share options:
    1. **"ফিডে রিশেয়ার (Repost to Feed)"** -> Creates repost and notifies feed.
    2. **"ইনবক্সে পাঠান (Send to Chat)"** -> Displays list of active conversations. Selecting one posts snippet to chat via `chatService.sendMessage`.
    3. **"লিংক কপি করুন (Copy Link)"** -> Copies URL to clipboard with confirmation toast.
- [ ] **Step 2: Build `PostCommentsModal.tsx`**:
  - Slide-over or modal drawer displaying post comments.
  - Comment input box with send button and auto-scroll to bottom.
- [ ] **Step 3: Commit:**
  ```bash
  git add src/components/feed/ShareModal.tsx src/components/feed/PostCommentsModal.tsx
  git commit -m "feat(feed): add 1-click share modal and comments drawer"
  ```

---

### Task 6: Main Feed View (`FeedView.tsx`)

**Files:**
- Create: `src/components/feed/FeedView.tsx`

**Interfaces:**
- Consumes: `CreatePostCard`, `PostCard`, `ShareModal`, `PostCommentsModal`, `feedService`.

- [ ] **Step 1: Build `FeedView.tsx`**:
  - Sticky glassmorphic top header:
    - Brand/Title: `"কমিউনিটি ফিড (Feed)"`.
    - Filter tabs: `[ 🌐 সকল পোস্ট (All) ]`, `[ 👤 আমার পোস্ট (My Posts) ]`, `[ 🎬 মিডিয়া (Media) ]`.
    - Refresh button.
  - Mounts `CreatePostCard` at the top.
  - Timeline list of `PostCard` items.
  - Handles state for `ShareModal` and `PostCommentsModal`.
  - Empty state with friendly illustration if no posts match filter.
- [ ] **Step 2: Commit:**
  ```bash
  git add src/components/feed/FeedView.tsx
  git commit -m "feat(feed): build FeedView container with filter tabs and timeline"
  ```

---

### Task 7: UI Header Fix & Navigation Integration in `Sidebar.tsx` and `Dashboard.tsx`

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Fixes the bug in screenshot `media_1789386328417.png` where icons spill over the sidebar border into the chat area.
- Adds `activeView: "chat" | "feed"` state to `Dashboard.tsx`.
- Increases sidebar width from `320px` to `360px` (`md:w-[360px] lg:w-[380px]`).

- [ ] **Step 1: Refactor `Sidebar.tsx`**:
  - Top row:
    - Left: Brand icon + "কথাবার্তা".
    - Right: Theme toggle (`Sun/Moon`), Friends badge (`UserPlus`), User Avatar Menu trigger.
  - User Avatar Menu (Floating Dropdown):
    - Profile Settings (`Settings`).
    - Stories & Archive (`Clock`).
    - Admin Panel (`Shield`, shown only to admins).
    - Sign Out (`LogOut`).
    - *Result: Zero icon overflow at any screen resolution.*
  - Mode Switcher:
    - Prominent segmented control right under header:
      - **[ 💬 বার্তা (Chats) ]**
      - **[ ✨ ফিড (Feed) ]**
    - Clicking toggles between chat list view and feed view.
- [ ] **Step 2: Update `Dashboard.tsx`**:
  - Manage `activeView` state (`"chat" | "feed"`).
  - When `activeView === "feed"`: render `FeedView` in the main container.
  - When `activeView === "chat"`: render active chat or empty chat placeholder.
  - Mobile bottom navigation bar:
    - 💬 চ্যাট (Chats)
    - ✨ ফিড (Feed)
    - 👥 ফ্রেন্ডস (Friends)
    - 👤 সেটিংস (Profile)
- [ ] **Step 3: Commit:**
  ```bash
  git add src/components/Sidebar.tsx src/pages/Dashboard.tsx
  git commit -m "fix(ui): resolve header icon overflow, widen sidebar, and integrate feed navigation"
  ```

---

### Task 8: Verification, Production Build & Deployment

**Files:**
- All touched files

- [ ] **Step 1: Test TypeScript build** with `npm run build`.
- [ ] **Step 2: Sync Capacitor assets** with `npx cap sync android`.
- [ ] **Step 3: Verify git status and diff.**
- [ ] **Step 4: Push to `origin/main`:**
  ```bash
  git push origin main
  ```
