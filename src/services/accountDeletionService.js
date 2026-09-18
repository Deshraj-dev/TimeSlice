import {
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from '@react-native-firebase/auth';
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    writeBatch,
} from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessaging, deleteToken } from '@react-native-firebase/messaging';
import { auth, db } from './firebase';

export const CHUNK_SIZE = 400;
export const LOCAL_STORAGE_KEY_FOCUS_SESSION = 'focus_session_state';

/**
 * Batch deletes all documents in a subcollection for the given user.
 * Chunks deletion in batches of up to CHUNK_SIZE (400) to adhere to Firestore's 500-op limit.
 */
export async function deleteSubcollectionDocs(dbInstance, uid, subcollectionName) {
    const subColRef = collection(dbInstance, 'users', uid, subcollectionName);
    const snap = await getDocs(subColRef);

    if (snap.empty || snap.docs.length === 0) {
        return 0;
    }

    const docs = snap.docs;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(dbInstance);

        chunk.forEach((d) => {
            batch.delete(d.ref);
        });

        await batch.commit();
        deletedCount += chunk.length;
    }

    return deletedCount;
}

/**
 * Deletes all Firestore data for the currently authenticated user.
 * STRICT SECURITY: Only operates on the authenticated user's UID derived from authInstance.currentUser.
 */
export async function deleteUserFirestoreData(authInstance = auth, dbInstance = db) {
    const user = authInstance.currentUser;
    if (!user || !user.uid) {
        throw new Error('No authenticated user found for data deletion.');
    }

    const uid = user.uid;

    // 1. Delete all activities
    await deleteSubcollectionDocs(dbInstance, uid, 'activities');

    // 2. Delete all focus sessions
    await deleteSubcollectionDocs(dbInstance, uid, 'focusSessions');

    // 3. Delete parent user document
    const userDocRef = doc(dbInstance, 'users', uid);
    await deleteDoc(userDocRef);

    return { success: true, uid };
}

/**
 * Re-authenticates the current user using their email and password.
 * Password is used only in-memory and never stored, logged, or retained.
 */
export async function reauthenticateCurrentUser(authInstance = auth, password) {
    const user = authInstance.currentUser;
    if (!user || !user.email) {
        throw new Error('No authenticated user or email found for re-authentication.');
    }

    if (!password) {
        throw new Error('Password is required for re-authentication.');
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return { success: true };
}

/**
 * Cleans up user-specific local storage items.
 */
export async function cleanupLocalUserData(asyncStorageInstance = AsyncStorage) {
    try {
        await asyncStorageInstance.removeItem(LOCAL_STORAGE_KEY_FOCUS_SESSION);
    } catch (err) {
        console.warn('Non-fatal error clearing local focus session storage:', err);
    }
}

/**
 * Invalidates and deletes the device's FCM token upon account deletion.
 * Non-blocking: failures are caught and logged as warnings without blocking account deletion.
 */
export async function cleanupFCMToken(messagingInstance = null) {
    try {
        const messaging = messagingInstance || getMessaging();
        await deleteToken(messaging);
        console.log('FCM registration token invalidated.');
    } catch (err) {
        console.warn('Non-fatal error invalidating FCM token during account deletion:', err ? err.message || err : 'Unknown error');
    }
}

/**
 * Main entry point for account deletion.
 * Follows the safe deletion order:
 * 1. (Optional) Re-authenticate if password was supplied.
 * 2. Delete Firestore user data (activities, focusSessions, parent user doc).
 * 3. Delete Firebase Auth user account.
 * 4. Clean up user-specific local storage.
 *
 * Explicitly handles:
 * - Reauth failure: stops immediately, no data deleted.
 * - Firestore deletion failure: stops immediately, Auth account intact.
 * - requires-recent-login: notifies caller that Firestore was deleted but Auth requires reauth.
 */
export async function deleteCurrentUserAccount({
    authInstance = auth,
    dbInstance = db,
    asyncStorageInstance = AsyncStorage,
    password = null,
} = {}) {
    const user = authInstance.currentUser;
    if (!user || !user.uid) {
        return {
            success: false,
            stage: 'init',
            error: new Error('No authenticated user session found.'),
        };
    }

    // Step 1: Re-authenticate if password was supplied
    if (password) {
        try {
            await reauthenticateCurrentUser(authInstance, password);
        } catch (reauthErr) {
            return {
                success: false,
                stage: 'reauth',
                error: reauthErr,
                firestoreDeleted: false,
            };
        }
    }

    // Step 2: Delete Firestore data
    try {
        await deleteUserFirestoreData(authInstance, dbInstance);
    } catch (firestoreErr) {
        return {
            success: false,
            stage: 'firestore',
            error: firestoreErr,
            firestoreDeleted: false,
        };
    }

    // Step 3: Delete Firebase Auth user account
    try {
        await deleteUser(user);
    } catch (authErr) {
        if (authErr && authErr.code === 'auth/requires-recent-login') {
            return {
                success: false,
                stage: 'requires-recent-login',
                error: authErr,
                firestoreDeleted: true,
            };
        }
        return {
            success: false,
            stage: 'auth',
            error: authErr,
            firestoreDeleted: true,
        };
    }

    // Step 4: Clean up local storage and FCM token
    await cleanupLocalUserData(asyncStorageInstance);
    await cleanupFCMToken();

    return {
        success: true,
        stage: 'complete',
    };
}

/**
 * Completes Auth deletion after re-authenticating when `requires-recent-login` was returned.
 */
export async function completeAuthDeletionWithPassword({
    authInstance = auth,
    asyncStorageInstance = AsyncStorage,
    password,
}) {
    const user = authInstance.currentUser;
    if (!user || !user.uid) {
        return {
            success: false,
            stage: 'init',
            error: new Error('No authenticated user session found.'),
        };
    }

    // 1. Re-authenticate
    try {
        await reauthenticateCurrentUser(authInstance, password);
    } catch (reauthErr) {
        return {
            success: false,
            stage: 'reauth',
            error: reauthErr,
        };
    }

    // 2. Delete Auth user
    try {
        await deleteUser(user);
    } catch (authErr) {
        return {
            success: false,
            stage: 'auth',
            error: authErr,
        };
    }

    // 3. Local storage and FCM token cleanup
    await cleanupLocalUserData(asyncStorageInstance);
    await cleanupFCMToken();

    return {
        success: true,
        stage: 'complete',
    };
}
