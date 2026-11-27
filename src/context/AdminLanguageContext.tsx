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
    "nav.overview": "ওভারভিউ",
    "nav.users": "ইউজার ম্যানেজমেন্ট",
    "nav.moderation": "কন্টেন্ট মডারেশন",
    "nav.broadcast": "সিস্টেম ব্রডকাস্ট",
    "nav.backToChat": "চ্যাটে ফিরুন",
    "nav.adminRole": "এডমিন",
    "nav.systemOnline": "সচল",
    "nav.adminControl": "কথাবার্তা অপারেশনস",
    "nav.logout": "লগআউট",
    "nav.themeToggle": "থিম পরিবর্তন",
    "nav.switchLang": "English",

    // Overview Page
    "overview.welcome": "প্ল্যাটফর্ম ওভারভিউ",
    "overview.subtitle": "ইউজার অ্যাক্টিভিটি, বার্তা আদান-প্রদান ও লাইভ স্টোরির সারসংক্ষেপ",
    "overview.refresh": "রিফ্রেশ",
    "overview.totalUsers": "মোট ইউজার",
    "overview.totalUsersSub": "নিবন্ধিত একাউন্ট",
    "overview.dau": "দৈনিক সক্রিয়",
    "overview.dauSub": "গত ২৪ ঘণ্টায় সক্রিয়",
    "overview.messages": "মোট মেসেজ",
    "overview.messagesSub": "সর্বমোট প্রেরিত বার্তা",
    "overview.stories": "লাইভ স্টোরি",
    "overview.storiesSub": "২৪ ঘণ্টার সক্রিয় স্টোরি",
    "overview.recentUsers": "সাম্প্রতিক ইউজার",
    "overview.viewAll": "সব দেখুন",
    "overview.noRecentUsers": "কোনো ইউজার পাওয়া যায়নি",

    // Analytics Charts
    "chart.activityTitle": "দৈনিক অ্যাক্টিভিটি ও মেসেজ ট্রাফিক",
    "chart.activitySubtitle": "সক্রিয় ইউজার ও প্রেরিত বার্তার প্রকৃত দৈনিক পরিসংখ্যান",
    "chart.days7": "৭ দিন",
    "chart.days14": "১৪ দিন",
    "chart.days30": "৩০ দিন",
    "chart.activeUsers": "সক্রিয় ইউজার",
    "chart.messages": "মেসেজ",
    "chart.totalMessages": "মোট মেসেজ",
    "chart.statusTitle": "একাউন্ট বণ্টন",
    "chart.statusSubtitle": "রোল ও স্ট্যাটাস অনুযায়ী বিভাজন",
    "chart.active": "সক্রিয়",
    "chart.banned": "স্থগিত",
    "chart.admins": "অ্যাডমিন",
    "chart.moderators": "মডারেটর",

    // User Management
    "users.title": "ইউজার ম্যানেজমেন্ট",
    "users.subtitle": "ইউজার প্রোফাইল, রোল ও অ্যাকাউন্ট স্ট্যাটাস পরিচালনা করুন",
    "users.searchPlaceholder": "ইউজারনেম দিয়ে খুঁজুন",
    "users.allRoles": "সকল রোল",
    "users.admins": "অ্যাডমিন",
    "users.regularUsers": "সাধারণ ইউজার",
    "users.allStatus": "সকল স্ট্যাটাস",
    "users.activeOnly": "সক্রিয়",
    "users.bannedOnly": "স্থগিত",
    "users.tableUser": "ব্যবহারকারী",
    "users.tableRole": "রোল",
    "users.tableStatus": "স্ট্যাটাস",
    "users.tableLastSeen": "সর্বশেষ দেখা",
    "users.tableActions": "অ্যাকশন",
    "users.unban": "আনব্যান",
    "users.ban": "ব্যান",
    "users.delete": "মুছুন",
    "users.noUsers": "কোনো ব্যবহারকারী পাওয়া যায়নি",

    // Ban Modal
    "modal.banTitle": "অ্যাকাউন্ট স্থগিত করুন",
    "modal.banReasonPrompt": "ব্যান করার কারণ",
    "modal.banPlaceholder": "কারণ লিখুন",
    "modal.confirmBan": "ব্যান নিশ্চিত করুন",
    "modal.cancel": "বাতিল",

    // Delete Modal
    "modal.deleteTitle": "অ্যাকাউন্ট স্থায়ীভাবে মুছুন",
    "modal.deleteWarning": "এই ইউজারকে মুছে ফেললে তার সকল মেসেজ, চ্যাট হিস্ট্রি, স্টোরি ও অ্যাকাউন্ট ডেটাবেজ থেকে স্থায়ীভাবে মুছে যাবে।",
    "modal.confirmDelete": "স্থায়ীভাবে মুছুন",

    // Content Moderation
    "mod.title": "কন্টেন্ট মডারেশন",
    "mod.subtitle": "সক্রিয় ২৪ ঘণ্টার স্টোরি এবং ইউজার রিপোর্ট পর্যালোচনা করুন",
    "mod.liveStories": "লাইভ স্টোরি",
    "mod.reports": "রিপোর্ট",
    "mod.deleteStory": "স্টোরি মুছুন",
    "mod.noStories": "কোনো সক্রিয় স্টোরি নেই",
    "mod.noReports": "কোনো রিপোর্ট নেই",

    // System Broadcast
    "broadcast.title": "সিস্টেম ব্রডকাস্ট",
    "broadcast.subtitle": "সকল ব্যবহারকারীর কাছে নোটিশ ব্যানার ও পুশ নোটিফিকেশন পাঠান",
    "broadcast.create": "নতুন ঘোষণা",
    "broadcast.formTitle": "শিরোনাম",
    "broadcast.titlePlaceholder": "ঘোষণার শিরোনাম লিখুন",
    "broadcast.category": "ধরন",
    "broadcast.info": "তথ্য",
    "broadcast.warning": "সতর্কতা",
    "broadcast.critical": "জরুরি",
    "broadcast.update": "আপডেট",
    "broadcast.content": "বার্তা",
    "broadcast.contentPlaceholder": "বিস্তারিত বার্তা লিখুন",
    "broadcast.pushToggle": "মোবাইল পুশ নোটিফিকেশন পাঠান",
    "broadcast.pushSub": "FCM-এর মাধ্যমে ব্যবহারকারীদের ডিভাইসে পাঠানো হবে",
    "broadcast.submit": "ব্রডকাস্ট পাঠান",
    "broadcast.publishing": "পাঠানো হচ্ছে",
    "broadcast.history": "ঘোষণার ইতিহাস",
    "broadcast.noHistory": "পূর্ববর্তী কোনো ঘোষণা নেই",
  },
  en: {
    // Nav & Layout
    "nav.overview": "Overview",
    "nav.users": "Users",
    "nav.moderation": "Moderation",
    "nav.broadcast": "Broadcasts",
    "nav.backToChat": "Back to chat",
    "nav.adminRole": "Admin",
    "nav.systemOnline": "Online",
    "nav.adminControl": "Kotha Barta Operations",
    "nav.logout": "Log out",
    "nav.themeToggle": "Toggle theme",
    "nav.switchLang": "বাংলা",

    // Overview Page
    "overview.welcome": "Platform overview",
    "overview.subtitle": "Account activity, message volume, and live 24h stories",
    "overview.refresh": "Refresh",
    "overview.totalUsers": "Total users",
    "overview.totalUsersSub": "Registered accounts",
    "overview.dau": "Active today",
    "overview.dauSub": "Seen in last 24 hours",
    "overview.messages": "Messages",
    "overview.messagesSub": "Total messages sent",
    "overview.stories": "Live stories",
    "overview.storiesSub": "Active 24h stories",
    "overview.recentUsers": "Recent accounts",
    "overview.viewAll": "View all",
    "overview.noRecentUsers": "No users found",

    // Analytics Charts
    "chart.activityTitle": "Activity and message volume",
    "chart.activitySubtitle": "Daily active accounts and messages recorded in the database",
    "chart.days7": "7d",
    "chart.days14": "14d",
    "chart.days30": "30d",
    "chart.activeUsers": "Active users",
    "chart.messages": "Messages",
    "chart.totalMessages": "Total messages",
    "chart.statusTitle": "Account breakdown",
    "chart.statusSubtitle": "Distribution by role and status",
    "chart.active": "Active",
    "chart.banned": "Banned",
    "chart.admins": "Admins",
    "chart.moderators": "Moderators",

    // User Management
    "users.title": "Users",
    "users.subtitle": "Inspect accounts, assign roles, and enforce suspensions",
    "users.searchPlaceholder": "Search username",
    "users.allRoles": "All roles",
    "users.admins": "Admins",
    "users.regularUsers": "Users",
    "users.allStatus": "All statuses",
    "users.activeOnly": "Active",
    "users.bannedOnly": "Banned",
    "users.tableUser": "User",
    "users.tableRole": "Role",
    "users.tableStatus": "Status",
    "users.tableLastSeen": "Last seen",
    "users.tableActions": "Actions",
    "users.unban": "Unban",
    "users.ban": "Ban",
    "users.delete": "Delete",
    "users.noUsers": "No users match these filters",

    // Ban Modal
    "modal.banTitle": "Suspend account",
    "modal.banReasonPrompt": "Reason shown to the user",
    "modal.banPlaceholder": "Enter reason for suspension",
    "modal.confirmBan": "Confirm ban",
    "modal.cancel": "Cancel",

    // Delete Modal
    "modal.deleteTitle": "Delete account",
    "modal.deleteWarning": "Deleting this user permanently removes their messages, stories, and profile records from the database.",
    "modal.confirmDelete": "Delete permanently",

    // Content Moderation
    "mod.title": "Moderation",
    "mod.subtitle": "Review active 24h stories and user reports",
    "mod.liveStories": "Live stories",
    "mod.reports": "Reports",
    "mod.deleteStory": "Delete story",
    "mod.noStories": "No active stories right now",
    "mod.noReports": "No user reports",

    // System Broadcast
    "broadcast.title": "System broadcasts",
    "broadcast.subtitle": "Send banner announcements and push notifications to all users",
    "broadcast.create": "New announcement",
    "broadcast.formTitle": "Title",
    "broadcast.titlePlaceholder": "Announcement title",
    "broadcast.category": "Severity",
    "broadcast.info": "Info",
    "broadcast.warning": "Warning",
    "broadcast.critical": "Critical",
    "broadcast.update": "Update",
    "broadcast.content": "Message",
    "broadcast.contentPlaceholder": "Write announcement details",
    "broadcast.pushToggle": "Send mobile push notification",
    "broadcast.pushSub": "Delivered to registered devices via FCM",
    "broadcast.submit": "Send broadcast",
    "broadcast.publishing": "Sending",
    "broadcast.history": "History",
    "broadcast.noHistory": "No announcements sent yet",
  },
};

const AdminLanguageContext = createContext<AdminLanguageContextType | undefined>(undefined);

export const AdminLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AdminLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kb_admin_lang");
      if (saved === "bn" || saved === "en") return saved;
    }
    return "bn";
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
    return {
      language: "bn" as AdminLanguage,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (k: string) => translations["bn"][k] || k,
    };
  }
  return ctx;
};
