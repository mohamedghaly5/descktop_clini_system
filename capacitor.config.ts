import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dentalflow.client',
  appName: 'DentalFlowClient',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;
