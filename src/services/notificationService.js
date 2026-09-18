import { Platform } from 'react-native';
import notifee, {
    TriggerType,
    AndroidImportance,
    AndroidVisibility,
} from '@notifee/react-native';
import {
    getMessaging,
    requestPermission,
    getToken,
    onTokenRefresh,
    AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { auth, db } from './firebase';

// Helper to convert time HH:MM to hours and minutes
const parseTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return { hours: 0, minutes: 0 };
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h || 0, minutes: m || 0 };
};

class NotificationService {
    async init() {
        try {
            // 1. Create Android Notification Channel
            if (Platform.OS === 'android') {
                await notifee.createChannel({
                    id: 'time_slice_reminders',
                    name: 'Activity & Focus Reminders',
                    description: 'Reminders for scheduled activities and focus session completions',
                    importance: AndroidImportance.HIGH,
                    visibility: AndroidVisibility.PUBLIC,
                    vibration: true,
                });
            }

            // 2. Request local notification permissions
            await notifee.requestPermission();

            console.log('Notifee Local Notification Service initialized.');
        } catch (err) {
            console.log('Error initializing notification service:', err);
        }
    }

    async initFCM() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const messaging = getMessaging();

            // 1. Request FCM permissions
            const authStatus = await requestPermission(messaging);
            const enabled =
                authStatus === AuthorizationStatus.AUTHORIZED ||
                authStatus === AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                // 2. Get device FCM registration token
                const fcmToken = await getToken(messaging);
                if (fcmToken) {
                    console.log('FCM Token generated.');
                    // Update user's document in Firestore with token
                    const userDocRef = doc(db, 'users', user.uid);
                    await updateDoc(userDocRef, { fcmToken });
                }

                // 3. Listen to token refresh
                onTokenRefresh(messaging, async (token) => {
                    const currentUser = auth.currentUser;
                    if (currentUser) {
                        await updateDoc(doc(db, 'users', currentUser.uid), {
                            fcmToken: token,
                        });
                    }
                });
            }
        } catch (err) {
            console.log('Error initializing Firebase Cloud Messaging:', err);
        }
    }

    async scheduleActivityReminders(activity) {
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Fetch user's notification preferences from settings doc
            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) return;
            const settings = userSnap.data();

            // Check global notification permission toggle
            const isNotificationsEnabled = settings.notificationsEnabled !== false;
            const isReminderEnabled = settings.activityRemindersEnabled !== false;

            if (!isNotificationsEnabled || !isReminderEnabled) {
                console.log('Notifications or activity reminders are disabled in settings.');
                return;
            }

            const remindLeadMinutes = Number(settings.remindLeadMinutes || 5);
            const soundEnabled = settings.soundsEnabled !== false;
            const vibrationEnabled = settings.soundsEnabled !== false; // uses soundsEnabled as proxy or default true

            // Cancel any old scheduled notifications for this activity id
            await this.cancelActivityReminders(activity.id);

            // Compute dates math
            const [y, m, d] = activity.date.split('-').map(Number);
            const { hours: startH, minutes: startM } = parseTime(activity.startTime);

            // Create target start Date object
            const startDate = new Date(y, m - 1, d, startH, startM, 0);
            const startTimeMs = startDate.getTime();

            // Calculate lead offset reminder time
            const leadTimeMs = startTimeMs - remindLeadMinutes * 60 * 1000;
            const nowMs = Date.now();

            // 1. Schedule Lead Notification
            if (leadTimeMs > nowMs) {
                const triggerLead = {
                    type: TriggerType.TIMESTAMP,
                    timestamp: leadTimeMs,
                };

                await notifee.createTriggerNotification(
                    {
                        id: `${activity.id}_before`,
                        title: `Upcoming Task: ${activity.title}`,
                        body: `Starting in ${remindLeadMinutes} minutes (${activity.startTime})`,
                        android: {
                            channelId: 'time_slice_reminders',
                            importance: AndroidImportance.HIGH,
                            pressAction: {
                                id: 'default',
                            },
                            sound: soundEnabled ? 'default' : undefined,
                            vibrate: vibrationEnabled,
                        },
                        ios: {
                            sound: soundEnabled ? 'default' : undefined,
                        },
                    },
                    triggerLead
                );
            }

            // 2. Schedule Start Notification
            if (startTimeMs > nowMs) {
                const triggerStart = {
                    type: TriggerType.TIMESTAMP,
                    timestamp: startTimeMs,
                };

                await notifee.createTriggerNotification(
                    {
                        id: `${activity.id}_start`,
                        title: `Task Starting Now!`,
                        body: `${activity.title} (${activity.startTime} - ${activity.endTime})`,
                        android: {
                            channelId: 'time_slice_reminders',
                            importance: AndroidImportance.HIGH,
                            pressAction: {
                                id: 'default',
                            },
                            sound: soundEnabled ? 'default' : undefined,
                            vibrate: vibrationEnabled,
                        },
                        ios: {
                            sound: soundEnabled ? 'default' : undefined,
                        },
                    },
                    triggerStart
                );
            }
            console.log(`Notifications scheduled for activity: ${activity.title}`);
        } catch (err) {
            console.log('Error scheduling activity reminders:', err);
        }
    }

    async cancelActivityReminders(activityId) {
        try {
            await notifee.cancelNotification(`${activityId}_before`);
            await notifee.cancelNotification(`${activityId}_start`);
            console.log(`Cancelled notifications for activity: ${activityId}`);
        } catch (err) {
            console.log('Error cancelling notifications:', err);
        }
    }

    async triggerFocusCompleteNotification() {
        try {
            const user = auth.currentUser;
            let soundEnabled = true;

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const settings = userSnap.data();
                    if (settings.notificationsEnabled === false) return; // Silent if globally off
                    soundEnabled = settings.soundsEnabled !== false;
                }
            }

            await notifee.displayNotification({
                title: 'Focus Session Completed! 🎉',
                body: 'Excellent job staying focused on your task.',
                android: {
                    channelId: 'time_slice_reminders',
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                    sound: soundEnabled ? 'default' : undefined,
                },
                ios: {
                    sound: soundEnabled ? 'default' : undefined,
                },
            });
        } catch (err) {
            console.log('Error triggering focus completed notification:', err);
        }
    }

    async cancelAllReminders() {
        try {
            await notifee.cancelAllNotifications();
            console.log('All scheduled notifications cancelled.');
        } catch (err) {
            console.log('Error cancelling all notifications:', err);
        }
    }
}

const notificationService = new NotificationService();
export default notificationService;
