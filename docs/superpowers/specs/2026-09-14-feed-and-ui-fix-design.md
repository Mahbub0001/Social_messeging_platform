# Design Specification: UI Fix & Twitter-Style Social Feed System

**Date:** 2026-09-14  
**Author:** Antigravity AI (Pair Programming with User)  
**Status:** Approved by User (Pending Spec Review)  

---

## 1. Overview & Objectives

This specification addresses two key requirements:
1. **Dashboard & Sidebar Header UI Fix:**
   - Resolve the header action button overflow where icons (Admin Shield, LogOut) spill past the sidebar border into the chat area.
   - Increase sidebar width from `320px` to `360px` on desktop for a spacious, modern appearance.
   - Consolidate secondary actions (Admin Panel, Profile Settings, Logout) into an elegant, animated profile dropdown menu.
   - Add a prominent, responsive mode switcher: **[ 💬 চ্যাট (Chats) ]** and **[ ✨ ফিড (Feed) ]** at the top of the sidebar and in a mobile bottom navigation bar.

2. **Twitter/X-Style Social "Feed" Feature:**
   - **Post Composer:** Users can share rich text (with hashtags/mentions), multiple images, and HTML5 video files.
   - **Interactive Post Cards:** Display author profile, badges, formatted relative timestamps, post content, media gallery, and engagement statistics.
   - **Animated Reactions System (Love ❤️, Wow 😮, Sad 😢, Angry 😡, Like 👍):**
     - **Desktop Web Hover:** Floating glassmorphic reaction dock with spring physics; hovering over each emoji triggers a 1.5x scale bounce with Bengali tooltip labels.
     - **Mobile Long Press:** Holding the reaction button (>350ms) triggers haptic feedback (`navigator.vibrate`) and pops up the reaction dock with touch-drag selection.
     - **Quick Tap:** Instantly toggles the primary reaction (Love ❤️).
   - **1-Click Share System:**
     - **Repost to Feed:** Creates a retweet-style repost attributed to the reposter.
     - **Send to Chat:** Allows picking any active chat room to send a post preview snippet and link directly.
     - **Copy Link:** Copies link with an instant toast notification.
   - **Post Comments:** Expandable discussion drawer/sheet on each post.
   - **Realtime & Offline-First:** Fully integrated with Supabase with seamless automatic fallback to `mockDb` / `localStorage`.

---

## 2. UI Fix: Sidebar Header Redesign

### 2.1 Problem Analysis
In `Sidebar.tsx`, 6 individual action buttons (`Sun/Moon`, `UserPlus`, `Clock`, `Settings`, `Shield`, `LogOut`) are rendered side-by-side with `gap-1.5` and `p-2` inside a fixed `md:w-[320px]` container. With the brand logo on the left, the available width is insufficient, causing `Shield` and `LogOut` to wrap or overflow past the border line into the main chat window.

### 2.2 Solution Architecture
1. **Sidebar Dimension Adjustment:** Update `md:w-[320px]` to `md:w-[360px] lg:w-[380px]`.
2. **Header Layout Reorganization:**
   - **Top Brand Row:**
     - Left: Logo icon + "কথাবার্তা" brand name.
     - Right: Theme toggle (`Sun/Moon`), Friends request badge (`UserPlus`), and Profile Menu Trigger (user avatar with online indicator).
   - **Mode Switcher Tab Bar (Chats vs Feed):**
     - Placed right below the top row:
       - **[ 💬 চ্যাট (Chats) ]** (with unread badge counter).
       - **[ ✨ ফিড (Feed) ]** (with sparkle indicator).
     - Switching between tabs toggles `currentView: "chat" | "feed"`.
   - **Profile Dropdown Menu:**
     - Clicking the user avatar opens a sleek floating dropdown containing:
       - User profile summary (Username, status).
       - "প্রোফাইল সেটিংস (Profile Settings)".
       - "স্টোরিজ ও আর্কাইভ (Stories & Archive)".
       - "অ্যাডমিন প্যানেল (Admin Panel)" (visible only to admins).
       - "লগ আউট (Sign Out)" with confirmation.

---

## 3. "Feed" Feature Architecture

### 3.1 Component Hierarchy
```
src/components/feed/
├── FeedView.tsx             # Main container: sticky header, filter tabs, feed list
├── CreatePostCard.tsx       # Rich composer: text, image/video dropzone, preview, emojis
├── PostCard.tsx             # Post container: author info, media player/grid, actions
├── ReactionPicker.tsx       # Floating animated reaction dock (hover + long-press)
├── ShareModal.tsx           # Share modal (repost to feed, send to chat, copy link)
└── PostCommentsModal.tsx    # Slide-over comments drawer with live comment input
```

