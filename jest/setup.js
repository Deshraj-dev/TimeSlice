/* eslint-env jest */
jest.mock('@notifee/react-native', () => {
  return {
    createChannel: jest.fn().mockResolvedValue(true),
    requestPermission: jest.fn().mockResolvedValue(true),
    createTriggerNotification: jest.fn().mockResolvedValue(true),
    cancelNotification: jest.fn().mockResolvedValue(true),
    displayNotification: jest.fn().mockResolvedValue(true),
    cancelAllNotifications: jest.fn().mockResolvedValue(true),
    TriggerType: {
      TIMESTAMP: 0,
    },
    AndroidImportance: {
      HIGH: 4,
    },
    AndroidVisibility: {
      PUBLIC: 1,
    },
  };
});

jest.mock('@react-native-firebase/messaging', () => {
  const messagingInstance = {
    requestPermission: jest.fn().mockResolvedValue(1),
    getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
    deleteToken: jest.fn().mockResolvedValue(undefined),
    onTokenRefresh: jest.fn().mockReturnValue(jest.fn()),
    setBackgroundMessageHandler: jest.fn(),
  };
  const messagingMock = jest.fn(() => messagingInstance);
  messagingMock.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  messagingMock.getMessaging = jest.fn(() => messagingInstance);
  messagingMock.deleteToken = jest.fn().mockResolvedValue(undefined);
  messagingMock.getToken = jest.fn().mockResolvedValue('mock-fcm-token');
  messagingMock.requestPermission = jest.fn().mockResolvedValue(1);
  messagingMock.onTokenRefresh = jest.fn().mockReturnValue(jest.fn());

  return {
    __esModule: true,
    default: messagingMock,
    getMessaging: messagingMock.getMessaging,
    deleteToken: messagingMock.deleteToken,
    getToken: messagingMock.getToken,
    requestPermission: messagingMock.requestPermission,
    onTokenRefresh: messagingMock.onTokenRefresh,
    AuthorizationStatus: messagingMock.AuthorizationStatus,
  };
});

jest.mock('@react-native-firebase/auth', () => {
  const mockUser = {
    uid: 'test-uid-123',
    email: 'test@example.com',
    emailVerified: true,
    getIdToken: jest.fn().mockResolvedValue('mock-token'),
    delete: jest.fn().mockResolvedValue(undefined),
    reauthenticateWithCredential: jest.fn().mockResolvedValue({}),
  };

  const authMockInstance = {
    currentUser: mockUser,
    signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockUser }),
    createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockUser }),
    signOut: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    onAuthStateChanged: jest.fn((cb) => {
      cb(mockUser);
      return jest.fn();
    }),
  };

  const authMock = jest.fn(() => authMockInstance);
  authMock.getAuth = jest.fn(() => authMockInstance);
  authMock.onAuthStateChanged = jest.fn((_auth, cb) => {
    cb(mockUser);
    return jest.fn();
  });
  authMock.signInWithEmailAndPassword = jest.fn((_auth, _email, _pass) => Promise.resolve({ user: mockUser }));
  authMock.createUserWithEmailAndPassword = jest.fn((_auth, _email, _pass) => Promise.resolve({ user: mockUser }));
  authMock.signOut = jest.fn(() => Promise.resolve());
  authMock.sendPasswordResetEmail = jest.fn(() => Promise.resolve());
  authMock.sendEmailVerification = jest.fn(() => Promise.resolve());
  authMock.deleteUser = jest.fn(() => Promise.resolve());
  authMock.reauthenticateWithCredential = jest.fn(() => Promise.resolve({}));
  authMock.EmailAuthProvider = {
    credential: jest.fn((email, pass) => ({ email, pass, providerId: 'password' })),
  };

  return {
    __esModule: true,
    default: authMock,
    getAuth: authMock.getAuth,
    onAuthStateChanged: authMock.onAuthStateChanged,
    signInWithEmailAndPassword: authMock.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: authMock.createUserWithEmailAndPassword,
    signOut: authMock.signOut,
    sendPasswordResetEmail: authMock.sendPasswordResetEmail,
    sendEmailVerification: authMock.sendEmailVerification,
    deleteUser: authMock.deleteUser,
    reauthenticateWithCredential: authMock.reauthenticateWithCredential,
    EmailAuthProvider: authMock.EmailAuthProvider,
  };
});

