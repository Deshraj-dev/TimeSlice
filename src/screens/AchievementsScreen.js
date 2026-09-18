import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import Card from '../components/Card';
import AppIcon from '../components/AppIcon';
import { doc, getDoc, collection, query, getDocs } from '@react-native-firebase/firestore';
import { auth, db } from '../services/firebase';
import { getTodayDateString, parseTimeToMinutes } from '../utils/dateHelpers';

export const computeAchievementMetrics = ({
    userData,
    focusSessions = [],
    activities = [],
    todayStr,
    currentMin,
}) => {
    const today = todayStr || getTodayDateString();
    const nowMin = typeof currentMin === 'number'
        ? currentMin
        : (new Date().getHours() * 60 + new Date().getMinutes());

    // 1. User document fields
    const bestStreak = Number(userData?.bestStreak || 0);

    // 2. Focus sessions metrics
    let lifetimeFocusSessions = 0;
    let totalFocusMinutes = 0;
    let studyFocusMinutes = 0;
    let workFocusMinutes = 0;
    let exerciseFocusMinutes = 0;
    const completedSessionActivityIds = new Set();
    const activeDatesSet = new Set();

    if (userData?.lastActiveFocusDate) {
        activeDatesSet.add(userData.lastActiveFocusDate);
    }

    focusSessions.forEach((session) => {
        if (session.completed) {
            lifetimeFocusSessions++;
            if (session.activityId) {
                completedSessionActivityIds.add(session.activityId);
            }
        }
        const mins = Number(session.actualFocusedMinutes || 0);
        totalFocusMinutes += mins;

        const cat = session.category;
        if (cat === 'study') studyFocusMinutes += mins;
        else if (cat === 'work') workFocusMinutes += mins;
        else if (cat === 'exercise') exerciseFocusMinutes += mins;

        if (session.createdAt) {
            const dObj = session.createdAt.toDate
                ? session.createdAt.toDate()
                : new Date(session.createdAt);
            if (!isNaN(dObj.getTime())) {
                const y = dObj.getFullYear();
                const m = String(dObj.getMonth() + 1).padStart(2, '0');
                const d = String(dObj.getDate()).padStart(2, '0');
                activeDatesSet.add(`${y}-${m}-${d}`);
            }
        }
    });

    const lifetimeFocusHours = Number((totalFocusMinutes / 60).toFixed(1));

    // 3. Activities metrics
    const totalPlannedActivities = activities.length;
    let completedActivitiesCount = 0;
    const dateActivitiesMap = {};
    const weeklyCompletedMap = {};
    let hasEarlyBird = false;
    let hasNightOwl = false;

    activities.forEach((act) => {
        if (act.date && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) {
            activeDatesSet.add(act.date);
            if (!dateActivitiesMap[act.date]) {
                dateActivitiesMap[act.date] = [];
            }
            dateActivitiesMap[act.date].push(act);
        }

        if (act.createdAt) {
            const dObj = act.createdAt.toDate
                ? act.createdAt.toDate()
                : new Date(act.createdAt);
            if (!isNaN(dObj.getTime())) {
                const y = dObj.getFullYear();
                const m = String(dObj.getMonth() + 1).padStart(2, '0');
                const d = String(dObj.getDate()).padStart(2, '0');
                activeDatesSet.add(`${y}-${m}-${d}`);
            }
        }

        // Determine if activity is completed
        let isCompleted = false;
        if (act.id && completedSessionActivityIds.has(act.id)) {
            isCompleted = true;
        } else if (act.date) {
            if (act.date < today) {
                isCompleted = true;
            } else if (act.date === today) {
                const endMin = parseTimeToMinutes(act.endTime);
                if (endMin <= nowMin) {
                    isCompleted = true;
                }
            }
        }

        act._isCompleted = isCompleted;

        if (isCompleted) {
            completedActivitiesCount++;

            // Early bird: activity completed before 9:00 AM (540 min)
            const startMin = parseTimeToMinutes(act.startTime);
            if (act.startTime && startMin < 540) {
                hasEarlyBird = true;
            }

            // Night owl: activity completed after 8:00 PM (20:00 = 1200 min)
            const endMin = parseTimeToMinutes(act.endTime);
            if (act.endTime && (endMin >= 1200 || startMin >= 1200)) {
                hasNightOwl = true;
            }

            // Group by calendar week for productive week
            if (act.date && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) {
                const [y, m, d] = act.date.split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const day = dt.getDay();
                const diffToMonday = day === 0 ? -6 : 1 - day;
                const monday = new Date(dt);
                monday.setDate(dt.getDate() + diffToMonday);
                const my = monday.getFullYear();
                const mm = String(monday.getMonth() + 1).padStart(2, '0');
                const md = String(monday.getDate()).padStart(2, '0');
                const weekKey = `${my}-${mm}-${md}`;
                weeklyCompletedMap[weekKey] = (weeklyCompletedMap[weekKey] || 0) + 1;
            }
        }
    });

    let completedDaysCount = 0;
    let daysWithAllCompleted = 0;
    let uniqueCompletedDaysCount = 0;

    Object.keys(dateActivitiesMap).forEach((dStr) => {
        const dayActs = dateActivitiesMap[dStr];
        const dayCompletedCount = dayActs.filter((a) => a._isCompleted).length;
        if (dayCompletedCount > 0) {
            uniqueCompletedDaysCount++;
        }
        if (dayActs.length >= 1 && dayCompletedCount === dayActs.length) {
            completedDaysCount++;
        }
        if (dayActs.length >= 2 && dayCompletedCount === dayActs.length) {
            daysWithAllCompleted++;
        }
    });

    const maxWeeklyCompletedActivities = Object.values(weeklyCompletedMap).length > 0
        ? Math.max(...Object.values(weeklyCompletedMap))
        : 0;

    // Comeback check: 7+ full days of inactivity between two active dates (gap >= 8 days)
    const sortedActiveDates = Array.from(activeDatesSet)
        .filter((dStr) => /^\d{4}-\d{2}-\d{2}$/.test(dStr))
        .sort();

    let hasComeback = false;
    for (let i = 0; i < sortedActiveDates.length - 1; i++) {
        const [y1, m1, d1] = sortedActiveDates[i].split('-').map(Number);
        const [y2, m2, d2] = sortedActiveDates[i + 1].split('-').map(Number);
        const dt1 = new Date(y1, m1 - 1, d1);
        const dt2 = new Date(y2, m2 - 1, d2);
        const diffDays = Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24));
        if (diffDays >= 8) {
            hasComeback = true;
            break;
        }
    }

    const totalUniqueActiveDays = sortedActiveDates.length;

    return {
        bestStreak,
        lifetimeFocusSessions,
        lifetimeFocusHours,
        studyFocusMinutes,
        workFocusMinutes,
        exerciseFocusMinutes,
        totalPlannedActivities,
        completedActivitiesCount,
        completedDaysCount,
        daysWithAllCompleted,
        uniqueCompletedDaysCount,
        maxWeeklyCompletedActivities,
        hasEarlyBird,
        hasNightOwl,
        hasComeback,
        totalUniqueActiveDays,
    };
};

