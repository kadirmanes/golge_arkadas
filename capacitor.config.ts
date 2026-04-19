import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.manestudio.guardly',
  appName: 'Guardly',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#10b981',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#09090b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#09090b',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // google-services.json'daki web client_id (type 3)
      serverClientId: '13928769495-jrv0p05ihkggsqi8vodva99ttv1aikpo.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
