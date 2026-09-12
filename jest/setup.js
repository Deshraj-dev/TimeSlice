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
  const messagingMock = () => ({
    requestPermission: jest.fn().mockResolvedValue(1),
    getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
    onTokenRefresh: jest.fn().mockReturnValue(jest.fn()),
    setBackgroundMessageHandler: jest.fn(),
  });
  messagingMock.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return messagingMock;
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