export const buildAchievementCategories = (metrics = {}) => {
    const {
        bestStreak = 0,
        lifetimeFocusSessions = 0,
        lifetimeFocusHours = 0,
        studyFocusMinutes = 0,
        workFocusMinutes = 0,
        exerciseFocusMinutes = 0,
        totalPlannedActivities = 0,
        completedActivitiesCount = 0,
        completedDaysCount = 0,
        daysWithAllCompleted = 0,
        uniqueCompletedDaysCount = 0,
        maxWeeklyCompletedActivities = 0,
        hasEarlyBird = false,
        hasNightOwl = false,
        hasComeback = false,
        totalUniqueActiveDays = 0,
    } = metrics;

    return [
        {
            title: 'Getting Started',
            badges: [
                {
                    id: 'first_slice',
                    title: 'First Slice',
                    requirement: 'Create your first activity',
                    icon: 'calendar',
                    unlocked: totalPlannedActivities >= 1,
                    current: Math.min(totalPlannedActivities, 1),
                    target: 1,
                    color: '#06B6D4',
                },
                {
                    id: 'first_step',
                    title: 'First Focus',
                    requirement: 'Complete 1 focus session',
                    icon: 'target',
                    unlocked: lifetimeFocusSessions >= 1,
                    current: Math.min(lifetimeFocusSessions, 1),
                    target: 1,
                    color: '#06B6D4',
                },
                {
                    id: 'day_one',
                    title: 'Day One',
                    requirement: 'Complete your first planned day',
                    icon: 'check',
                    unlocked: completedDaysCount >= 1,
                    current: Math.min(completedDaysCount, 1),
                    target: 1,
                    color: '#10B981',
                },
                {
                    id: 'getting_serious',
                    title: 'Getting Serious',
                    requirement: 'Complete 5 activities',
                    icon: 'check',
                    unlocked: completedActivitiesCount >= 5,
                    current: Math.min(completedActivitiesCount, 5),
                    target: 5,
                    color: '#3B82F6',
                },
            ],
        },
        {
            title: 'Consistency',
            badges: [
                {
                    id: 'streak_3',
                    title: '3-Day Streak',
                    requirement: 'Stay active for 3 days',
                    icon: 'flame',
                    unlocked: bestStreak >= 3,
                    current: Math.min(bestStreak, 3),
                    target: 3,
                    color: '#F59E0B',
                },
                {
                    id: 'streak_7',
                    title: '7-Day Streak',
                    requirement: 'Stay active for 7 days',
                    icon: 'trophy',
                    unlocked: bestStreak >= 7,
                    current: Math.min(bestStreak, 7),
                    target: 7,
                    color: '#8B5CF6',
                },
                {
                    id: 'streak_14',
                    title: '14-Day Streak',
                    requirement: 'Stay active for 14 days',
                    icon: 'flame',
                    unlocked: bestStreak >= 14,
                    current: Math.min(bestStreak, 14),
                    target: 14,
                    color: '#EF4444',
                },
                {
                    id: 'streak_30',
                    title: '30-Day Streak',
                    requirement: 'Stay active for 30 days',
                    icon: 'trophy',
                    unlocked: bestStreak >= 30,
                    current: Math.min(bestStreak, 30),
                    target: 30,
                    color: '#EC4899',
                },
            ],
        },
        {
            title: 'Focus',
            badges: [
                {
                    id: 'hours_1',
                    title: 'Focus Initiate',
                    requirement: 'Log 1 hour of total focus',
                    icon: 'timer',
                    unlocked: lifetimeFocusHours >= 1,
                    current: Math.min(lifetimeFocusHours, 1),
                    target: 1,
                    color: '#10B981',
                },
                {
                    id: 'focused_mind',
                    title: 'Focused Mind',
                    requirement: 'Complete 5 focus sessions',
                    icon: 'focus',
                    unlocked: lifetimeFocusSessions >= 5,
                    current: Math.min(lifetimeFocusSessions, 5),
                    target: 5,
                    color: '#06B6D4',
                },
                {
                    id: 'deep_focus',
                    title: 'Deep Focus',
                    requirement: 'Complete 10 focus sessions',
                    icon: 'focus',
                    unlocked: lifetimeFocusSessions >= 10,
                    current: Math.min(lifetimeFocusSessions, 10),
                    target: 10,
                    color: '#3B82F6',
                },
                {
                    id: 'focus_master',
                    title: 'Focus Master',
                    requirement: 'Complete 25 focus sessions',
                    icon: 'target',
                    unlocked: lifetimeFocusSessions >= 25,
                    current: Math.min(lifetimeFocusSessions, 25),
                    target: 25,
                    color: '#8B5CF6',
                },
                {
                    id: 'hours_10',
                    title: 'Time Warrior',
                    requirement: 'Accumulate 10 hours of focus',
                    icon: 'hourglass',
                    unlocked: lifetimeFocusHours >= 10,
                    current: Math.min(lifetimeFocusHours, 10),
                    target: 10,
                    color: '#EC4899',
                },
            ],
        },
        {
            title: 'Planning',
            badges: [
                {
                    id: 'planner',
                    title: 'Planner',
                    requirement: 'Plan 10 activities',
                    icon: 'calendar',
                    unlocked: totalPlannedActivities >= 10,
                    current: Math.min(totalPlannedActivities, 10),
                    target: 10,
                    color: '#06B6D4',
                },
                {
                    id: 'time_architect',
                    title: 'Time Architect',
                    requirement: 'Plan 50 activities',
                    icon: 'calendar',
                    unlocked: totalPlannedActivities >= 50,
                    current: Math.min(totalPlannedActivities, 50),
                    target: 50,
                    color: '#8B5CF6',
                },
                {
                    id: 'perfect_day',
                    title: 'Perfect Day',
                    requirement: 'Complete all planned activities for a day',
                    icon: 'check',
                    unlocked: daysWithAllCompleted >= 1,
                    current: Math.min(daysWithAllCompleted, 1),
                    target: 1,
                    color: '#10B981',
                },
                {
                    id: 'week_master',
                    title: 'Week Master',
                    requirement: 'Complete activities on 7 different days',
                    icon: 'calendar',
                    unlocked: uniqueCompletedDaysCount >= 7,
                    current: Math.min(uniqueCompletedDaysCount, 7),
                    target: 7,
                    color: '#F59E0B',
                },
            ],
        },
        {
            title: 'Productivity',
            badges: [
                {
                    id: 'productive_week',
                    title: 'Productive Week',
                    requirement: 'Complete 20 activities in one week',
                    icon: 'stats',
                    unlocked: maxWeeklyCompletedActivities >= 20,
                    current: Math.min(maxWeeklyCompletedActivities, 20),
                    target: 20,
                    color: '#06B6D4',
                },
                {
                    id: 'early_bird',
                    title: 'Early Bird',
                    requirement: 'Complete an activity before 9 AM',
                    icon: 'clock',
                    unlocked: hasEarlyBird,
                    current: hasEarlyBird ? 1 : 0,
                    target: 1,
                    color: '#F59E0B',
                },
                {
                    id: 'night_owl',
                    title: 'Night Owl',
                    requirement: 'Complete an activity after 8 PM',
                    icon: 'clock',
                    unlocked: hasNightOwl,
                    current: hasNightOwl ? 1 : 0,
                    target: 1,
                    color: '#8B5CF6',
                },
                {
                    id: 'comeback',
                    title: 'Comeback',
                    requirement: 'Return after 7+ days of inactivity',
                    icon: 'refresh',
                    unlocked: hasComeback,
                    current: hasComeback ? 1 : 0,
                    target: 1,
                    color: '#10B981',
                },
            ],
        },
        {
            title: 'Milestones',
            badges: [
                {
                    id: 'slices_100',
                    title: '100 Slices',
                    requirement: 'Complete 100 activities',
                    icon: 'trophy',
                    unlocked: completedActivitiesCount >= 100,
                    current: Math.min(completedActivitiesCount, 100),
                    target: 100,
                    color: '#F59E0B',
                },
                {
                    id: 'focus_champion',
                    title: 'Focus Champion',
                    requirement: 'Accumulate 25 hours of focus',
                    icon: 'hourglass',
                    unlocked: lifetimeFocusHours >= 25,
                    current: Math.min(lifetimeFocusHours, 25),
                    target: 25,
                    color: '#EC4899',
                },
                {
                    id: 'veteran_30',
                    title: 'TimeSlice Veteran',
                    requirement: 'Use TimeSlice on 30 different days',
                    icon: 'calendar',
                    unlocked: totalUniqueActiveDays >= 30,
                    current: Math.min(totalUniqueActiveDays, 30),
                    target: 30,
                    color: '#3B82F6',
                },
                {
                    id: 'master_500',
                    title: 'TimeSlice Master',
                    requirement: 'Complete 500 activities',
                    icon: 'trophy',
                    unlocked: completedActivitiesCount >= 500,
                    current: Math.min(completedActivitiesCount, 500),
                    target: 500,
                    color: '#8B5CF6',
                },
            ],
        },
        {
            title: 'Category Mastery',
            badges: [
                {
                    id: 'cat_study',
                    title: 'Scholar',
                    requirement: 'Log 5 hours of Study focus',
                    icon: 'study',
                    unlocked: studyFocusMinutes >= 300,
                    current: Math.min(Number((studyFocusMinutes / 60).toFixed(1)), 5),
                    target: 5,
                    color: '#8B5CF6',
                },
                {
                    id: 'cat_work',
                    title: 'Professional',
                    requirement: 'Log 10 hours of Work focus',
                    icon: 'work',
                    unlocked: workFocusMinutes >= 600,
                    current: Math.min(Number((workFocusMinutes / 60).toFixed(1)), 10),
                    target: 10,
                    color: '#06B6D4',
                },
                {
                    id: 'cat_exercise',
                    title: 'Athlete',
                    requirement: 'Log 5 hours of Exercise focus',
                    icon: 'exercise',
                    unlocked: exerciseFocusMinutes >= 300,
                    current: Math.min(Number((exerciseFocusMinutes / 60).toFixed(1)), 5),
                    target: 5,
                    color: '#10B981',
                },
            ],
        },
    ];
};

