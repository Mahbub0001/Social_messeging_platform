# কথাবার্তা (Kotha Barta) — Premium Real-Time Messaging Platform

[![Vite](https://img.shields.io/badge/Vite-8.0.12-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2.6-61DAFB?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-JS_Client-3ECF8E?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4.19-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)](https://tailwindcss.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Peer--to--Peer-F3702A?logo=webrtc&logoColor=white&style=flat-square)](https://webrtc.org/)

**কথাবার্তা (Kotha Barta)** is a state-of-the-art, full-stack real-time messaging application built with React, Vite, Tailwind CSS, and Supabase. The platform provides secure, instant communications including DMs, group channels, document sharing, voice messaging, WebRTC calling (audio/video), and a fluid, responsive UI customized for desktop and mobile viewports.

---

## 🚀 Key Features

*   💬 **Real-Time Text Messaging**: Powered by Supabase Realtime socket events for sub-second text delivery.
*   👥 **Group Chat Rooms**: Create, configure, and communicate in multi-user group spaces.
*   📞 **Voice & Video Calls**: Native peer-to-peer audio and video calling powered by WebRTC, utilizing Supabase Realtime as a signaling server.
*   📁 **Media & File Attachments**: Drag-and-drop or select files (images, audio clips, PDFs) stored directly in Supabase Storage buckets.
*   🎙️ **Voice Messaging**: Record, cancel, preview, and send audio voice clips using native audio APIs.
*   📱 **Buttery-Smooth Mobile Responsiveness**: Perfect sliding transitions (between conversation lists and threads) and touch-compatible actions drawer triggers (tap to react, reply, edit, or delete messages).
*   🎭 **WhatsApp-Style Emoji Reactions**: Instantly react to any message using standard emojis (👍, ❤️, 😂, 🔥).
*   🤖 **Interactive Quick Demo**: Built-in mock mode with an automated chat bot ("কথাবার্তা বট") that answers questions and auto-answers voice/video calls instantly for direct evaluation.
*   ☀️ **Dark & Light Mode**: Fluid dark-to-light theme switcher with customized HSL color maps.

---

## 🛠️ Technology Stack

*   **Frontend Framework**: React 19 + TypeScript + Vite (Fast Bundling)
*   **State Management**: Zustand (Global Store with Optimistic UI updates)
*   **Database & Auth**: Supabase (PostgreSQL tables, Row-Level Security, Google/OAuth)
*   **Signaling & Real-Time Sync**: Supabase Channels (Presence tracking, typing indicators, call handshakes)
*   **Styling & Motion**: Tailwind CSS + Framer Motion (Transitions, backdrops, layouts)
*   **Form Validation**: React Hook Form + Zod resolvers
*   **Calling Protocol**: WebRTC API (RTCPeerConnection, STUN channels, MediaStreams)

---

## 📦 Database Setup (Supabase)

To link your own Supabase database backend, follow these steps:

1.  **Run SQL Schema**: Paste and run the database definitions and security policies from the [schema.sql](file:///e:/Projects/web%20projects/Chat_web_app/schema.sql) file in your Supabase SQL Editor. This initializes:
    *   `profiles`, `conversations`, `conversation_members`, `messages`, `message_reactions`, and `friend_requests` tables.
    *   Row-Level Security (RLS) policies guaranteeing privacy and access control.
2.  **Storage Buckets Setup**: Create a public bucket in your Supabase storage dashboard named `chat-media`. Ensure the public select and authenticated insert policies are active.
3.  **Real-Time Broadcasts**: Enable Realtime on the `messages` table in your Supabase Replication dashboard to support message notifications and updates.

---

## 🔧 Installation & Configuration

### 1. Clone the project and install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

*Note: If these variables are empty or missing, the application automatically boots into **Mock Mode (Quick Demo)**, simulating database writes locally using LocalStorage.*

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 📂 Project Architecture

```
src/
├── assets/          # Static branding icons
├── components/      # UI components (ChatArea, Sidebar, CallScreen, Panels)
├── hooks/           # useStore (Zustand Global State Management)
├── layouts/         # Page wrappers (AuthLayout, protected page guards)
├── lib/             # API initializations (Supabase configurations)
├── pages/           # Pages (Landing, Dashboard, Login, Register)
├── routes/          # Navigation paths (Protected routes definitions)
├── services/        # Backend connectors (authService, chatService, callService)
├── utils/           # Utilities (Audio synthesizer, style merging helper)
└── index.css        # Core tailwind setup & custom theme color maps
```

---

## 🛡️ Security Model

The application enforces strict data privacy models:
*   **Row Level Security (RLS)**: Conversations and messages are restricted so they are only viewable by verified members of that channel.
*   **Authentication Gates**: Protected routes block direct access to dashboard spaces without an active Supabase session token.
*   **Encrypted WebRTC Media**: Communication streams are encrypted end-to-end natively through RTC peer configurations.
