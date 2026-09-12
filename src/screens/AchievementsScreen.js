import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import Card from '../components/Card';
import AppIcon from '../components/AppIcon';
import { doc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function AchievementsScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [lifetimeFocusHours, setLifetimeFocusHours] = useState(0);
    const [lifetimeFocusSessions, setLifetimeFocusSessions] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [studyFocusMinutes, setStudyFocusMinutes] = useState(0);
    const [workFocusMinutes, setWorkFocusMinutes] = useState(0);
    const [exerciseFocusMinutes, setExerciseFocusMinutes] = useState(0);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setBestStreak(Number(data.bestStreak || 0));
                }

                const focusQuery = query(collection(db, 'users', user.uid, 'focusSessions'));
                const focusSnap = await getDocs(focusQuery);
                let totalSessions = 0;
                let totalMins = 0;
                let studyMins = 0;
                let workMins = 0;
                let exerciseMins = 0;
                focusSnap.forEach((d) => {
                    const sessionData = d.data();
                    if (sessionData.completed) {
                        totalSessions++;
                    }
                    const mins = sessionData.actualFocusedMinutes || 0;
                    totalMins += mins;

                    const cat = sessionData.category;
                    if (cat === 'study') studyMins += mins;
                    else if (cat === 'work') workMins += mins;
                    else if (cat === 'exercise') exerciseMins += mins;
                });

                setLifetimeFocusSessions(totalSessions);
                setLifetimeFocusHours(Number((totalMins / 60).toFixed(1)));
                setStudyFocusMinutes(studyMins);
                setWorkFocusMinutes(workMins);
                setExerciseFocusMinutes(exerciseMins);
            } catch (error) {
                console.error('Error fetching achievements stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const achievements = [
        {
            id: 'first_step',
            title: 'First Step',
            requirement: 'Complete 1 focus session',
            icon: 'target',
            unlocked: lifetimeFocusSessions >= 1,
            color: '#06B6D4',
        },
        {
            id: 'streak_3',
            title: 'Habit Builder',
            requirement: 'Reach 3-day best streak',
            icon: 'flame',
            unlocked: bestStreak >= 3,
            color: '#F59E0B',
        },
        {
            id: 'streak_7',
            title: 'Dedication Master',
            requirement: 'Reach 7-day best streak',
            icon: 'trophy',
            unlocked: bestStreak >= 7,
            color: '#8B5CF6',
        },
        {
            id: 'hours_1',
            title: 'Focus Initiate',
            requirement: 'Log 1 hour of total focus',
            icon: 'timer',
            unlocked: lifetimeFocusHours >= 1,
            color: '#10B981',
        },
        {
            id: 'hours_10',
            title: 'Deep Work Elite',
            requirement: 'Log 10 hours of total focus',
            icon: 'hourglass',
            unlocked: lifetimeFocusHours >= 10,
            color: '#EC4899',
        },
        {
            id: 'cat_study',
            title: 'Scholar',
            requirement: 'Log 5 hours of Study focus',
            icon: 'study',
            unlocked: studyFocusMinutes >= 300,
            color: '#8B5CF6',
        },
        {
            id: 'cat_work',
            title: 'Professional',
            requirement: 'Log 10 hours of Work focus',
            icon: 'work',
            unlocked: workFocusMinutes >= 600,
            color: '#06B6D4',
        },
        {
            id: 'cat_exercise',
            title: 'Athlete',
            requirement: 'Log 5 hours of Exercise focus',
            icon: 'exercise',
            unlocked: exerciseFocusMinutes >= 300,
            color: '#10B981',
        },
    ];

    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const completionPercentage = Math.round((unlockedCount / achievements.length) * 100);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#06B6D4" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
                    style={styles.backButton}
                    activeOpacity={0.8}
                >
                    <AppIcon name="arrow-left" size={moderateScale(14)} color={COLORS.primary} strokeWidth={2.4} />
                    <Text style={styles.backButtonText}>Dashboard</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Achievements & Badges</Text>
                <View style={styles.headerSpacer} />
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
                                {unlockedCount} of {achievements.length} Badges Unlocked
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

                {/* Section Header */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>All Badges</Text>
                    <Text style={styles.sectionBadgeCount}>
                        {unlockedCount}/{achievements.length} Earned
                    </Text>
                </View>

                {/* Badges Grid */}
                <View style={styles.achievementsGrid}>
                    {achievements.map((badge) => {
                        return (
                            <Card
                                key={badge.id}
                                style={[
                                    styles.badgeCard,
                                    badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.badgeIconSquircle,
                                        badge.unlocked
                                            ? {
                                                backgroundColor: `${badge.color}15`,
                                                borderColor: `${badge.color}40`,
                                              }
                                            : styles.badgeIconSquircleLocked,
                                    ]}
                                >
                                    <AppIcon
                                        name={badge.icon}
                                        size={moderateScale(24)}
                                        color={badge.unlocked ? badge.color : '#475569'}
                                        strokeWidth={badge.unlocked ? 2.2 : 1.8}
                                    />
                                    {!badge.unlocked && (
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
                                        !badge.unlocked && styles.badgeTitleLocked,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {badge.title}
                                </Text>

                                <Text
                                    style={[
                                        styles.badgeRequirement,
                                        !badge.unlocked && styles.badgeRequirementLocked,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {badge.requirement}
                                </Text>

                                <View
                                    style={[
                                        styles.badgeStatusPill,
                                        badge.unlocked
                                            ? {
                                                backgroundColor: `${badge.color}12`,
                                                borderColor: `${badge.color}35`,
                                              }
                                            : styles.badgeStatusPillLocked,
                                    ]}
                                >
                                    {badge.unlocked ? (
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
                    })}
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
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0B0E14',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: '16@ms',
        paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 28),
        paddingBottom: '16@ms',
        backgroundColor: '#0B0E14',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#11141E',
        paddingHorizontal: '12@ms',
        paddingVertical: '8@ms',
        borderRadius: '20@ms',
        borderWidth: 1,
        borderColor: '#232936',
        gap: '6@ms',
    },
    backButtonText: {
        color: COLORS.primary,
        fontSize: '12@ms',
        fontWeight: '700',
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: '17@ms',
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSpacer: {
        width: '60@ms',
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
        paddingVertical: '16@ms',
        paddingHorizontal: '12@ms',
        alignItems: 'center',
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
    badgeIconSquircle: {
        width: '52@ms',
        height: '52@ms',
        borderRadius: '16@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '10@ms',
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
        fontSize: '13@ms',
        fontWeight: '800',
        textAlign: 'center',
    },
    badgeTitleLocked: {
        color: '#94A3B8',
    },
    badgeRequirement: {
        color: '#94A3B8',
        fontSize: '11@ms',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: '4@ms',
        lineHeight: 15,
        minHeight: '30@vs',
    },
    badgeRequirementLocked: {
        color: '#64748B',
    },
    badgeStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '8@ms',
        paddingVertical: '4@ms',
        borderRadius: '10@ms',
        borderWidth: 1,
        marginTop: '10@ms',
        gap: '4@ms',
    },
    badgeStatusPillLocked: {
        backgroundColor: '#161B26',
        borderColor: '#232936',
    },
    badgeStatusText: {
        fontSize: '9.5@ms',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    badgeStatusTextLocked: {
        color: '#64748B',
        fontSize: '9.5@ms',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
