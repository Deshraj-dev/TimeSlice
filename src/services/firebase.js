import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

// Native Firebase Auth
export const auth = getAuth();

// Native Firebase Firestore
export const db = getFirestore();