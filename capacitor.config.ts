import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nibir.kothabarta',
  appName: 'kotha-barta',
  webDir: 'dist',
  server: {
    // Allow navigation within the app
    allowNavigation: ['ngtyysbsfvowtbrqamti.supabase.co'],
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
  },
};

export default config;
