import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nibir.kothabarta',
  appName: 'kotha-barta',
  webDir: 'dist',
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
