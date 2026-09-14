export type Language = "bn" | "en";

export const translations = {
  bn: {
    // Nav & Sidebar
    messages: "বার্তা",
    feed: "ফিড",
    search: "খুঁজুন...",
    profileSettings: "প্রোফাইল সেটিংস",
    storyArchive: "স্টোরি আর্কাইভ",
    adminPanel: "অ্যাডমিন প্যানেল",
    signOut: "সাইন আউট",
    friends: "ফ্রেন্ডস",
    profile: "প্রোফাইল",
    language: "ভাষা / Language",
    selectLanguage: "অ্যাপের ভাষা পরিবর্তন করুন",
    bangla: "বাংলা",
    english: "English",
    theme: "থিম (Dark / Light)",
    
    // Feed
    communityFeed: "কমিউনিটি ফিড",
    allPosts: "সকল পোস্ট",
    myPosts: "আমার পোস্ট",
    createPostPlaceholder: "কী ভাবছেন, {name}? কিছু শেয়ার করুন...",
    post: "পোস্ট করুন",
    posting: "পোস্ট হচ্ছে...",
    react: "রিঅ্যাক্ট",
    comments: "মন্তব্য",
    repost: "রিশেয়ার",
    share: "শেয়ার করুন",
    repostToFeed: "ফিডে রিশেয়ার",
    sendToChat: "ইনবক্সে পাঠান",
    copyLink: "লিংক কপি করুন",
    reposted: "রিশেয়ার করা হয়েছে! ✓",
    linkCopied: "কপি করা হয়েছে! ✓",
    deletePost: "পোস্ট মুছুন",
    noPosts: "এখানে কোনো পোস্ট নেই",
    noComments: "এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন! 💬",
    writeComment: "একটি মন্তব্য লিখুন...",

    // Profile Settings
    usernameLabel: "ইউজারনেম",
    bioLabel: "বায়ো / পরিচয়",
    avatarUrlLabel: "অ্যাভেটার ছবি URL",
    saveChanges: "পরিবর্তন সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    yourStories: "আপনার স্টোরি সমূহ",
    profileSuccess: "প্রোফাইল সফলভাবে আপডেট করা হয়েছে!",
    
    // Time
    justNow: "এইমাত্র",
    minsAgo: "{n} মিনিট আগে",
    hoursAgo: "{n} ঘন্টা আগে",
    yesterday: "গতকাল"
  },
  en: {
    // Nav & Sidebar
    messages: "Messages",
    feed: "Feed",
    search: "Search...",
    profileSettings: "Profile Settings",
    storyArchive: "Story Archive",
    adminPanel: "Admin Panel",
    signOut: "Sign Out",
    friends: "Friends",
    profile: "Profile",
    language: "Language / ভাষা",
    selectLanguage: "Change app language",
    bangla: "বাংলা",
    english: "English",
    theme: "Theme (Dark / Light)",

    // Feed
    communityFeed: "Community Feed",
    allPosts: "All Posts",
    myPosts: "My Posts",
    createPostPlaceholder: "What's on your mind, {name}? Share something...",
    post: "Post",
    posting: "Posting...",
    react: "React",
    comments: "Comments",
    repost: "Repost",
    share: "Share",
    repostToFeed: "Repost to Feed",
    sendToChat: "Send to Chat",
    copyLink: "Copy Link",
    reposted: "Reposted! ✓",
    linkCopied: "Link Copied! ✓",
    deletePost: "Delete Post",
    noPosts: "No posts here yet",
    noComments: "No comments yet. Be the first to comment! 💬",
    writeComment: "Write a comment...",

    // Profile Settings
    usernameLabel: "Username",
    bioLabel: "Bio",
    avatarUrlLabel: "Avatar Image URL",
    saveChanges: "Save Changes",
    saving: "Saving...",
    yourStories: "Your Stories",
    profileSuccess: "Profile updated successfully!",

    // Time
    justNow: "Just now",
    minsAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    yesterday: "Yesterday"
  }
};

export function getTranslation(lang: Language, key: keyof typeof translations.bn, params?: Record<string, string | number>): string {
  let str = translations[lang]?.[key] || translations.bn[key] || String(key);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}