export default function AchievementsScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({});

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    setLoading(false);
                    return;
                }

                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                const userData = docSnap.exists() ? docSnap.data() : null;

                const focusQuery = query(collection(db, 'users', user.uid, 'focusSessions'));
                const focusSnap = await getDocs(focusQuery);
                const focusSessions = [];
                focusSnap.forEach((d) => {
                    focusSessions.push({ id: d.id, ...d.data() });
                });

                const actQuery = query(collection(db, 'users', user.uid, 'activities'));
                const actSnap = await getDocs(actQuery);
                const activities = [];
                actSnap.forEach((d) => {
                    activities.push({ id: d.id, ...d.data() });
                });

                const computed = computeAchievementMetrics({
                    userData,
                    focusSessions,
                    activities,
                });

                setMetrics(computed);
            } catch (error) {
                console.error('Error fetching achievements stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const categories = buildAchievementCategories(metrics);
    const allAchievements = categories.flatMap((c) => c.badges);
    const unlockedCount = allAchievements.filter((a) => a.unlocked).length;
    const completionPercentage = allAchievements.length > 0
        ? Math.round((unlockedCount / allAchievements.length) * 100)
        : 0;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#06B6D4" />
            </View>
        );
    }

    const renderBadgeCard = (badge) => {
        const isUnlocked = badge.unlocked;
        const progressPercent = badge.target > 0
            ? Math.min(100, Math.round((badge.current / badge.target) * 100))
            : 0;

        const dynamicSquircleStyle = isUnlocked
            ? {
                backgroundColor: `${badge.color}15`,
                borderColor: `${badge.color}40`,
            }
            : styles.badgeIconSquircleLocked;

        const dynamicProgressBarFill = {
            width: `${progressPercent}%`,
            backgroundColor: isUnlocked ? badge.color : '#334155',
        };

        const dynamicPillStyle = isUnlocked
            ? {
                backgroundColor: `${badge.color}12`,
                borderColor: `${badge.color}35`,
            }
            : styles.badgeStatusPillLocked;

        return (
            <Card
                key={badge.id}
                style={[
                    styles.badgeCard,
                    isUnlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked,
                ]}
            >
                <View style={[styles.badgeIconSquircle, dynamicSquircleStyle]}>
                    <AppIcon
                        name={badge.icon}
                        size={moderateScale(24)}
                        color={isUnlocked ? badge.color : '#475569'}
                        strokeWidth={isUnlocked ? 2.2 : 1.8}
                    />
                    {!isUnlocked && (
                        <View style={styles.badgeLockBadge}>
                            <AppIcon
                                name="pause"
                                size={moderateScale(8)}
                                color="#64748B"
                                strokeWidth={2.4}
                            />
                        </View>
                    )}
                </View>

                <Text
                    style={[
                        styles.badgeTitle,
                        !isUnlocked && styles.badgeTitleLocked,
                    ]}
                    numberOfLines={1}
                >
                    {badge.title}
                </Text>

                <Text
                    style={[
                        styles.badgeRequirement,
                        !isUnlocked && styles.badgeRequirementLocked,
                    ]}
                    numberOfLines={2}
                >
                    {badge.requirement}
                </Text>

                <View style={styles.badgeProgressContainer}>
                    <View style={styles.badgeProgressBarTrack}>
                        <View
                            style={[
                                styles.badgeProgressBarFill,
                                dynamicProgressBarFill,
                            ]}
                        />
                    </View>
                    <Text
                        style={[
                            styles.badgeProgressText,
                            isUnlocked ? { color: badge.color } : null,
                        ]}
                    >
                        {isUnlocked
                            ? (badge.target > 1 ? `${badge.target}/${badge.target}` : 'Completed')
                            : `${badge.current}/${badge.target}`}
                    </Text>
                </View>

                <View style={[styles.badgeStatusPill, dynamicPillStyle]}>
                    {isUnlocked ? (
                        <>
                            <AppIcon
                                name="check"
                                size={moderateScale(10)}
                                color={badge.color}
                                strokeWidth={2.5}
                            />
                            <Text
                                style={[
                                    styles.badgeStatusText,
                                    { color: badge.color },
                                ]}
                            >
                                UNLOCKED
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.badgeStatusTextLocked}>
                            LOCKED
                        </Text>
                    )}
                </View>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Badges</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Mastery Progress Summary Card */}
                <Card style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.heroIconSquircle}>
                            <AppIcon
                                name="trophy"
                                size={moderateScale(24)}
                                color="#F59E0B"
                                strokeWidth={2.2}
                            />
                        </View>
                        <View style={styles.heroTextContainer}>
                            <Text style={styles.heroTitle}>Mastery Progress</Text>
                            <Text style={styles.heroSubtitle}>
                                {unlockedCount} of {allAchievements.length} Badges Unlocked
                            </Text>
                        </View>
                        <View style={styles.heroPercentBadge}>
                            <Text style={styles.heroPercentText}>{completionPercentage}%</Text>
                        </View>
                    </View>
                    <View style={styles.heroProgressBarTrack}>
                        <View
                            style={[
                                styles.heroProgressBarFill,
                                { width: `${completionPercentage}%` },
                            ]}
                        />
                    </View>
                </Card>

                {/* Section Categorized Badges */}
                {categories.map((section) => {
                    const sectionUnlockedCount = section.badges.filter((b) => b.unlocked).length;
                    return (
                        <View key={section.title} style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                                <Text style={styles.sectionBadgeCount}>
                                    {sectionUnlockedCount}/{section.badges.length} Earned
                                </Text>
                            </View>
                            <View style={styles.achievementsGrid}>
                                {section.badges.map((badge) => renderBadgeCard(badge))}
                                {section.badges.length % 2 !== 0 && (
                                    <View style={styles.badgeCardDummy} />
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = ScaledSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0E14',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0B0E14',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '16@ms',
        paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 28),
        paddingBottom: '16@ms',
        backgroundColor: '#0B0E14',
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: '17@ms',
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    scrollContent: {
        paddingHorizontal: '16@ms',
        paddingTop: '16@ms',
        paddingBottom: '40@ms',
    },
    heroCard: {
        backgroundColor: '#11141E',
        borderRadius: '18@ms',
        padding: '16@ms',
        borderWidth: 1,
        borderColor: '#232936',
        marginBottom: '20@ms',
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroIconSquircle: {
        width: '46@ms',
        height: '46@ms',
        borderRadius: '14@ms',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '12@ms',
    },
    heroTextContainer: {
        flex: 1,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: '15@ms',
        fontWeight: '800',
    },
    heroSubtitle: {
        color: '#94A3B8',
        fontSize: '12@ms',
        fontWeight: '600',
        marginTop: '2@ms',
    },
    heroPercentBadge: {
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        paddingHorizontal: '10@ms',
        paddingVertical: '4@ms',
        borderRadius: '12@ms',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.25)',
    },
    heroPercentText: {
        color: '#06B6D4',
        fontSize: '13@ms',
        fontWeight: '800',
    },
    heroProgressBarTrack: {
        height: '7@vs',
        backgroundColor: '#1A202C',
        borderRadius: '4@ms',
        overflow: 'hidden',
        marginTop: '14@ms',
    },
    heroProgressBarFill: {
        height: '100%',
        backgroundColor: '#06B6D4',
        borderRadius: '4@ms',
    },
    sectionContainer: {
        marginBottom: '20@ms',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12@ms',
        paddingHorizontal: '2@ms',
    },
    sectionTitle: {
        color: '#F8FAFC',
        fontSize: '15@ms',
        fontWeight: '800',
    },
    sectionBadgeCount: {
        color: '#64748B',
        fontSize: '12@ms',
        fontWeight: '700',
    },
    achievementsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    badgeCard: {
        width: '48%',
        backgroundColor: '#11141E',
        borderRadius: '18@ms',
        paddingVertical: '14@ms',
        paddingHorizontal: '10@ms',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        marginBottom: '12@ms',
    },
    badgeCardUnlocked: {
        borderColor: '#232936',
    },
    badgeCardLocked: {
        borderColor: '#1E2433',
        opacity: 0.85,
    },
    badgeCardDummy: {
        width: '48%',
    },
    badgeIconSquircle: {
        width: '48@ms',
        height: '48@ms',
        borderRadius: '15@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '8@ms',
        borderWidth: 1,
        position: 'relative',
    },
    badgeIconSquircleLocked: {
        backgroundColor: '#161B26',
        borderColor: '#232936',
    },
    badgeLockBadge: {
        position: 'absolute',
        bottom: -3,
        right: -3,
        backgroundColor: '#0B0E14',
        borderRadius: '8@ms',
        width: '18@ms',
        height: '18@ms',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#232936',
    },
    badgeTitle: {
        color: '#FFFFFF',
        fontSize: '12.5@ms',
        fontWeight: '800',
        textAlign: 'center',
    },
    badgeTitleLocked: {
        color: '#94A3B8',
    },
    badgeRequirement: {
        color: '#94A3B8',
        fontSize: '10.5@ms',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: '3@ms',
        lineHeight: 14,
        minHeight: '28@vs',
    },
    badgeRequirementLocked: {
        color: '#64748B',
    },
    badgeProgressContainer: {
        width: '100%',
        marginTop: '8@ms',
        alignItems: 'center',
    },
    badgeProgressBarTrack: {
        width: '100%',
        height: '4@vs',
        backgroundColor: '#1A202C',
        borderRadius: '2@ms',
        overflow: 'hidden',
    },
    badgeProgressBarFill: {
        height: '100%',
        borderRadius: '2@ms',
    },
    badgeProgressText: {
        color: '#64748B',
        fontSize: '9.5@ms',
        fontWeight: '700',
        marginTop: '3@ms',
    },
    badgeStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '8@ms',
        paddingVertical: '4@ms',
        borderRadius: '10@ms',
        borderWidth: 1,
        marginTop: '8@ms',
        gap: '4@ms',
    },
    badgeStatusPillLocked: {
        backgroundColor: '#161B26',
        borderColor: '#232936',
    },
    badgeStatusText: {
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    badgeStatusTextLocked: {
        color: '#64748B',
        fontSize: '9@ms',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
