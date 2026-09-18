import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Vibration,
    ScrollView,
    Platform,
    ActivityIndicator,
    AppState,
    StatusBar,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { auth, db } from '../services/firebase';
import { getTodayDateString, getYesterdayDateString } from '../utils/dateHelpers';
import notificationService from '../services/notificationService';
import AppIcon from '../components/AppIcon';

const PRESETS = [15, 25, 30, 45, 60];
const CIRCLE_RADIUS = 94;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~590.62

const CATEGORY_ICONS = {
    work: 'work',
    study: 'study',
    exercise: 'exercise',
    lunch: 'lunch',
    leisure: 'leisure',
    other: 'other',
};

const CATEGORY_COLORS = {
    work: '#06B6D4',
    study: '#8B5CF6',
    exercise: '#10B981',
    lunch: '#F97316',
    leisure: '#EAB308',
    other: '#64748B',
};

export default function FocusScreen({ navigation }) {
    const [todayActivities, setTodayActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [loadingActivities, setLoadingActivities] = useState(true);

    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(25 * 60);
    const [secondsLeft, setSecondsLeft] = useState(25 * 60);

    const timerRef = useRef(null);

    // Listen to user's scheduled activities for today in real time
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoadingActivities(false);
            return;
        }

        const today = getTodayDateString();
        const q = query(
            collection(db, 'users', user.uid, 'activities'),
            where('date', '==', today)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((d) => {
                list.push({ id: d.id, ...d.data() });
            });
            setTodayActivities(list);
            setLoadingActivities(false);
        }, (error) => {
            console.error('Error fetching today activities for Focus:', error);
            setLoadingActivities(false);
        });

        return unsubscribe;
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Restore active focus session if running or paused in AsyncStorage
    const restoreActiveSession = async () => {
        try {
            const sessionStr = await AsyncStorage.getItem('focus_session_state');
            if (!sessionStr) return;

            const session = JSON.parse(sessionStr);
            if (!session) return;

            const {
                status,
                targetEndTime,
                secondsLeft: savedSecondsLeft,
                totalSeconds: savedTotalSeconds,
                selectedActivity: savedActivity,
            } = session;

            if (status === 'paused') {
                setTotalSeconds(savedTotalSeconds);
                setSecondsLeft(savedSecondsLeft);
                setSelectedActivity(savedActivity);
                setIsActive(false);
            } else if (status === 'running') {
                const timeLeft = Math.round((targetEndTime - Date.now()) / 1000);
                if (timeLeft > 0) {
                    setTotalSeconds(savedTotalSeconds);
                    setSecondsLeft(timeLeft);
                    setSelectedActivity(savedActivity);
                    startTimer(timeLeft, savedActivity, savedTotalSeconds);
                } else {
                    // Completed while closed/backgrounded!
                    await AsyncStorage.removeItem('focus_session_state');
                    setTotalSeconds(savedTotalSeconds);
                    setSecondsLeft(0);
                    setSelectedActivity(savedActivity);

                    Vibration.vibrate([0, 500, 250, 500]);
                    notificationService.triggerFocusCompleteNotification();
                    Alert.alert(
                        'Session Complete! 🎉',
                        'Excellent job staying focused on your task.',
                        [
                            {
                                text: 'Done',
                                onPress: () => {
                                    saveSession(true, savedActivity, savedTotalSeconds, 0);
                                    setSecondsLeft(savedTotalSeconds);
                                },
                            },
                        ]
                    );
                }
            }
        } catch (err) {
            console.log('Error restoring active focus session:', err);
        }
    };

    // Load active session on mount
    useEffect(() => {
        restoreActiveSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen to AppState to handle background/foreground transitions
    useEffect(() => {
        const handleAppStateChange = (nextAppState) => {
            if (nextAppState === 'active') {
                if (!isActive) {
                    restoreActiveSession();
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    const startTimer = (secondsToStart, activityToUse, totalToUse) => {
        if (isActive) return;
        setIsActive(true);

        const secs = typeof secondsToStart === 'number' ? secondsToStart : secondsLeft;
        const act = (activityToUse && typeof activityToUse === 'object' && 'id' in activityToUse) ? activityToUse : selectedActivity;
        const tot = typeof totalToUse === 'number' ? totalToUse : totalSeconds;

        const targetEnd = Date.now() + secs * 1000;
        AsyncStorage.setItem(
            'focus_session_state',
            JSON.stringify({
                status: 'running',
                targetEndTime: targetEnd,
                totalSeconds: tot,
                selectedActivity: act,
            })
        ).catch((err) => console.log('Error saving start session state:', err));

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setIsActive(false);
                    AsyncStorage.removeItem('focus_session_state').catch((err) => console.log(err));
                    handleTimerComplete(act, tot);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const pauseTimer = () => {
        if (!isActive) return;
        clearInterval(timerRef.current);
        setIsActive(false);

        AsyncStorage.setItem(
            'focus_session_state',
            JSON.stringify({
                status: 'paused',
                secondsLeft: secondsLeft,
                totalSeconds: totalSeconds,
                selectedActivity: selectedActivity,
            })
        ).catch((err) => console.log('Error saving pause session state:', err));
    };

    const resetTimer = () => {
        clearInterval(timerRef.current);
        setIsActive(false);
        setSecondsLeft(totalSeconds);
        AsyncStorage.removeItem('focus_session_state').catch((err) => console.log(err));
    };

    const stopTimer = () => {
        Alert.alert(
            'Stop Focus Session',
            'Are you sure you want to stop this focus session early?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop',
                    style: 'destructive',
                    onPress: async () => {
                        clearInterval(timerRef.current);
                        setIsActive(false);
                        await AsyncStorage.removeItem('focus_session_state').catch((err) =>
                            console.log(err)
                        );
                        saveSession(false);
                        setSecondsLeft(totalSeconds);
                    },
                },
            ]
        );
    };

    const handleTimerComplete = (activityToUse = selectedActivity, totalToUse = totalSeconds) => {
        Vibration.vibrate([0, 500, 250, 500]);
        AsyncStorage.removeItem('focus_session_state').catch((err) => console.log(err));
        notificationService.triggerFocusCompleteNotification();

        Alert.alert(
            'Session Complete! 🎉',
            'Excellent job staying focused on your task.',
            [
                {
                    text: 'Done',
                    onPress: () => {
                        saveSession(true, activityToUse, totalToUse, 0);
                        setSecondsLeft(totalToUse);
                    },
                },
            ]
        );
    };

    const saveSession = async (completed, activityToUse = selectedActivity, totalToUse = totalSeconds, secondsLeftToUse = secondsLeft) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const durationMin = Math.round(totalToUse / 60);
            const actualFocusedMin = completed
                ? durationMin
                : Math.round((totalToUse - secondsLeftToUse) / 60);

            // Skip saving if session was less than 1 minute and was aborted early
            if (actualFocusedMin <= 0 && !completed) {
                console.log('Session aborted too early to log in database.');
                return;
            }

            const data = {
                durationMinutes: durationMin,
                actualFocusedMinutes: actualFocusedMin,
                completed,
                createdAt: serverTimestamp(),
                activityTitle: activityToUse ? activityToUse.title : 'Quick Focus',
                activityId: activityToUse ? activityToUse.id : null,
                category: activityToUse ? activityToUse.category : 'other',
            };

            await addDoc(collection(db, 'users', user.uid, 'focusSessions'), data);
            console.log('Focus session logged successfully.');

            // Update user streak if session completed successfully
            if (completed) {
                const userDocRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const todayStr = getTodayDateString();
                    const yesterdayStr = getYesterdayDateString(todayStr);

                    let currentStreak = Number(userData.currentStreak || 0);
                    let bestStreak = Number(userData.bestStreak || 0);
                    const lastActiveFocusDate = userData.lastActiveFocusDate || '';

                    if (lastActiveFocusDate === todayStr) {
                        console.log('Already completed focus session today. Streak is unchanged.');
                    } else if (lastActiveFocusDate === yesterdayStr) {
                        currentStreak += 1;
                        if (currentStreak > bestStreak) {
                            bestStreak = currentStreak;
                        }
                        await updateDoc(userDocRef, {
                            currentStreak,
                            bestStreak,
                            lastActiveFocusDate: todayStr,
                        });
                    } else {
                        currentStreak = 1;
                        if (bestStreak === 0) {
                            bestStreak = 1;
                        }
                        await updateDoc(userDocRef, {
                            currentStreak,
                            bestStreak,
                            lastActiveFocusDate: todayStr,
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error logging focus session:', err);
        }
    };

    const selectPreset = (minutes) => {
        if (isActive) return;
        const secs = minutes * 60;
        setTotalSeconds(secs);
        setSecondsLeft(secs);
    };

    // Formatter for countdown display
    const formatTime = (totalSecs) => {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // Calculate SVG circular stroke properties
    const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

    const activeTaskTitle = selectedActivity ? selectedActivity.title : 'Quick Focus';
    const activeTaskCategory = selectedActivity ? selectedActivity.category : 'other';
    const categoryColor = CATEGORY_COLORS[activeTaskCategory] || CATEGORY_COLORS.other;
    const categoryLabel = activeTaskCategory.toUpperCase();
    const isPaused = !isActive && secondsLeft < totalSeconds;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Focus</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* 1. TOP SEGMENTED PRESETS BAR */}
                <View style={styles.segmentedContainer}>
                    {PRESETS.map((minutes) => {
                        const isSelected = totalSeconds === minutes * 60;
                        return (
                            <TouchableOpacity
                                key={minutes}
                                activeOpacity={0.8}
                                style={[
                                    styles.segmentedItem,
                                    isSelected && styles.segmentedItemActive,
                                    isActive && styles.segmentedItemDisabled,
                                ]}
                                onPress={() => selectPreset(minutes)}
                                disabled={isActive}
                            >
                                <Text
                                    style={[
                                        styles.segmentedText,
                                        isSelected && styles.segmentedTextActive,
                                    ]}
                                >
                                    {minutes}m
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 2. TARGET / SELECTED TASK TAG */}
                <View style={styles.targetSection}>
                    <View style={[styles.targetCategoryTag, { borderColor: categoryColor + '55', backgroundColor: categoryColor + '14' }]}>
                        <AppIcon
                            name={CATEGORY_ICONS[activeTaskCategory] || 'other'}
                            size={12}
                            color={categoryColor}
                            strokeWidth={2.2}
                            style={{ marginRight: 5 }}
                        />
                        <Text style={[styles.targetCategoryText, { color: categoryColor }]}>
                            {categoryLabel}
                        </Text>
                    </View>
                    <Text style={styles.targetTitle} numberOfLines={1}>
                        {activeTaskTitle}
                    </Text>
                </View>

                {/* 3. CENTER HERO: Circular Timer Centerpiece */}
                <View style={styles.timerSection}>
                    <View style={styles.timerDish}>
                        <Svg width="226" height="226" style={styles.svg}>
                            <Defs>
                                <LinearGradient id="focusProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#06B6D4" />
                                    <Stop offset="100%" stopColor="#8B5CF6" />
                                </LinearGradient>
                            </Defs>
                            {/* Inner subtle guide track */}
                            <Circle
                                cx="113"
                                cy="113"
                                r="80"
                                stroke="#1B202D"
                                strokeWidth="1.2"
                                fill="transparent"
                                strokeDasharray="3 5"
                            />
                            {/* Outer background track */}
                            <Circle
                                cx="113"
                                cy="113"
                                r={CIRCLE_RADIUS}
                                stroke="#161924"
                                strokeWidth="12"
                                fill="transparent"
                            />
                            {/* Glowing progress ring */}
                            <Circle
                                cx="113"
                                cy="113"
                                r={CIRCLE_RADIUS}
                                stroke="url(#focusProgressGrad)"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                            />
                        </Svg>

                        {/* Remaining time in center & status pill */}
                        <View style={styles.timeLabelContainer}>
                            <Text style={styles.sessionStatusTextTop}>REMAINING</Text>
                            <Text style={styles.timeLabel}>{formatTime(secondsLeft)}</Text>
                            <View
                                style={[
                                    styles.statusPill,
                                    isActive
                                        ? styles.statusPillActive
                                        : isPaused
                                        ? styles.statusPillPaused
                                        : styles.statusPillReady,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.statusDot,
                                        isActive
                                            ? styles.statusDotActive
                                            : isPaused
                                            ? styles.statusDotPaused
                                            : styles.statusDotReady,
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.statusPillText,
                                        isActive
                                            ? styles.statusTextActive
                                            : isPaused
                                            ? styles.statusTextPaused
                                            : styles.statusTextReady,
                                    ]}
                                >
                                    {isActive ? 'ACTIVE FOCUS' : isPaused ? 'TIMER PAUSED' : 'READY'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 4. ACTIVITY ASSOCIATION (Anchored in cohesive card) */}
                <View style={styles.focusTaskCard}>
                    <View style={styles.focusTaskCardHeader}>
                        <View style={styles.focusTaskHeaderLeft}>
                            <AppIcon name="target" size={12} color="#06B6D4" strokeWidth={2.4} />
                            <Text style={styles.focusTaskCardLabel}>FOCUS TASK</Text>
                        </View>
                        <Text style={styles.focusTaskCount}>
                            {todayActivities.length > 0 ? `${todayActivities.length} scheduled` : 'Quick Focus'}
                        </Text>
                    </View>
                    {loadingActivities ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="small" color="#06B6D4" />
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.activitiesRow}
                            contentContainerStyle={styles.activitiesContent}
                        >
                            {/* Quick Focus option */}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={[
                                    styles.activityChip,
                                    !selectedActivity && styles.activityChipActive,
                                    isActive && styles.disabledActivityChip,
                                ]}
                                onPress={() => setSelectedActivity(null)}
                                disabled={isActive}
                            >
                                <AppIcon
                                    name="target"
                                    size={13}
                                    color={!selectedActivity ? '#080B11' : '#06B6D4'}
                                    strokeWidth={2.4}
                                />
                                <Text
                                    style={[
                                        styles.activityChipText,
                                        !selectedActivity && styles.activityChipTextActive,
                                    ]}
                                >
                                    Quick Focus
                                </Text>
                            </TouchableOpacity>

                            {/* Today's activities */}
                            {todayActivities.map((act) => {
                                const isSelected = selectedActivity?.id === act.id;
                                const catColor = CATEGORY_COLORS[act.category] || '#06B6D4';
                                return (
                                    <TouchableOpacity
                                        key={act.id}
                                        activeOpacity={0.8}
                                        style={[
                                            styles.activityChip,
                                            isSelected && styles.activityChipActive,
                                            isActive && styles.disabledActivityChip,
                                        ]}
                                        onPress={() => setSelectedActivity(act)}
                                        disabled={isActive}
                                    >
                                        <AppIcon
                                            name={CATEGORY_ICONS[act.category] || 'other'}
                                            size={13}
                                            color={isSelected ? '#080B11' : catColor}
                                            strokeWidth={2.2}
                                        />
                                        <Text
                                            style={[
                                                styles.activityChipText,
                                                isSelected && styles.activityChipTextActive,
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {act.title}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* 5. CONTROLS: Side-by-Side Rounded Pill Buttons (Matching Reference Design) */}
                <View style={styles.controlsSection}>
                    {!isActive && !isPaused ? (
                        /* Ready State: Single Wide Start Pill Button */
                        <TouchableOpacity
                            style={styles.startFullPill}
                            activeOpacity={0.85}
                            onPress={() => startTimer()}
                        >
                            <AppIcon
                                name="play"
                                size={18}
                                color="#080B11"
                                fill="#080B11"
                                strokeWidth={2.5}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.startFullPillText}>Start Focus</Text>
                        </TouchableOpacity>
                    ) : isActive ? (
                        /* Running State: Side-by-Side Pause & Stop Pill Buttons */
                        <View style={styles.pillControlsRow}>
                            <TouchableOpacity
                                style={styles.pausePill}
                                activeOpacity={0.85}
                                onPress={pauseTimer}
                            >
                                <AppIcon
                                    name="pause"
                                    size={16}
                                    color="#06B6D4"
                                    fill="#06B6D4"
                                    strokeWidth={2.4}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.pausePillText}>Pause</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.stopPill}
                                activeOpacity={0.85}
                                onPress={stopTimer}
                            >
                                <AppIcon
                                    name="stop"
                                    size={15}
                                    color="#FFFFFF"
                                    fill="#FFFFFF"
                                    strokeWidth={2.4}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.stopPillText}>Stop</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* Paused State: Side-by-Side Resume & Reset Pill Buttons */
                        <View style={styles.pillControlsRow}>
                            <TouchableOpacity
                                style={styles.resumePill}
                                activeOpacity={0.85}
                                onPress={() => startTimer()}
                            >
                                <AppIcon
                                    name="play"
                                    size={16}
                                    color="#080B11"
                                    fill="#080B11"
                                    strokeWidth={2.5}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.resumePillText}>Resume</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.resetPill}
                                activeOpacity={0.85}
                                onPress={resetTimer}
                            >
                                <AppIcon
                                    name="reset"
                                    size={16}
                                    color="#8E9AA8"
                                    strokeWidth={2.4}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.resetPillText}>Reset</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = ScaledSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0E14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '16@ms',
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 22),
        paddingBottom: '12@ms',
        borderBottomWidth: 1,
        borderColor: '#171C26',
        backgroundColor: '#0B0E14',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: '16@ms',
        fontWeight: '800',
    },
    scrollContent: {
        paddingHorizontal: '16@ms',
        paddingBottom: '36@ms',
    },
    targetSection: {
        alignItems: 'center',
        marginTop: '8@ms',
        marginBottom: '6@ms',
    },
    targetCategoryTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: '3@ms',
        paddingHorizontal: '10@ms',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: '4@ms',
    },
    targetCategoryDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: '6@ms',
    },
    targetCategoryText: {
        fontSize: '9.5@ms',
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    targetTitle: {
        color: '#FFFFFF',
        fontSize: '18@ms',
        fontWeight: '800',
        textAlign: 'center',
    },
    timerSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: '10@ms',
    },
    timerDish: {
        position: 'relative',
        width: 226,
        height: 226,
        borderRadius: 113,
        backgroundColor: '#11141F',
        borderWidth: 1,
        borderColor: '#1C2232',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
    },
    svg: {
        position: 'absolute',
        transform: [{ rotate: '-90deg' }],
    },
    timeLabelContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeLabel: {
        color: '#FFFFFF',
        fontSize: '44@ms',
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    sessionStatusTextTop: {
        color: '#5B6676',
        fontSize: '8.5@ms',
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: '2@ms',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: '12@ms',
        paddingVertical: '3@ms',
        borderRadius: 12,
        marginTop: '4@ms',
    },
    statusPillActive: {
        backgroundColor: 'rgba(6, 182, 212, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.35)',
    },
    statusPillPaused: {
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    statusPillReady: {
        backgroundColor: '#161924',
        borderWidth: 1,
        borderColor: '#22283A',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: '6@ms',
    },
    statusDotActive: {
        backgroundColor: '#06B6D4',
    },
    statusDotPaused: {
        backgroundColor: '#F59E0B',
    },
    statusDotReady: {
        backgroundColor: '#5B6676',
    },
    statusPillText: {
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    statusTextActive: {
        color: '#06B6D4',
    },
    statusTextPaused: {
        color: '#F59E0B',
    },
    statusTextReady: {
        color: '#5B6676',
    },
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: '#121520',
        borderRadius: 20,
        padding: 4,
        borderWidth: 1,
        borderColor: '#1C2130',
        marginVertical: '10@ms',
    },
    segmentedItem: {
        flex: 1,
        height: 34,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    segmentedItemActive: {
        backgroundColor: '#06B6D4',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 3,
    },
    segmentedItemDisabled: {
        opacity: 0.45,
    },
    segmentedText: {
        color: '#64748B',
        fontSize: '12@ms',
        fontWeight: '700',
    },
    segmentedTextActive: {
        color: '#080B11',
        fontWeight: '900',
    },
    focusTaskCard: {
        backgroundColor: '#121520',
        borderWidth: 1,
        borderColor: '#1C2130',
        borderRadius: 18,
        padding: '12@ms',
        marginTop: '6@ms',
    },
    focusTaskCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8@ms',
    },
    focusTaskHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6@ms',
    },
    focusTaskCardLabel: {
        color: '#64748B',
        fontSize: '9.5@ms',
        fontWeight: '800',
        letterSpacing: 1,
    },
    focusTaskCount: {
        color: '#8E9AA8',
        fontSize: '11@ms',
        fontWeight: '600',
    },
    activitiesRow: {
        marginBottom: '2@ms',
    },
    activitiesContent: {
        gap: '8@ms',
    },
    activityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: '12@ms',
        borderRadius: 18,
        backgroundColor: '#161926',
        borderWidth: 1,
        borderColor: '#22283A',
        gap: '6@ms',
    },
    activityChipActive: {
        borderColor: '#06B6D4',
        backgroundColor: '#06B6D4',
    },
    disabledActivityChip: {
        opacity: 0.45,
    },
    activityChipText: {
        color: '#8E9AA8',
        fontSize: '12@ms',
        fontWeight: '700',
    },
    activityChipTextActive: {
        color: '#080B11',
        fontWeight: '900',
    },
    loadingBox: {
        height: '40@vs',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsSection: {
        marginTop: '14@ms',
        marginBottom: '24@ms',
    },
    startFullPill: {
        height: 52,
        borderRadius: 26,
        backgroundColor: '#06B6D4',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    startFullPillText: {
        color: '#080B11',
        fontSize: '15@ms',
        fontWeight: '900',
    },
    pillControlsRow: {
        flexDirection: 'row',
        gap: '12@ms',
    },
    pausePill: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#141724',
        borderWidth: 1.5,
        borderColor: '#06B6D4',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pausePillText: {
        color: '#06B6D4',
        fontSize: '15@ms',
        fontWeight: '800',
    },
    stopPill: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#EF4444',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    stopPillText: {
        color: '#FFFFFF',
        fontSize: '15@ms',
        fontWeight: '900',
    },
    resumePill: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#06B6D4',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    resumePillText: {
        color: '#080B11',
        fontSize: '15@ms',
        fontWeight: '900',
    },
    resetPill: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#161A24',
        borderWidth: 1.5,
        borderColor: '#23293A',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetPillText: {
        color: '#8E9AA8',
        fontSize: '15@ms',
        fontWeight: '800',
    },
});
