import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';
import { auth } from './src/services/firebase';

LogBox.ignoreAllLogs(true);

export default function App() {
  useEffect(() => {
    // 1. Initialize local notifications (channels, permissions)
    notificationService.init();

    // 2. Register FCM push token when user is logged in
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        notificationService.initFCM();
      }
    });

    return unsubscribeAuth;
  }, []);

  return <AppNavigator />;
}