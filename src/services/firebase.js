import { initializeApp } from 'firebase/app';

import {
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';

import {
  createAsyncStorage,
} from '@react-native-async-storage/async-storage';

import {
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBAUmDPib0O3WuHqAKa7EXeQbmr3uJAwro',
  authDomain: 'timeslice-ebd6e.firebaseapp.com',
  projectId: 'timeslice-ebd6e',
  storageBucket: 'timeslice-ebd6e.firebasestorage.app',
  messagingSenderId: '339296221230',
  appId: '1:339296221230:web:60bde1c8b8b469de1907bf',
  measurementId: 'G-WLZ8LV25R8',
};

const app = initializeApp(firebaseConfig);

// AsyncStorage for persistent login
const appStorage = createAsyncStorage('app');

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(appStorage),
});

// Firestore
export const db = getFirestore(app);

export default app;