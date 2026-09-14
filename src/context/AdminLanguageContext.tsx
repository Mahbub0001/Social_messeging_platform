import React, { createContext, useContext, useState } from "react";

export type AdminLanguage = "bn" | "en";

interface AdminLanguageContextType {
  language: AdminLanguage;
  setLanguage: (lang: AdminLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<AdminLanguage, Record<string, string>> = {
  bn: {
    // Nav & Layout
    "nav.overview": "ড্যাশবোর্ড",
    "nav.users": "ইউজার ম্যানেজমেন্ট",
    "nav.moderation": "স্টোরি ও কন্টেন্ট মডারেশন",
    "nav.broadcast": "সিস্টেম ব্রডকাস্ট",
    "nav.backToChat": "চ্যাটে ফিরে যান",
    "nav.adminRole": "সিস্টেম এডমিন",
    "nav.systemOnline": "সিস্টেম সচল ও সুরক্ষিত",
    "nav.adminControl": "সিস্টেম কন্ট্রোল সেন্টার",
    "nav.logout": "লগআউট",
    "nav.themeToggle": "থিম পরিবর্তন",
    "nav.switchLang": "English",

    // Overview Page
    "overview.welcome": "স্বাগতম, প্ল্যাটফর্ম এডমিনিস্ট্রেটর",
    "overview.subtitle": "কথাবার্তা মেসেজিং সিস্টেমের সম্পূর্ণ নিয়ন্ত্রণ, মডারেশন এবং অ্যানালিটিক্স প্যানেল।",
    "overview.refresh": "রিফ্রেশ করুন",
    "overview.totalUsers": "মোট ইউজার (Total Users)",
    "overview.totalUsersSub": "প্ল্যাটফর্মে নিবন্ধিত সর্বমোট একাউন্ট",
    "overview.dau": "দৈনিক সক্রিয় ইউজার (DAU)",
    "overview.dauSub": "গত ২৪ ঘণ্টায় সক্রিয় ছিলেন",
    "overview.messages": "মোট বার্তা আদান-প্রদান",
    "overview.messagesSub": "প্ল্যাটফর্মের সর্বমোট মেসেজ",
    "overview.stories": "বর্তমান লাইভ স্টোরি",
    "overview.storiesSub": "২৪ ঘণ্টার সক্রিয় গল্পসমূহ",
    "overview.quickActions": "কুইক অ্যাকশন",
    "overview.manage": "ম্যানেজ করুন",
    "overview.moderate": "মডারেট করুন",
    "overview.broadcast": "ব্রডকাস্ট করুন",
    "overview.recentUsers": "সাম্প্রতিক নিবন্ধিত ইউজারগণ",
    "overview.viewAll": "সকল ইউজার দেখুন",
    "overview.joined": "যুক্ত হয়েছেন",
    "overview.noRecentUsers": "কোনো নতুন ইউজার পাওয়া যায়নি।",

    // Analytics Charts
    "chart.activityTitle": "ইউজার অ্যাক্টিভিটি ও গ্রোথ ট্রেন্ড",
    "chart.activitySubtitle": "প্ল্যাটফর্মে দৈনিক সক্রিয় ইউজার ও নতুন সাইন-আপের তুলনামূলক চিত্র",
    "chart.days7": "৭ দিন",
    "chart.days14": "১৪ দিন",
    "chart.days30": "৩০ দিন",
    "chart.activeUsers": "সক্রিয় ইউজার",
    "chart.newSignups": "নতুন সাইনআপ",
    "chart.messagesTitle": "দৈনিক মেসেজ ভলিউম ট্রাফিক",
    "chart.messagesSubtitle": "প্রতিদিন প্রেরিত টেক্সট, ছবি ও কল লগ রেকর্ডস",
    "chart.totalMessages": "মোট মেসেজ",
    "chart.statusTitle": "ইউজার স্ট্যাটাস ও রোল বণ্টন",
    "chart.statusSubtitle": "মোট ইউজারের অ্যাক্টিভ, সাসপেন্ডেড ও অ্যাডমিন অনুপাত",
    "chart.active": "সক্রিয়",
    "chart.banned": "স্থগিত (Banned)",
    "chart.admins": "অ্যাডমিন",
    "chart.percentage": "শতকরা",

    // User Management
    "users.title": "ইউজার ম্যানেজমেন্ট ও এক্সেস কন্ট্রোল",
    "users.subtitle": "সকল ব্যবহারকারীর তথ্য পর্যালোচনা, অ্যাকাউন্ট ব্যান/আনব্যান ও স্থায়ীভাবে অ্যাকাউন্ট অপসারণ করুন।",
    "users.searchPlaceholder": "ইউজারনেম দিয়ে খুঁজুন...",
    "users.allRoles": "সকল রোল",
    "users.admins": "অ্যাডমিনগণ",
    "users.regularUsers": "সাধারণ ইউজার",
    "users.allStatus": "সকল স্ট্যাটাস",
    "users.activeOnly": "সক্রিয় একাউন্ট",
    "users.bannedOnly": "স্থগিত (Banned)",
    "users.tableUser": "ব্যবহারকারী",
    "users.tableRole": "রোল",
    "users.tableStatus": "স্ট্যাটাস",
    "users.tableLastSeen": "সর্বশেষ দেখা",
    "users.tableActions": "অ্যাকশন",
    "users.unban": "আনব্যান করুন",
    "users.ban": "ব্যান করুন",
    "users.delete": "মুছে ফেলুন",
    "users.online": "অনলাইন",
    "users.active": "সক্রিয়",
    "users.suspended": "স্থগিত",
    "users.noUsers": "কোনো ব্যবহারকারী পাওয়া যায়নি।",

    // Ban Modal
    "modal.banTitle": "অ্যাকাউন্ট স্থগিত / ব্যান নিশ্চিতকরণ",
    "modal.banReasonPrompt": "ব্যান করার সুনির্দিষ্ট কারণ লিখুন (এটি ব্যবহারকারী সরাসরি নোটিফিকেশনে দেখতে পাবে):",
    "modal.banPlaceholder": "যেমন: আপত্তিকর বা অনুপযুক্ত বার্তা প্রদান...",
    "modal.confirmBan": "হ্যাঁ, ব্যান করুন",
    "modal.cancel": "বাতিল",

    // Delete Modal
    "modal.deleteTitle": "ইউজার স্থায়ীভাবে অপসারণ (Permanent Delete)",
    "modal.deleteWarning": "সতর্কবার্তা: এই কাজটি অপরিবর্তনীয়! এই ইউজারকে মুছে ফেললে তার সকল মেসেজ, চ্যাট হিস্ট্রি, স্টোরি ও অ্যাকাউন্ট সরাসরি ডাটাবেজ থেকে চিরতরে মুছে যাবে।",
    "modal.confirmDelete": "হ্যাঁ, সম্পূর্ণ মুছে ফেলুন",

    // Content Moderation
    "mod.title": "লাইভ কন্টেন্ট ও স্টোরি মডারেশন",
    "mod.subtitle": "প্ল্যাটফর্মে আপলোড হওয়া সকল সক্রিয় ২৪ ঘণ্টার স্টোরি পর্যালোচনা করুন এবং নিয়মনীতি বহির্ভূত কন্টেন্ট মুছে দিন।",
    "mod.liveStories": "লাইভ স্টোরিজ",
    "mod.reports": "ইউজার রিপোর্টসমূহ",
    "mod.deleteStory": "স্টোরি মুছুন",
    "mod.noStories": "বর্তমানে কোনো সক্রিয় লাইভ স্টোরি নেই।",
    "mod.noReports": "কোনো পেন্ডিং রিপোর্ট পাওয়া যায়নি।",
    "mod.confirmDeleteStory": "আপনি কি নিশ্চিতভাবে এই স্টোরিটি ডাটাবেজ ও স্টোরেজ থেকে মুছে ফেলতে চান?",

    // System Broadcast
    "broadcast.title": "সিস্টেম ব্রডকাস্ট ও পুশ নোটিফিকেশন",
    "broadcast.subtitle": "প্ল্যাটফর্মের সকল ব্যবহারকারীর কাছে একযোগে নোটিশ ব্যানার এবং মোবাইল পুশ নোটিফিকেশন পাঠান।",
    "broadcast.create": "নতুন গ্লোবাল ঘোষণা তৈরি করুন",
    "broadcast.formTitle": "ঘোষণার শিরোনাম (Title)",
    "broadcast.titlePlaceholder": "যেমন: সার্ভার মেইনটেন্যান্স বা নতুন ফিচার আপডেট...",
    "broadcast.category": "ক্যাটাগরি / গুরুত্ব স্তর",
    "broadcast.info": "তথ্যমূলক (Info)",
    "broadcast.warning": "সতর্কবার্তা (Warning)",
    "broadcast.critical": "জরুরি নোটিশ (Critical)",
    "broadcast.update": "আপডেট (Update)",
    "broadcast.content": "ঘোষণার মূল বার্তা (Announcement Details)",
    "broadcast.contentPlaceholder": "বিস্তারিত ঘোষণা এখানে লিখুন...",
    "broadcast.pushToggle": "সবার ফোনে সরাসরি পুশ নোটিফিকেশন পাঠান",
    "broadcast.pushSub": "FCM সার্ভিসের মাধ্যমে মোবাইল ব্যবহারকারীদের কাছে রিয়েল-টাইমে পৌঁছাবে।",
    "broadcast.submit": "ঘোষণা প্রকাশ ও ব্রডকাস্ট করুন",
    "broadcast.publishing": "প্রকাশ করা হচ্ছে...",
    "broadcast.history": "পূর্ববর্তী ঘোষণা ইতিহাস",
    "broadcast.noHistory": "কোনো পূর্ববর্তী ঘোষণা পাওয়া যায়নি।",
    "broadcast.deleteConfirm": "আপনি কি নিশ্চিতভাবে এই ঘোষণাটি মুছে ফেলতে চান?",
  },
  en: {
    // Nav & Layout
    "nav.overview": "Dashboard",
    "nav.users": "User Management",
    "nav.moderation": "Content Moderation",
    "nav.broadcast": "System Broadcast",
    "nav.backToChat": "Back to Chat",
    "nav.adminRole": "System Admin",
    "nav.systemOnline": "System Online & Secure",
    "nav.adminControl": "System Control Center",
    "nav.logout": "Logout",
    "nav.themeToggle": "Toggle Theme",
    "nav.switchLang": "বাংলা",

    // Overview Page
    "overview.welcome": "Welcome, Platform Administrator",
    "overview.subtitle": "Complete control, moderation, and analytics panel for Kotha Barta Messaging System.",
    "overview.refresh": "Refresh",
    "overview.totalUsers": "Total Users",
    "overview.totalUsersSub": "Total registered platform accounts",
    "overview.dau": "Daily Active Users (DAU)",
    "overview.dauSub": "Active in the last 24 hours",
    "overview.messages": "Total Messages Exchanged",
    "overview.messagesSub": "Lifetime platform messages",
    "overview.stories": "Current Live Stories",
    "overview.storiesSub": "Active 24h ephemeral stories",
    "overview.quickActions": "Quick Actions",
    "overview.manage": "Manage",
    "overview.moderate": "Moderate",
    "overview.broadcast": "Broadcast",
    "overview.recentUsers": "Recently Registered Users",
    "overview.viewAll": "View All Users",
    "overview.joined": "Joined",
    "overview.noRecentUsers": "No recent users found.",

    // Analytics Charts
    "chart.activityTitle": "User Activity & Growth Trend",
    "chart.activitySubtitle": "Comparative view of daily active users and new sign-ups",
    "chart.days7": "7 Days",
    "chart.days14": "14 Days",
    "chart.days30": "30 Days",
    "chart.activeUsers": "Active Users",
    "chart.newSignups": "New Signups",
    "chart.messagesTitle": "Daily Message Volume Traffic",
    "chart.messagesSubtitle": "Daily text, photo and call log records exchanged",
    "chart.totalMessages": "Total Messages",
    "chart.statusTitle": "User Status & Role Distribution",
    "chart.statusSubtitle": "Proportion of active, suspended and admin accounts",
    "chart.active": "Active",
    "chart.banned": "Suspended (Banned)",
    "chart.admins": "Admins",
    "chart.percentage": "Percentage",

    // User Management
    "users.title": "User Management & Access Control",
    "users.subtitle": "Inspect user profiles, suspend/reinstate accounts, and permanently purge users.",
    "users.searchPlaceholder": "Search by username...",
    "users.allRoles": "All Roles",
    "users.admins": "Administrators",
    "users.regularUsers": "Regular Users",
    "users.allStatus": "All Statuses",
    "users.activeOnly": "Active Accounts",
    "users.bannedOnly": "Suspended Accounts",
    "users.tableUser": "User",
    "users.tableRole": "Role",
    "users.tableStatus": "Status",
    "users.tableLastSeen": "Last Seen",
    "users.tableActions": "Actions",
    "users.unban": "Unban",
    "users.ban": "Ban User",
    "users.delete": "Delete",
    "users.online": "Online",
    "users.active": "Active",
    "users.suspended": "Suspended",
    "users.noUsers": "No users found matching criteria.",

    // Ban Modal
    "modal.banTitle": "Account Suspension / Ban Confirmation",
    "modal.banReasonPrompt": "Specify reason for ban (user will see this directly in their alert notification):",
    "modal.banPlaceholder": "e.g. Violation of community guidelines...",
    "modal.confirmBan": "Confirm Ban",
    "modal.cancel": "Cancel",

    // Delete Modal
    "modal.deleteTitle": "Permanent Account Deletion",
    "modal.deleteWarning": "Warning: This action is irreversible! Deleting this user will permanently cascade and erase all their messages, stories, reactions, and database records.",
    "modal.confirmDelete": "Yes, Permanently Delete",

    // Content Moderation
    "mod.title": "Live Content & Story Moderation",
    "mod.subtitle": "Review all active 24-hour stories uploaded to the platform and remove inappropriate content.",
    "mod.liveStories": "Live Stories",
    "mod.reports": "User Reports",
    "mod.deleteStory": "Delete Story",
    "mod.noStories": "No active live stories right now.",
    "mod.noReports": "No pending user reports.",
    "mod.confirmDeleteStory": "Are you sure you want to delete this story from the database and storage?",

    // System Broadcast
    "broadcast.title": "System Broadcast & Push Notifications",
    "broadcast.subtitle": "Dispatch announcement banners and mobile push notifications to all platform users simultaneously.",
    "broadcast.create": "Compose New Global Announcement",
    "broadcast.formTitle": "Announcement Title",
    "broadcast.titlePlaceholder": "e.g. Scheduled server maintenance or new feature release...",
    "broadcast.category": "Category / Severity Level",
    "broadcast.info": "Info",
    "broadcast.warning": "Warning",
    "broadcast.critical": "Critical",
    "broadcast.update": "Update",
    "broadcast.content": "Announcement Details",
    "broadcast.contentPlaceholder": "Write your detailed platform message here...",
    "broadcast.pushToggle": "Deliver direct push notification to all phones",
    "broadcast.pushSub": "Sent instantly to mobile devices via Firebase Cloud Messaging (FCM).",
    "broadcast.submit": "Publish & Broadcast Announcement",
    "broadcast.publishing": "Publishing...",
    "broadcast.history": "Broadcast History",
    "broadcast.noHistory": "No previous announcements recorded.",
    "broadcast.deleteConfirm": "Are you sure you want to delete this announcement?",
  },
};

const AdminLanguageContext = createContext<AdminLanguageContextType | undefined>(undefined);

export const AdminLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AdminLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kb_admin_lang");
      if (saved === "bn" || saved === "en") return saved;
    }
    return "bn"; // Default to Bengali
  });

  const setLanguage = (lang: AdminLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("kb_admin_lang", lang);
    }
  };

  const toggleLanguage = () => {
    const next = language === "bn" ? "en" : "bn";
    setLanguage(next);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["bn"]?.[key] || key;
  };

  return (
    <AdminLanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </AdminLanguageContext.Provider>
  );
};

export const useAdminLanguage = () => {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      language: "bn" as AdminLanguage,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (k: string) => translations["bn"][k] || k,
    };
  }
  return ctx;
};
