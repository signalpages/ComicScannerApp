import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comicscan.app',
  appName: 'ComicScan',
  webDir: 'dist',
  server: {
    allowNavigation: [
      'comicscanner-api.vercel.app'
    ]
  }
};

export default config;
