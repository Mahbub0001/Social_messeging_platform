import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nibir.kothabarta',
  appName: 'kotha-barta',
  webDir: 'dist',
  server: {
    url: 'https://mahbub-social-messeging-platform.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    // Allow mixed content for WebView compatibility
    allowMixedContent: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