jest.mock('@react-native-firebase/firestore', () => {
  const mockDocSnap = {
    exists: () => true,
    data: () => ({ dailyGoalHours: 4, currentStreak: 1, displayName: 'Test User' }),
    id: 'mock-doc-id',
  };

  const mockQuerySnap = {
    forEach: (cb) => {
      cb({ id: 'act-1', data: () => ({ title: 'Test', startTime: '09:00', endTime: '10:00', actualFocusedMinutes: 30 }) });
    },
    docs: [],
    empty: false,
    size: 1,
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    where: jest.fn(() => mockCollectionRef),
    onSnapshot: jest.fn((cb) => {
      if (typeof cb === 'function') cb(mockQuerySnap);
      return jest.fn();
    }),
  };

  const mockDocRef = {
    collection: jest.fn(() => mockCollectionRef),
    onSnapshot: jest.fn((cb) => {
      if (typeof cb === 'function') cb(mockDocSnap);
      return jest.fn();
    }),
  };

  const mockFirestoreInstance = {
    collection: jest.fn(() => mockCollectionRef),
    doc: jest.fn(() => mockDocRef),
    batch: jest.fn(() => ({
      commit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    })),
  };

  const firestoreMock = jest.fn(() => mockFirestoreInstance);
  firestoreMock.getFirestore = jest.fn(() => mockFirestoreInstance);
  firestoreMock.collection = jest.fn(() => mockCollectionRef);
  firestoreMock.doc = jest.fn(() => mockDocRef);
  firestoreMock.query = jest.fn((ref) => ref);
  firestoreMock.where = jest.fn(() => ({}));
  firestoreMock.onSnapshot = jest.fn((ref, onNext) => {
    if (typeof onNext === 'function') {
      if (ref === mockDocRef) {
        onNext(mockDocSnap);
      } else {
        onNext(mockQuerySnap);
      }
    }
    return jest.fn();
  });

  return {
    __esModule: true,
    default: firestoreMock,
    getFirestore: firestoreMock.getFirestore,
    collection: firestoreMock.collection,
    doc: firestoreMock.doc,
    query: firestoreMock.query,
    where: firestoreMock.where,
    onSnapshot: firestoreMock.onSnapshot,
    getDoc: jest.fn().mockResolvedValue(mockDocSnap),
    getDocs: jest.fn().mockResolvedValue(mockQuerySnap),
    setDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    addDoc: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
    deleteDoc: jest.fn().mockResolvedValue(undefined),
    writeBatch: jest.fn(() => ({
      commit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    })),
    serverTimestamp: jest.fn(() => ({ _seconds: 123456789, _nanoseconds: 0 })),
    increment: jest.fn((n) => n),
    deleteField: jest.fn(() => ({})),
    arrayUnion: jest.fn((...items) => items),
    arrayRemove: jest.fn((...items) => items),
  };
});

jest.mock('react-native-image-picker', () => {
  return {
    launchCamera: jest.fn(),
    launchImageLibrary: jest.fn(),
  };
});

jest.mock('react-native-size-matters', () => {
  const mockScaledSheet = {
    create: (styles) => {
      const cleanStyles = {};
      for (const key in styles) {
        cleanStyles[key] = {};
        for (const prop in styles[key]) {
          const val = styles[key][prop];
          if (typeof val === 'string' && val.includes('@')) {
            cleanStyles[key][prop] = parseFloat(val.split('@')[0]);
          } else {
            cleanStyles[key][prop] = val;
          }
        }
      }
      return cleanStyles;
    },
  };

  return {
    __esModule: true,
    scale: (val) => val,
    verticalScale: (val) => val,
    moderateScale: (val) => val,
    moderateVerticalScale: (val) => val,
    ScaledSheet: mockScaledSheet,
    default: {
      scale: (val) => val,
      verticalScale: (val) => val,
      moderateScale: (val) => val,
      moderateVerticalScale: (val) => val,
      ScaledSheet: mockScaledSheet,
    },
  };
});
