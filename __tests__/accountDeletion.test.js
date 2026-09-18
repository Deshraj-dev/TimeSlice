import {
    deleteSubcollectionDocs,
    deleteUserFirestoreData,
    reauthenticateCurrentUser,
    cleanupLocalUserData,
    deleteCurrentUserAccount,
    completeAuthDeletionWithPassword,
    LOCAL_STORAGE_KEY_FOCUS_SESSION,
} from '../src/services/accountDeletionService';
import { deleteUser, reauthenticateWithCredential } from '@react-native-firebase/auth';

jest.mock('@react-native-firebase/messaging', () => ({
    getMessaging: jest.fn(() => ({})),
    deleteToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-firebase/auth', () => ({
    deleteUser: jest.fn(),
    EmailAuthProvider: {
        credential: jest.fn((email, pass) => ({ email, pass, providerId: 'password' })),
    },
    reauthenticateWithCredential: jest.fn(),
    getAuth: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore', () => ({
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((db, ...pathSegments) => ({ db, path: pathSegments.join('/') })),
    doc: jest.fn((db, ...pathSegments) => ({ db, path: pathSegments.join('/') })),
    getDocs: jest.fn(),
    deleteDoc: jest.fn(),
    writeBatch: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
    const mockStorage = {
        removeItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(null),
        getItem: jest.fn().mockResolvedValue(null),
    };
    return {
        __esModule: true,
        ...mockStorage,
        default: mockStorage,
        createAsyncStorage: jest.fn(() => ({})),
    };
});

describe('Account Deletion Service', () => {
    let mockAuth;
    let mockDb;
    let mockAsyncStorage;

    beforeEach(() => {
        jest.clearAllMocks();

        mockAuth = {
            currentUser: {
                uid: 'user_12345',
                email: 'test@example.com',
            },
        };

        mockDb = {};
        mockAsyncStorage = {
            removeItem: jest.fn().mockResolvedValue(null),
        };
    });

    describe('deleteSubcollectionDocs', () => {
        it('handles empty collections safely with 0 deleted docs', async () => {
            const { getDocs } = require('@react-native-firebase/firestore');
            getDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            const count = await deleteSubcollectionDocs(mockDb, 'user_12345', 'activities');
            expect(count).toBe(0);
        });

        it('batch deletes documents in chunks of CHUNK_SIZE', async () => {
            const { getDocs, writeBatch } = require('@react-native-firebase/firestore');

            const totalDocs = 450;
            const mockDocs = Array.from({ length: totalDocs }, (_, idx) => ({
                ref: { id: `doc_${idx}` },
            }));

            getDocs.mockResolvedValueOnce({ empty: false, docs: mockDocs });

            const mockBatch = {
                delete: jest.fn(),
                commit: jest.fn().mockResolvedValue(null),
            };
            writeBatch.mockReturnValue(mockBatch);

            const count = await deleteSubcollectionDocs(mockDb, 'user_12345', 'activities');

            expect(count).toBe(totalDocs);
            expect(writeBatch).toHaveBeenCalledTimes(2); // 400 + 50
            expect(mockBatch.delete).toHaveBeenCalledTimes(totalDocs);
            expect(mockBatch.commit).toHaveBeenCalledTimes(2);
        });
    });

    describe('deleteUserFirestoreData', () => {
        it('throws if no authenticated user is present', async () => {
            await expect(deleteUserFirestoreData({ currentUser: null }, mockDb)).rejects.toThrow(
                'No authenticated user found for data deletion.'
            );
        });

        it('deletes activities, focusSessions, and the user parent document', async () => {
            const { getDocs, deleteDoc } = require('@react-native-firebase/firestore');
            getDocs.mockResolvedValue({ empty: true, docs: [] });
            deleteDoc.mockResolvedValueOnce(null);

            const result = await deleteUserFirestoreData(mockAuth, mockDb);

            expect(result.success).toBe(true);
            expect(result.uid).toBe('user_12345');
            expect(deleteDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'users/user_12345' })
            );
        });
    });

    describe('reauthenticateCurrentUser', () => {
        it('throws if password is missing', async () => {
            await expect(reauthenticateCurrentUser(mockAuth, '')).rejects.toThrow(
                'Password is required for re-authentication.'
            );
        });

        it('calls reauthenticateWithCredential with valid credential', async () => {
            reauthenticateWithCredential.mockResolvedValueOnce(null);

            const res = await reauthenticateCurrentUser(mockAuth, 'MySecretPass123!');
            expect(res.success).toBe(true);
            expect(reauthenticateWithCredential).toHaveBeenCalledWith(
                mockAuth.currentUser,
                expect.objectContaining({ email: 'test@example.com', pass: 'MySecretPass123!' })
            );
        });
    });

    describe('cleanupLocalUserData', () => {
        it('removes focus_session_state from AsyncStorage', async () => {
            await cleanupLocalUserData(mockAsyncStorage);
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY_FOCUS_SESSION);
        });
    });

    describe('deleteCurrentUserAccount', () => {
        it('returns error if user is not authenticated', async () => {
            const res = await deleteCurrentUserAccount({
                authInstance: { currentUser: null },
                dbInstance: mockDb,
            });
            expect(res.success).toBe(false);
            expect(res.stage).toBe('init');
        });

        it('aborts without deleting Firestore if upfront re-authentication fails', async () => {
            reauthenticateWithCredential.mockRejectedValueOnce(new Error('auth/wrong-password'));
            const { deleteDoc } = require('@react-native-firebase/firestore');

            const res = await deleteCurrentUserAccount({
                authInstance: mockAuth,
                dbInstance: mockDb,
                password: 'WrongPassword!',
            });

            expect(res.success).toBe(false);
            expect(res.stage).toBe('reauth');
            expect(res.firestoreDeleted).toBe(false);
            expect(deleteDoc).not.toHaveBeenCalled();
            expect(deleteUser).not.toHaveBeenCalled();
        });

        it('aborts without deleting Auth account if Firestore deletion fails', async () => {
            const { getDocs } = require('@react-native-firebase/firestore');
            getDocs.mockRejectedValueOnce(new Error('Firestore network error'));

            const res = await deleteCurrentUserAccount({
                authInstance: mockAuth,
                dbInstance: mockDb,
            });

            expect(res.success).toBe(false);
            expect(res.stage).toBe('firestore');
            expect(res.firestoreDeleted).toBe(false);
            expect(deleteUser).not.toHaveBeenCalled();
        });

        it('handles requires-recent-login safely when deleteUser throws it', async () => {
            const { getDocs, deleteDoc } = require('@react-native-firebase/firestore');
            getDocs.mockResolvedValue({ empty: true, docs: [] });
            deleteDoc.mockResolvedValueOnce(null);

            const recentLoginError = new Error('Requires recent login');
            recentLoginError.code = 'auth/requires-recent-login';
            deleteUser.mockRejectedValueOnce(recentLoginError);

            const res = await deleteCurrentUserAccount({
                authInstance: mockAuth,
                dbInstance: mockDb,
            });

            expect(res.success).toBe(false);
            expect(res.stage).toBe('requires-recent-login');
            expect(res.firestoreDeleted).toBe(true);
            expect(res.error.code).toBe('auth/requires-recent-login');
        });

        it('completes entire flow successfully when session is fresh', async () => {
            const { getDocs, deleteDoc } = require('@react-native-firebase/firestore');
            getDocs.mockResolvedValue({ empty: true, docs: [] });
            deleteDoc.mockResolvedValueOnce(null);
            deleteUser.mockResolvedValueOnce(null);

            const res = await deleteCurrentUserAccount({
                authInstance: mockAuth,
                dbInstance: mockDb,
                asyncStorageInstance: mockAsyncStorage,
            });

            expect(res.success).toBe(true);
            expect(res.stage).toBe('complete');
            expect(deleteUser).toHaveBeenCalledWith(mockAuth.currentUser);
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY_FOCUS_SESSION);
        });
    });

    describe('completeAuthDeletionWithPassword', () => {
        it('re-authenticates and deletes Auth account', async () => {
            reauthenticateWithCredential.mockResolvedValueOnce(null);
            deleteUser.mockResolvedValueOnce(null);

            const res = await completeAuthDeletionWithPassword({
                authInstance: mockAuth,
                asyncStorageInstance: mockAsyncStorage,
                password: 'CorrectPassword123!',
            });

            expect(res.success).toBe(true);
            expect(res.stage).toBe('complete');
            expect(reauthenticateWithCredential).toHaveBeenCalled();
            expect(deleteUser).toHaveBeenCalledWith(mockAuth.currentUser);
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY_FOCUS_SESSION);
        });

        it('returns reauth error if password was incorrect during completeAuthDeletionWithPassword', async () => {
            reauthenticateWithCredential.mockRejectedValueOnce(new Error('Wrong password'));

            const res = await completeAuthDeletionWithPassword({
                authInstance: mockAuth,
                password: 'WrongPassword!',
            });

            expect(res.success).toBe(false);
            expect(res.stage).toBe('reauth');
            expect(deleteUser).not.toHaveBeenCalled();
        });
    });
});
