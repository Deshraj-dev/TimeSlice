import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    Platform,
} from 'react-native';
import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import ActivityModal from '../components/ActivityModal';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../components/AppIcon';
import {
    getTodayDateString,
    formatDateToReadable,
    getDateStripRange,
    parseTimeToMinutes,
    formatDuration,
    formatMinutesToTime,
} from '../utils/dateHelpers';

const CATEGORY_MAP = {
    work: { label: 'Work', icon: 'work', color: '#06B6D4' },
    study: { label: 'Study', icon: 'study', color: '#8B5CF6' },
    exercise: { label: 'Exercise', icon: 'exercise', color: '#10B981' },
    lunch: { label: 'Lunch', icon: 'lunch', color: '#F97316' },
    leisure: { label: 'Leisure', icon: 'leisure', color: '#3B82F6' },
    other: { label: 'Other', icon: 'other', color: '#64748B' },
};

export default function HomeScreen({ navigation }) {
    const [selectedDate, setSelectedDate] = useState(getTodayDateString());
    const [activities, setActivities] = useState([]);
    const [currentTime, setCurrentTime] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [dateStrip, setDateStrip] = useState([]);
    const [dailyGoalHours, setDailyGoalHours] = useState(4);
    const [focusMinutesToday, setFocusMinutesToday] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [displayName, setDisplayName] = useState('');

    // Listen to user document for goals, streaks, and profile details
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.dailyGoalHours) {
                    setDailyGoalHours(Number(data.dailyGoalHours));
                }
                setCurrentStreak(Number(data.currentStreak || 0));
                setDisplayName(data.displayName || '');
            }
        }, (err) => {
            console.log('Error listening to user doc:', err);
        });

        return unsubscribe;
    }, []);

    // Listen to focus sessions of the selected date to compute total focused time today
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const startOfDay = new Date(selectedDate + 'T00:00:00');
        const endOfDay = new Date(selectedDate + 'T23:59:59');

        const q = query(
            collection(db, 'users', user.uid, 'focusSessions'),
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<=', endOfDay)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let total = 0;
            snapshot.forEach((d) => {
                const data = d.data();
                total += (data.actualFocusedMinutes || 0);
            });
            setFocusMinutesToday(total);
        }, (error) => {
            console.log('Error listening to focus sessions:', error);
        });

        return unsubscribe;
    }, [selectedDate]);

    // Periodically update the device current time to compute dashboard metrics
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            setCurrentTime(`${hh}:${mm}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // Generate date strip centered around today
    useEffect(() => {
        setDateStrip(getDateStripRange(getTodayDateString()));
    }, []);

    // Firestore listener for selected date activities
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        let isMounted = true;
        let hasRetried = false;
        let activeUnsubscribe = null;

        const q = query(
            collection(db, 'users', user.uid, 'activities'),
            where('date', '==', selectedDate)
        );

        const handleSnapshot = (snapshot) => {
            if (!isMounted) return;

            const fetched = [];
            snapshot.forEach((d) => {
                fetched.push({ id: d.id, ...d.data() });
            });

            // Sort chronologically by startTime
            fetched.sort((a, b) => {
                const startA = parseTimeToMinutes(a.startTime);
                const startB = parseTimeToMinutes(b.startTime);
                return startA - startB;
            });

            setActivities(fetched);
        };

        const handleError = async (error) => {
            if (!isMounted) return;

            if (error?.code === 'permission-denied' && auth.currentUser && !hasRetried) {
                hasRetried = true;
                try {
                    await auth.currentUser.getIdToken(true);
                    if (!isMounted) return;
                    activeUnsubscribe = onSnapshot(q, handleSnapshot, handleError);
                    return;
                } catch (refreshErr) {
                    console.warn('Token refresh during activities listener retry failed:', refreshErr);
                }
            }

            console.error('Firestore load error:', error);
            Alert.alert('Load Error', 'Failed to retrieve schedule activities.');
        };

        activeUnsubscribe = onSnapshot(q, handleSnapshot, handleError);

        return () => {
            isMounted = false;
            if (activeUnsubscribe) {
                activeUnsubscribe();
            }
        };
    }, [selectedDate]);

    // Calculate metrics
    const currentMin = parseTimeToMinutes(currentTime);
    const isSelectedToday = selectedDate === getTodayDateString();

    let totalPlannedMin = 0;
    let completedMin = 0;
    let currentActivity = null;
    let upcomingActivity = null;

    activities.forEach((act) => {
        const startMin = parseTimeToMinutes(act.startTime);
        const endMin = parseTimeToMinutes(act.endTime);
        const duration = endMin - startMin;
        totalPlannedMin += duration;

        if (!isSelectedToday) {
            const todayStr = getTodayDateString();
            if (selectedDate < todayStr) {
                completedMin += duration;
            }
        } else {
            if (endMin <= currentMin) {
                completedMin += duration;
            } else if (startMin <= currentMin && currentMin < endMin) {
                completedMin += currentMin - startMin;
                currentActivity = act;
            } else if (startMin > currentMin) {
                if (!upcomingActivity) {
                    upcomingActivity = act;
                }
            }
        }
    });

    const progressPercent =
        totalPlannedMin > 0 ? Math.round((completedMin / totalPlannedMin) * 100) : 0;

    // Generate timeline slices (merges activities and empty time gaps)
    const generateTimeSlices = () => {
        if (activities.length === 0) return [];
        const slices = [];
        let currentMarker = parseTimeToMinutes(activities[0].startTime);

        activities.forEach((act) => {
            const actStartMin = parseTimeToMinutes(act.startTime);
            const actEndMin = parseTimeToMinutes(act.endTime);

            // Add gap slice if there is empty time
            if (actStartMin > currentMarker) {
                slices.push({
                    type: 'gap',
                    startTime: formatMinutesToTime(currentMarker),
                    endTime: formatMinutesToTime(actStartMin),
                    duration: actStartMin - currentMarker,
                });
            }

            // Add activity slice
            slices.push({
                type: 'activity',
                activity: act,
                startTime: act.startTime,
                endTime: act.endTime,
                duration: actEndMin - actStartMin,
            });

            currentMarker = actEndMin;
        });

        return slices;
    };

    const timeSlices = generateTimeSlices();

    // Friendly display name for header
    const userEmail = auth.currentUser?.email || '';
    const cleanUsername = displayName || (userEmail ? userEmail.split('@')[0] : 'there');
    const formattedGreetingName = cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

    const getGreetingPhrase = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const profileInitial = displayName
        ? displayName.charAt(0).toUpperCase()
        : (userEmail ? userEmail.charAt(0).toUpperCase() : 'U');

    // Hero progress circle setup
    const heroRadius = 38;
    const heroCircumference = 2 * Math.PI * heroRadius;
    const heroStrokeDashoffset = heroCircumference - (Math.min(progressPercent, 100) / 100) * heroCircumference;

    // Compute dynamic featured activity text (active now or upcoming next)
    const featuredTask = currentActivity || upcomingActivity;
    const isCurrentTask = !!currentActivity;
    let countdownText = '';
    if (currentActivity && isSelectedToday) {
        const endMin = parseTimeToMinutes(currentActivity.endTime);
        const remaining = endMin - currentMin;
        countdownText = remaining > 0 ? `Ends in ${remaining}m` : 'Ending now';
    } else if (upcomingActivity && isSelectedToday) {
        const startMin = parseTimeToMinutes(upcomingActivity.startTime);
        const diff = startMin - currentMin;
        if (diff > 0) {
            countdownText = `Starts in ${diff}m`;
        }
    }

    return (
        <View style={styles.container}>
            {/* 1. Header & Date Strip */}
            <View style={styles.fixedHeader}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.avatarCircle}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('Profile')}
                        >
                            <Text style={styles.avatarInitial}>{profileInitial}</Text>
                        </TouchableOpacity>
                        <View style={styles.greetingTextContainer}>
                            <Text style={styles.greetingSub}>
                                {getGreetingPhrase()}{formattedGreetingName ? `, ${formattedGreetingName}` : ''}
                            </Text>
                            <Text style={styles.dateLabel}>{formatDateToReadable(selectedDate)}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.calendarHeaderButton}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('Calendar')}
                    >
                        <AppIcon name="calendar" size={13} color="#06B6D4" strokeWidth={2.2} />
                        <Text style={styles.calendarHeaderText}>Planner</Text>
                    </TouchableOpacity>
                </View>

                {/* Horizontal Date Selector (compact rounded/pill cards) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.dateStripScroll}
                    contentContainerStyle={styles.dateStripContent}
                >
                    {dateStrip.map((item) => {
                        const isSelected = item.dateStr === selectedDate;
                        const isToday = item.dateStr === getTodayDateString();
                        return (
                            <TouchableOpacity
                                key={item.dateStr}
                                activeOpacity={0.8}
                                style={[
                                    styles.dateCard,
                                    isSelected && styles.dateCardSelected,
                                    isToday && !isSelected && styles.dateCardToday,
                                ]}
                                onPress={() => setSelectedDate(item.dateStr)}
                            >
                                <Text
                                    style={[
                                        styles.dateDayName,
                                        isSelected && styles.dateTextSelected,
                                    ]}
                                >
                                    {item.dayName}
                                </Text>
                                <Text
                                    style={[
                                        styles.dateDayNum,
                                        isSelected && styles.dateTextSelected,
                                        isToday && !isSelected && styles.dateDayNumToday,
                                    ]}
                                >
                                    {item.dayNum}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* 2. Hero Productivity Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroInnerRow}>
                        {/* Progress Ring Visualization */}
                        <View style={styles.progressCircleContainer}>
                            <Svg width="92" height="92" style={styles.progressCircleSvg}>
                                <Defs>
                                    <LinearGradient id="heroProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <Stop offset="0%" stopColor="#06B6D4" />
                                        <Stop offset="100%" stopColor="#8B5CF6" />
                                    </LinearGradient>
                                </Defs>
                                <Circle
                                    cx="46"
                                    cy="46"
                                    r={heroRadius}
                                    stroke="#1D2434"
                                    strokeWidth="7"
                                    fill="transparent"
                                />
                                <Circle
                                    cx="46"
                                    cy="46"
                                    r={heroRadius}
                                    stroke="url(#heroProgressGrad)"
                                    strokeWidth="7"
                                    fill="transparent"
                                    strokeDasharray={`${heroCircumference} ${heroCircumference}`}
                                    strokeDashoffset={heroStrokeDashoffset}
                                    strokeLinecap="round"
                                    transform="rotate(-90 46 46)"
                                />
                            </Svg>
                            <View style={styles.progressCircleCenterText}>
                                <Text style={styles.progressPercent}>{progressPercent}%</Text>
                                <Text style={styles.progressSubtext}>DONE</Text>
                            </View>
                        </View>

                        {/* Metrics Grid */}
                        <View style={styles.metricsGrid}>
                            <View style={styles.metricColumn}>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricItemLabel}>PLANNED</Text>
                                    <Text style={styles.metricItemValue}>{formatDuration(totalPlannedMin)}</Text>
                                </View>
                                <View style={[styles.metricItem, { marginTop: moderateScale(10) }]}>
                                    <Text style={styles.metricItemLabel}>STREAK</Text>
                                    <View style={styles.streakValueRow}>
                                        <AppIcon name="flame" size={13} color="#F59E0B" fill="#F59E0B" />
                                        <Text style={styles.metricItemValue}>{currentStreak}d</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.metricColumn}>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricItemLabel}>FOCUSED</Text>
                                    <Text style={styles.metricItemValue}>{formatDuration(focusMinutesToday)}</Text>
                                </View>
                                <View style={[styles.metricItem, { marginTop: moderateScale(10) }]}>
                                    <Text style={styles.metricItemLabel}>GOAL</Text>
                                    <Text style={styles.metricItemValue}>{dailyGoalHours}h</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 3. Quick Actions Row */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.primaryAction}
                        activeOpacity={0.85}
                        onPress={() => {
                            setEditingActivity(null);
                            setIsModalVisible(true);
                        }}
                    >
                        <AppIcon name="plus" size={16} color="#080B11" strokeWidth={2.6} style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionText}>Add Activity</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryAction}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('Focus')}
                    >
                        <AppIcon name="play" size={13} color="#A78BFA" fill="#A78BFA" strokeWidth={2.4} style={{ marginRight: 6 }} />
                        <Text style={styles.secondaryActionText}>Focus</Text>
                    </TouchableOpacity>
                </View>

                {/* 4. Featured Activity (Active Now or Next Task) - Only shown when a real activity exists */}
                {featuredTask && (
                    <View style={styles.upcomingCard}>
                        <View style={styles.upcomingHeader}>
                            <Text style={styles.upcomingTag}>{isCurrentTask ? 'ACTIVE NOW' : 'NEXT TASK'}</Text>
                            {countdownText ? (
                                <View style={[styles.countdownBadge, isCurrentTask && styles.countdownBadgeActive]}>
                                    <Text style={[styles.countdownBadgeText, isCurrentTask && styles.countdownBadgeTextActive]}>{countdownText}</Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.upcomingRow}>
                            <View style={[styles.upcomingCategoryPill, { backgroundColor: (CATEGORY_MAP[featuredTask.category]?.color || '#06B6D4') + '22' }]}>
                                <AppIcon
                                    name={CATEGORY_MAP[featuredTask.category]?.icon || 'other'}
                                    size={16}
                                    color={CATEGORY_MAP[featuredTask.category]?.color || '#06B6D4'}
                                    strokeWidth={2.2}
                                />
                            </View>
                            <View style={styles.upcomingTextContainer}>
                                <Text style={styles.upcomingTitle} numberOfLines={1}>
                                    {featuredTask.title}
                                </Text>
                                <Text style={styles.upcomingTime}>
                                    {featuredTask.startTime} – {featuredTask.endTime} ({formatDuration(
                                        parseTimeToMinutes(featuredTask.endTime) -
                                            parseTimeToMinutes(featuredTask.startTime)
                                    )})
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* 5. Schedule Timeline */}
                <SectionHeader title="Today's Schedule Timeline" />

                {activities.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIcon}>
                            <AppIcon name="clock" size={26} color="#06B6D4" strokeWidth={2} />
                        </View>
                        <Text style={styles.emptyTitle}>Your schedule is empty</Text>
                        <Text style={styles.emptyText}>
                            Add activities to plan your focus slots for this date.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyPlanButton}
                            activeOpacity={0.8}
                            onPress={() => {
                                setEditingActivity(null);
                                setIsModalVisible(true);
                            }}
                        >
                            <AppIcon name="plus" size={13} color="#06B6D4" strokeWidth={2.5} style={{ marginRight: 6 }} />
                            <Text style={styles.emptyPlanButtonText}>Schedule Activity</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {timeSlices.map((slice, idx) => {
                            const isGap = slice.type === 'gap';

                            if (isGap) {
                                return (
                                    <View key={`gap-${idx}`} style={styles.timelineRow}>
                                        {/* Left Side: Time */}
                                        <View style={styles.timelineTimeColumn}>
                                            <Text style={styles.timelineTimeText}>{slice.startTime}</Text>
                                        </View>

                                        {/* Middle: Line & Dot */}
                                        <View style={styles.timelineTrackColumn}>
                                            <View style={styles.timelineTrackLine} />
                                            <View style={styles.timelineTrackDotGap} />
                                            <View style={styles.timelineTrackHorizontalNotch} />
                                        </View>

                                        {/* Right Side: Gap Card */}
                                        <View style={styles.timelineContentColumn}>
                                            <View style={styles.sliceCardGap}>
                                                <Text style={styles.gapTitle}>
                                                    Free slot ({formatDuration(slice.duration)})
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.gapPlanButton}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setEditingActivity({
                                                            startTime: slice.startTime,
                                                            endTime: slice.endTime,
                                                            date: selectedDate,
                                                        });
                                                        setIsModalVisible(true);
                                                    }}
                                                >
                                                    <Text style={styles.gapPlanButtonText}>+ Plan</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            } else {
                                const act = slice.activity;
                                const cat = CATEGORY_MAP[act.category] || CATEGORY_MAP.other;
                                const isCurrent =
                                    isSelectedToday &&
                                    parseTimeToMinutes(act.startTime) <= currentMin &&
                                    currentMin < parseTimeToMinutes(act.endTime);

                                return (
                                    <View key={`act-${act.id}`} style={styles.timelineRow}>
                                        {/* Left Side: Time */}
                                        <View style={styles.timelineTimeColumn}>
                                            <Text style={styles.timelineTimeText}>{slice.startTime}</Text>
                                        </View>

                                        {/* Middle: Line & Dot */}
                                        <View style={styles.timelineTrackColumn}>
                                            <View style={styles.timelineTrackLine} />
                                            <View
                                                style={[
                                                    styles.timelineTrackDot,
                                                    { backgroundColor: cat.color },
                                                    isCurrent && styles.timelineTrackDotLive,
                                                ]}
                                            />
                                            <View style={styles.timelineTrackHorizontalNotch} />
                                        </View>

                                        {/* Right Side: Activity Card */}
                                        <View style={styles.timelineContentColumn}>
                                            <TouchableOpacity
                                                activeOpacity={0.88}
                                                style={[
                                                    styles.activityCard,
                                                    { borderLeftColor: cat.color },
                                                    isCurrent && styles.activityCardCurrent,
                                                ]}
                                                onPress={() => {
                                                    setEditingActivity(act);
                                                    setIsModalVisible(true);
                                                }}
                                            >
                                                <View style={styles.activityInfo}>
                                                    <View style={styles.titleRow}>
                                                        <View style={[styles.activityCategorySquircle, { backgroundColor: cat.color + '22' }]}>
                                                            <AppIcon name={cat.icon} size={13} color={cat.color} strokeWidth={2.2} />
                                                        </View>
                                                        <Text style={styles.activityTitleText} numberOfLines={1}>
                                                            {act.title}
                                                        </Text>
                                                        {isCurrent && (
                                                            <View style={styles.currentBadge}>
                                                                <Text style={styles.currentBadgeText}>LIVE</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={styles.activityTimeSub}>
                                                        {act.startTime} – {act.endTime} • {formatDuration(slice.duration)}
                                                    </Text>
                                                    {act.notes ? (
                                                        <Text style={styles.activityNotesText} numberOfLines={1}>
                                                            {act.notes}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            }
                        })}
                    </View>
                )}
            </ScrollView>

            <ActivityModal
                visible={isModalVisible}
                onClose={() => {
                    setIsModalVisible(false);
                    setEditingActivity(null);
                }}
                onActivitySaved={() => {
                    setIsModalVisible(false);
                    setEditingActivity(null);
                }}
                activity={editingActivity}
                selectedDate={selectedDate}
            />
        </View>
    );
}

const styles = ScaledSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0E14',
    },
    fixedHeader: {
        backgroundColor: '#0B0E14',
        borderBottomWidth: 1,
        borderColor: '#171C26',
        paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 22),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: '16@ms',
        marginBottom: '12@ms',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '12@ms',
        flex: 1,
    },
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#161B26',
        borderWidth: 1.5,
        borderColor: '#242D40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: '#06B6D4',
        fontSize: '16@ms',
        fontWeight: '800',
    },
    greetingTextContainer: {
        flex: 1,
    },
    greetingSub: {
        color: '#7A889B',
        fontSize: '11@ms',
        fontWeight: '600',
    },
    dateLabel: {
        color: '#FFFFFF',
        fontSize: '17@ms',
        fontWeight: '800',
        marginTop: '1@ms',
    },
    calendarHeaderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6@ms',
        backgroundColor: '#141722',
        paddingHorizontal: '12@ms',
        paddingVertical: '6@ms',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#222838',
    },
    calendarHeaderEmoji: {
        fontSize: '12@ms',
    },
    calendarHeaderText: {
        color: '#06B6D4',
        fontSize: '11@ms',
        fontWeight: '700',
    },
    dateStripScroll: {
        marginBottom: '12@ms',
    },
    dateStripContent: {
        paddingHorizontal: '16@ms',
        gap: '8@ms',
    },
    dateCard: {
        width: 46,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#141722',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E2433',
    },
    dateCardSelected: {
        backgroundColor: '#06B6D4',
        borderColor: '#06B6D4',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 4,
    },
    dateCardToday: {
        borderColor: '#06B6D4',
    },
    dateDayName: {
        color: '#5B6676',
        fontSize: '9@ms',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    dateDayNum: {
        color: '#8E9AA8',
        fontSize: '15@ms',
        fontWeight: '800',
        marginTop: '2@ms',
    },
    dateDayNumToday: {
        color: '#06B6D4',
    },
    dateTextSelected: {
        color: '#080B11',
    },
    scrollContent: {
        paddingHorizontal: '16@ms',
        paddingBottom: '36@ms',
    },
    heroCard: {
        backgroundColor: '#141722',
        borderRadius: 22,
        padding: '14@ms',
        borderWidth: 1,
        borderColor: '#1F2636',
        marginTop: '14@ms',
        marginBottom: '14@ms',
    },
    heroInnerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressCircleContainer: {
        width: 92,
        height: 92,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressCircleSvg: {
        position: 'absolute',
    },
    progressCircleCenterText: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressPercent: {
        color: '#FFFFFF',
        fontSize: '20@ms',
        fontWeight: '800',
    },
    progressSubtext: {
        color: '#5B6676',
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 1,
        marginTop: '1@ms',
    },
    metricsGrid: {
        flex: 1,
        marginLeft: '16@ms',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricColumn: {
        flex: 1,
    },
    metricItem: {
        justifyContent: 'center',
    },
    metricItemLabel: {
        color: '#5B6676',
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    metricItemValue: {
        color: '#FFFFFF',
        fontSize: '15@ms',
        fontWeight: '800',
        marginTop: '2@ms',
    },
    streakValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '4@ms',
        marginTop: '2@ms',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: '10@ms',
        marginBottom: '14@ms',
    },
    primaryAction: {
        flex: 1.35,
        height: 48,
        borderRadius: 24,
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
    secondaryAction: {
        flex: 1.0,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#161A26',
        borderWidth: 1.5,
        borderColor: '#8B5CF6',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionIconPrimary: {
        color: '#080B11',
        fontSize: '18@ms',
        fontWeight: '900',
        marginRight: '6@ms',
    },
    actionIconSecondary: {
        color: '#A78BFA',
        fontSize: '13@ms',
        fontWeight: '900',
        marginRight: '6@ms',
    },
    primaryActionText: {
        color: '#080B11',
        fontSize: '13@ms',
        fontWeight: '800',
    },
    secondaryActionText: {
        color: '#A78BFA',
        fontSize: '13@ms',
        fontWeight: '800',
    },
    upcomingCard: {
        backgroundColor: '#141724',
        borderColor: '#242038',
        borderWidth: 1,
        borderRadius: 16,
        padding: '12@ms',
        marginBottom: '14@ms',
    },
    upcomingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8@ms',
    },
    upcomingTag: {
        color: '#A78BFA',
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 1,
    },
    countdownBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: '8@ms',
        paddingVertical: '2@ms',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.4)',
    },
    countdownBadgeText: {
        color: '#C4B5FD',
        fontSize: '9@ms',
        fontWeight: '800',
    },
    countdownBadgeActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    countdownBadgeTextActive: {
        color: '#10B981',
    },
    upcomingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '10@ms',
    },
    upcomingCategoryPill: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#1D2132',
        justifyContent: 'center',
        alignItems: 'center',
    },
    upcomingCategoryIcon: {
        fontSize: '16@ms',
    },
    upcomingTextContainer: {
        flex: 1,
    },
    upcomingTitle: {
        color: '#FFFFFF',
        fontSize: '14@ms',
        fontWeight: '800',
    },
    upcomingTime: {
        color: '#8E9AA8',
        fontSize: '11@ms',
        fontWeight: '600',
        marginTop: '2@ms',
    },
    upcomingCardEmpty: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#131622',
        borderColor: '#1E2333',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: '14@ms',
        paddingVertical: '10@ms',
        marginBottom: '14@ms',
        gap: '12@ms',
    },
    upcomingEmptyBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1A1E2C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    upcomingEmptyIcon: {
        fontSize: '14@ms',
    },
    upcomingEmptyContent: {
        flex: 1,
    },
    upcomingEmptyTag: {
        color: '#5B6676',
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 1,
    },
    upcomingEmptyText: {
        color: '#8E9AA8',
        fontSize: '12@ms',
        fontWeight: '600',
        marginTop: '1@ms',
    },
    timelineContainer: {
        marginTop: '6@ms',
        marginBottom: '16@ms',
    },
    timelineRow: {
        flexDirection: 'row',
        marginBottom: '12@ms',
    },
    timelineTimeColumn: {
        width: '46@s',
        alignItems: 'flex-start',
        paddingTop: '12@ms',
    },
    timelineTimeText: {
        color: '#8E9AA8',
        fontSize: '12@ms',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    timelineTrackColumn: {
        width: '32@s',
        alignItems: 'center',
        position: 'relative',
    },
    timelineTrackLine: {
        position: 'absolute',
        top: 0,
        bottom: -12,
        width: 2,
        backgroundColor: '#1E2536',
    },
    timelineTrackHorizontalNotch: {
        position: 'absolute',
        top: '18@ms',
        right: 0,
        width: 10,
        height: 2,
        backgroundColor: '#1E2536',
    },
    timelineTrackDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#0B0E14',
        marginTop: '13@ms',
        zIndex: 3,
    },
    timelineTrackDotLive: {
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
        elevation: 4,
    },
    timelineTrackDotGap: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#1E2536',
        marginTop: '15@ms',
        zIndex: 3,
    },
    timelineContentColumn: {
        flex: 1,
    },
    sliceCardGap: {
        flexDirection: 'row',
        backgroundColor: '#10131D',
        borderRadius: 14,
        paddingHorizontal: '12@ms',
        paddingVertical: '10@ms',
        borderWidth: 1,
        borderColor: '#1C212E',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gapTitle: {
        color: '#5B6676',
        fontSize: '12@ms',
        fontWeight: '600',
    },
    gapPlanButton: {
        backgroundColor: '#161924',
        paddingHorizontal: '10@ms',
        paddingVertical: '4@ms',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222838',
    },
    gapPlanButtonText: {
        color: '#06B6D4',
        fontSize: '11@ms',
        fontWeight: '700',
    },
    activityCard: {
        backgroundColor: '#131622',
        borderRadius: 14,
        padding: '12@ms',
        borderWidth: 1,
        borderColor: '#1E2334',
        borderLeftWidth: 3,
    },
    activityCardCurrent: {
        borderColor: '#06B6D4',
        backgroundColor: '#121724',
    },
    activityInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityCategorySquircle: {
        width: 26,
        height: 26,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '8@ms',
    },
    activityCategoryIcon: {
        fontSize: '14@ms',
        marginRight: '6@ms',
    },
    activityTitleText: {
        color: '#FFFFFF',
        fontSize: '14@ms',
        fontWeight: '800',
        flex: 1,
    },
    currentBadge: {
        backgroundColor: '#06B6D4',
        paddingHorizontal: '6@ms',
        paddingVertical: '2@ms',
        borderRadius: 6,
        marginLeft: '6@ms',
    },
    currentBadgeText: {
        color: '#0B0E14',
        fontSize: '8@ms',
        fontWeight: '900',
    },
    activityTimeSub: {
        color: '#8E9AA8',
        fontSize: '11@ms',
        fontWeight: '600',
        marginTop: '3@ms',
    },
    activityNotesText: {
        color: '#5B6676',
        fontSize: '11@ms',
        marginTop: '3@ms',
    },
    emptyCard: {
        backgroundColor: '#121520',
        borderRadius: 20,
        padding: '24@ms',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1D2232',
        marginVertical: '6@ms',
    },
    emptyIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '12@ms',
    },
    emptyIconText: {
        color: '#06B6D4',
        fontSize: '22@ms',
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: '16@ms',
        fontWeight: '800',
    },
    emptyText: {
        color: '#6B7A90',
        fontSize: '12@ms',
        textAlign: 'center',
        lineHeight: 18,
        marginTop: '6@ms',
        marginBottom: '16@ms',
    },
    emptyPlanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.35)',
        paddingHorizontal: '18@ms',
        paddingVertical: '9@ms',
        borderRadius: 20,
    },
    emptyPlanButtonText: {
        color: '#06B6D4',
        fontSize: '12@ms',
        fontWeight: '700',
    },
});