### 3.2 Data Models

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
  author: {
    id: string;
    username: string;
    avatar_url?: string | null;
  };
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
  reactions: Record<string, FeedReaction[]>; // { love: [...], wow: [...], ... }
  userReaction?: "love" | "wow" | "sad" | "angry" | "like" | null;
  sharesCount: number;
  repostedFrom?: FeedPost | null;
  commentsCount: number;
}
```

---

## 4. Reaction System Specifications

### 4.1 Reaction Types
- ❤️ **Love (`love`)**: `label: "ভালোবাসা"`, `color: "#ef4444"`, emoji: "❤️"
- 😮 **Wow (`wow`)**: `label: "অবাক"`, `color: "#f59e0b"`, emoji: "😮"
- 😢 **Sad (`sad`)**: `label: "কষ্ট"`, `color: "#3b82f6"`, emoji: "😢"
- 😡 **Angry (`angry`)**: `label: "রাগ"`, `color: "#ea580c"`, emoji: "😡"
- 👍 **Like (`like`)**: `label: "পছন্দ"`, `color: "#6366f1"`, emoji: "👍"

### 4.2 Desktop Hover Interaction
- Triggered by `onMouseEnter` with a 200ms debounce.
- Floating pill appears `12px` above the reaction button using `framer-motion`:
  ```typescript
  initial={{ opacity: 0, y: 10, scale: 0.8 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: 10, scale: 0.8 }}
  transition={{ type: "spring", stiffness: 450, damping: 20 }}
  ```
- Hovering individual emoji:
  - Scale up to `1.45x` with `y: -8px`.
  - Tooltip bubble with smooth spring pop above the active emoji.

### 4.3 Mobile Long-Press Interaction
- `onTouchStart`: Starts a 350ms timer. If touch remains active without scrolling, it cancels the tap, triggers haptic feedback (`navigator.vibrate?.([25])`), and reveals the animated reaction dock.
- Touch drag: Calculates coordinates relative to emoji items to highlight the active emoji.
- `onTouchEnd`: Selects the highlighted reaction or dismisses the dock.
- Single short tap: Toggles the primary reaction (`love`).

---

## 5. Share System Specifications

1. **Repost to Feed:**
   - Calls `feedService.repost(originalPostId, currentUserId)`.
   - Creates a new post with `repostedFrom = originalPost`.
   - Increments `sharesCount` of the original post.
2. **Send to Chat:**
   - Displays modal list of user's active conversations.
   - Selecting a conversation formats a rich snippet:
     `"📌 [User]-এর পোস্ট:\n\"[Snippet]...\"\n[Post Link]"`
   - Uses `chatService.sendMessage(conversationId, currentUserId, snippet)`.
   - Displays success notification "চ্যাটে পাঠানো হয়েছে!".
3. **Copy Link:**
   - Writes URL `${window.location.origin}/dashboard?post=${postId}` to clipboard.
   - Shows feedback tooltip/toast "লিংক কপি করা হয়েছে!".

---

## 6. Storage & Service Layer

- **`feedService.ts`**:
  - `getPosts(filter: "all" | "my" | "media")`: Retrieves feed posts.
  - `createPost(content, mediaFiles, mediaType)`: Uploads media via `storageService.uploadMedia` and inserts post.
  - `toggleReaction(postId, userId, reactionType)`: Adds/removes/updates reaction.
  - `deletePost(postId, userId)`: Deletes post (author or admin only).
  - `repost(postId, userId)`: Reposts to user's feed.
  - `addComment(postId, userId, content)`: Inserts a comment.
  - `getComments(postId)`: Fetches comments for a post.
- **Offline & Mock Support:**
  - Persists all posts, comments, and reactions to `localStorage` under `kb_feed_posts_v1`.
  - Seamlessly bridges to Supabase `feed_posts`, `feed_reactions`, `feed_comments` when database tables are present.

---

## 7. Verification & Testing Plan

1. **Visual Alignment Verification:**
   - Verify sidebar header buttons no longer overflow at any screen width (desktop 1920px, 1366px, tablet 768px, mobile 375px).
   - Test profile dropdown opening, clicking outside to dismiss, and smooth animations.
2. **Feed Functionality Testing:**
   - Create post with text only.
   - Create post with image(s).
   - Create post with video (verify HTML5 video player playback, mute, fullscreen).
   - Desktop hover on reaction button -> verify spring animation and tooltip labels.
   - Mobile touch long-press -> verify animated pop, haptic response, and reaction selection.
   - Verify reaction count increments and multiple reaction icons (e.g. ❤️😮) display correctly.
   - Repost to feed -> verify attribution header.
   - Share to chat -> verify message appears in selected conversation.
   - Comments -> write a comment and verify instant addition to thread.
3. **Build & Sync:**
   - Run `npm run build` to verify 0 TypeScript/JSX errors.
   - Run `npx cap sync android` to ensure mobile web assets are updated.
   - Push to `origin/main`.
