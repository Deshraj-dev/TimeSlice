import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    StatusBar,
    Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../components/AppIcon';
import Svg, {
    Rect,
    Path,
    Circle,
    Defs,
    LinearGradient,
    Stop,
    Text as SvgText,
} from 'react-native-svg';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getTodayDateString, getYesterdayDateString } from '../utils/dateHelpers';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 48;
const CHART_HEIGHT = 160;

const CATEGORY_MAP = {
    work: { label: 'Work', icon: 'work', color: '#06B6D4' },
    study: { label: 'Study', icon: 'study', color: '#8B5CF6' },
    exercise: { label: 'Exercise', icon: 'exercise', color: '#10B981' },
    lunch: { label: 'Lunch', icon: 'lunch', color: '#F97316' },
    leisure: { label: 'Leisure', icon: 'leisure', color: '#3B82F6' },
    other: { label: 'Other', icon: 'other', color: '#64748B' },
};

export default function AnalyticsScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);

    // Chart datasets
    const [dailyData, setDailyData] = useState([]); // [{ dayName, hours }]
    const [weeklyData, setWeeklyData] = useState([]); // [{ weekName, hours }]
    const [categoryBreakdown, setCategoryBreakdown] = useState([]); // [{ category, hours, percent }]
    const [completionRate, setCompletionRate] = useState(0);
    const [totalFocusedHours, setTotalFocusedHours] = useState(0);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                // 1. Fetch User Settings for Streaks
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    setCurrentStreak(Number(userData.currentStreak || 0));
                    setBestStreak(Number(userData.bestStreak || 0));
                }

                // 2. Fetch all focus sessions
                const sessionsSnap = await getDocs(query(collection(db, 'users', user.uid, 'focusSessions')));
                const sessions = [];
                sessionsSnap.forEach((docRef) => {
                    sessions.push(docRef.data());
                });

                // 3. Process metrics
                calculateMetrics(sessions);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, []);

    const calculateMetrics = (sessions) => {
        const todayStr = getTodayDateString();

        // A. Filter sessions for stats
        let totalSessionsCount = sessions.length;
        let completedSessionsCount = sessions.filter((s) => s.completed).length;
        let completionPercent = totalSessionsCount > 0
            ? Math.round((completedSessionsCount / totalSessionsCount) * 100)
            : 0;
        setCompletionRate(completionPercent);

        let totalMins = sessions.reduce((acc, s) => acc + (s.actualFocusedMinutes || 0), 0);
        setTotalFocusedHours(Number((totalMins / 60).toFixed(1)));

        // B. Generate Daily Data (Last 7 Days)
        const last7Days = [];
        const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let tempDate = todayStr;

        for (let i = 0; i < 7; i++) {
            // Calculate weekday name
            const [y, m, d] = tempDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayName = DAYS_SHORT[dateObj.getDay()];

            // Sum minutes for this date
            const minutesOnDay = sessions.reduce((acc, s) => {
                if (s.createdAt) {
                    const sDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                    const sDateStr = sDate.toISOString().split('T')[0];
                    if (sDateStr === tempDate) {
                        return acc + (s.actualFocusedMinutes || 0);
                    }
                }
                return acc;
            }, 0);

            last7Days.push({
                dateStr: tempDate,
                dayName: i === 0 ? 'Today' : dayName,
                hours: minutesOnDay / 60,
            });

            tempDate = getYesterdayDateString(tempDate);
        }
        // Reverse so chronological (left to right)
        setDailyData(last7Days.reverse());

        // C. Generate Weekly Data (Last 4 Weeks)
        const last4Weeks = [];
        const nowMs = Date.now();
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

        for (let i = 3; i >= 0; i--) {
            const startMs = nowMs - (i + 1) * ONE_WEEK_MS;
            const endMs = nowMs - i * ONE_WEEK_MS;

            const weeklyMinutes = sessions.reduce((acc, s) => {
                if (s.createdAt) {
                    const sDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                    const sMs = sDate.getTime();
                    if (sMs >= startMs && sMs < endMs) {
                        return acc + (s.actualFocusedMinutes || 0);
                    }
                }
                return acc;
            }, 0);

            last4Weeks.push({
                weekLabel: i === 0 ? 'This Wk' : `${i} wk ago`,
                hours: weeklyMinutes / 60,
            });
        }
        setWeeklyData(last4Weeks);

        // D. Category Breakdown
        const categoryMap = { work: 0, study: 0, exercise: 0, lunch: 0, leisure: 0, other: 0 };
        sessions.forEach((s) => {
            const cat = s.category || 'other';
            if (cat in categoryMap) {
                categoryMap[cat] += (s.actualFocusedMinutes || 0);
            } else {
                categoryMap.other += (s.actualFocusedMinutes || 0);
            }
        });

        const breakdown = Object.keys(categoryMap).map((key) => {
            const mins = categoryMap[key];
            return {
                category: key,
                hours: Number((mins / 60).toFixed(1)),
                minutes: mins,
            };
        });

        // Sort descending by minutes
        breakdown.sort((a, b) => b.minutes - a.minutes);

        const totalMappedMins = breakdown.reduce((acc, b) => acc + b.minutes, 0);
        const finalBreakdown = breakdown.map((b) => ({
            ...b,
            percent: totalMappedMins > 0 ? Math.round((b.minutes / totalMappedMins) * 100) : 0,
        }));

        setCategoryBreakdown(finalBreakdown);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // SVG Bar Chart Constants & Calculations
    const maxDailyHours = Math.max(...dailyData.map((d) => d.hours), 4); // fallback 4h min
    const BAR_CHART_PADDING_X = 20;
    const barSpacing = (CHART_WIDTH - BAR_CHART_PADDING_X * 2) / 7;

    // SVG Line Chart Calculations
    const maxWeeklyHours = Math.max(...weeklyData.map((w) => w.hours), 8); // fallback 8h min
    const LINE_CHART_PADDING_X = 30;
    const lineSpacing = (CHART_WIDTH - LINE_CHART_PADDING_X * 2) / 3;

    // Generate Line Path Data
    const linePoints = weeklyData.map((w, idx) => {
        const x = LINE_CHART_PADDING_X + idx * lineSpacing;
        const y = CHART_HEIGHT - 35 - (w.hours / maxWeeklyHours) * (CHART_HEIGHT - 65);
        return { x, y };
    });

    let linePathD = '';
    let fillPathD = '';
    if (linePoints.length > 0) {
        linePathD = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 1; i < linePoints.length; i++) {
            linePathD += ` L ${linePoints[i].x} ${linePoints[i].y}`;
        }
        fillPathD = `${linePathD} L ${linePoints[linePoints.length - 1].x} ${CHART_HEIGHT - 25} L ${linePoints[0].x} ${CHART_HEIGHT - 25} Z`;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.8}
                >
                    <AppIcon name="arrow-left" size={moderateScale(14)} color={COLORS.primary} strokeWidth={2.4} />
                    <Text style={styles.backButtonText}>Dashboard</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Productivity Analytics</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Metric Summary Cards */}
                <View style={styles.streakGrid}>
                    <Card style={styles.metricCard}>
                        <View style={[styles.metricIconSquircle, styles.flameSquircle]}>
                            <AppIcon name="flame" size={moderateScale(20)} color="#F97316" strokeWidth={2.2} />
                        </View>
                        <Text style={styles.metricValue}>{currentStreak}</Text>
                        <Text style={styles.metricLabel}>Current Streak</Text>
                    </Card>

                    <Card style={styles.metricCard}>
                        <View style={[styles.metricIconSquircle, styles.trophySquircle]}>
                            <AppIcon name="trophy" size={moderateScale(20)} color="#F59E0B" strokeWidth={2.2} />
                        </View>
                        <Text style={styles.metricValue}>{bestStreak}</Text>
                        <Text style={styles.metricLabel}>Best Streak</Text>
                    </Card>
                </View>

                <Card style={styles.statsOverviewRow}>
                    <View style={styles.overviewBox}>
                        <Text style={styles.overviewValue}>{totalFocusedHours}h</Text>
                        <Text style={styles.overviewLabel}>Lifetime Focused</Text>
                    </View>

                    <View style={styles.overviewDivider} />

                    <View style={styles.overviewBox}>
                        <Text style={styles.overviewValue}>{completionRate}%</Text>
                        <Text style={styles.overviewLabel}>Completion Rate</Text>
                    </View>
                </Card>

                {/* SVG Bar Chart: Last 7 Days */}
                <SectionHeader title="Daily Focus Time (Last 7 Days)" />
                <Card style={styles.chartCard}>
                    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                        <Defs>
                            <LinearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="1" />
                                <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0.4" />
                            </LinearGradient>
                        </Defs>

                        {/* Render grid lines */}
                        {[0, 0.5, 1].map((ratio) => {
                            const y = CHART_HEIGHT - 30 - ratio * (CHART_HEIGHT - 60);
                            return (
                                <Path
                                    key={ratio}
                                    d={`M ${BAR_CHART_PADDING_X} ${y} L ${CHART_WIDTH - BAR_CHART_PADDING_X} ${y}`}
                                    stroke={COLORS.border}
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                />
                            );
                        })}

                        {/* Render Bars */}
                        {dailyData.map((d, idx) => {
                            const barHeight = (d.hours / maxDailyHours) * (CHART_HEIGHT - 60);
                            const x = BAR_CHART_PADDING_X + idx * barSpacing + (barSpacing - 18) / 2;
                            const y = CHART_HEIGHT - 30 - barHeight;

                            return (
                                <View key={d.dateStr}>
                                    {/* Bar column */}
                                    <Rect
                                        x={x}
                                        y={y}
                                        width="18"
                                        height={Math.max(barHeight, 2)}
                                        rx="4"
                                        fill="url(#cyanGrad)"
                                    />
                                    {/* Value label */}
                                    {d.hours > 0 && (
                                        <SvgText
                                            x={x + 9}
                                            y={y - 6}
                                            fill={COLORS.text}
                                            fontSize="9"
                                            fontWeight="700"
                                            textAnchor="middle"
                                        >
                                            {d.hours.toFixed(1)}
                                        </SvgText>
                                    )}
                                    {/* X labels */}
                                    <SvgText
                                        x={x + 9}
                                        y={CHART_HEIGHT - 10}
                                        fill={COLORS.textSecondary}
                                        fontSize="9"
                                        fontWeight="600"
                                        textAnchor="middle"
                                    >
                                        {d.dayName}
                                    </SvgText>
                                </View>
                            );
                        })}
                    </Svg>
                </Card>

                {/* SVG Area Line Chart: Last 4 Weeks */}
                <SectionHeader title="Weekly Progress (Last 4 Weeks)" />
                <Card style={styles.chartCard}>
                    {weeklyData.length > 0 ? (
                        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                            <Defs>
                                <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                                    <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                                </LinearGradient>
                            </Defs>

                            {/* Render grid lines */}
                            {[0, 0.5, 1].map((ratio) => {
                                const y = CHART_HEIGHT - 25 - ratio * (CHART_HEIGHT - 55);
                                return (
                                    <Path
                                        key={ratio}
                                        d={`M ${LINE_CHART_PADDING_X} ${y} L ${CHART_WIDTH - LINE_CHART_PADDING_X} ${y}`}
                                        stroke={COLORS.border}
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                    />
                                );
                            })}

                            {/* Shaded Area */}
                            <Path d={fillPathD} fill="url(#lineGrad)" />

                            {/* Smooth Stroke Line */}
                            <Path
                                d={linePathD}
                                fill="none"
                                stroke="#8B5CF6"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Data points (circles & values) */}
                            {linePoints.map((pt, idx) => {
                                const val = weeklyData[idx].hours;
                                return (
                                    <View key={idx}>
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="5"
                                            fill="#11141E"
                                            stroke="#8B5CF6"
                                            strokeWidth="2"
                                        />
                                        <SvgText
                                            x={pt.x}
                                            y={pt.y - 10}
                                            fill={COLORS.text}
                                            fontSize="9"
                                            fontWeight="700"
                                            textAnchor="middle"
                                        >
                                            {val.toFixed(1)}h
                                        </SvgText>
                                        <SvgText
                                            x={pt.x}
                                            y={CHART_HEIGHT - 8}
                                            fill={COLORS.textSecondary}
                                            fontSize="9"
                                            fontWeight="600"
                                            textAnchor="middle"
                                        >
                                            {weeklyData[idx].weekLabel}
                                        </SvgText>
                                    </View>
                                );
                            })}
                        </Svg>
                    ) : (
                        <Text style={styles.emptyText}>No focus records recorded.</Text>
                    )}
                </Card>

                {/* Category Breakdown */}
                <SectionHeader title="Focused Categories Distribution" />
                <Card style={styles.categoryCard}>
                    {categoryBreakdown.length > 0 && categoryBreakdown.some((c) => c.minutes > 0) ? (
                        categoryBreakdown.map((item) => {
                            if (item.minutes === 0) return null;
                            const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;

                            return (
                                <View key={item.category} style={styles.catRow}>
                                    <View style={[styles.catIconSquircle, { backgroundColor: `${cat.color}22` }]}>
                                        <AppIcon name={cat.icon} size={moderateScale(14)} color={cat.color} strokeWidth={2.2} />
                                    </View>
                                    <View style={styles.catBarContainer}>
                                        <View style={styles.catMetaRow}>
                                            <Text style={styles.catName}>{cat.label}</Text>
                                            <Text style={styles.catDuration}>{item.hours}h ({item.percent}%)</Text>
                                        </View>
                                        <View style={styles.progressBarBg}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    { width: `${item.percent}%`, backgroundColor: cat.color },
                                                ]}
                                            />
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <Text style={styles.emptyText}>No session categories logged yet.</Text>
                    )}
                </Card>
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
        fontSize: '18@ms',
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSpacer: {
        width: '60@ms',
    },
    scrollContent: {
        padding: '20@ms',
        paddingBottom: '40@ms',
    },
    streakGrid: {
        flexDirection: 'row',
        gap: '12@ms',
        marginBottom: '16@ms',
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#11141E',
        borderRadius: '16@ms',
        paddingVertical: '18@ms',
        paddingHorizontal: '12@ms',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#232936',
    },
    metricIconSquircle: {
        width: '40@ms',
        height: '40@ms',
        borderRadius: '12@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '8@ms',
    },
    flameSquircle: {
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
    },
    trophySquircle: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    metricValue: {
        color: COLORS.text,
        fontSize: '22@ms',
        fontWeight: '800',
    },
    metricLabel: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '700',
        marginTop: '4@ms',
    },
    statsOverviewRow: {
        flexDirection: 'row',
        backgroundColor: '#11141E',
        borderRadius: '16@ms',
        paddingVertical: '16@ms',
        borderWidth: 1,
        borderColor: '#232936',
        alignItems: 'center',
        marginBottom: '24@ms',
    },
    overviewBox: {
        flex: 1,
        alignItems: 'center',
    },
    overviewValue: {
        color: COLORS.primary,
        fontSize: '22@ms',
        fontWeight: '800',
    },
    overviewLabel: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '700',
        marginTop: '4@ms',
    },
    overviewDivider: {
        width: 1,
        height: '30@vs',
        backgroundColor: '#232936',
    },
    chartCard: {
        backgroundColor: '#11141E',
        borderRadius: '18@ms',
        paddingVertical: '16@ms',
        paddingHorizontal: '10@ms',
        borderWidth: 1,
        borderColor: '#232936',
        alignItems: 'center',
        marginBottom: '24@ms',
    },
    categoryCard: {
        backgroundColor: '#11141E',
        borderRadius: '18@ms',
        padding: '16@ms',
        borderWidth: 1,
        borderColor: '#232936',
        marginBottom: '24@ms',
    },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: '16@ms',
    },
    catIconSquircle: {
        width: '32@ms',
        height: '32@ms',
        borderRadius: '10@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '12@ms',
    },
    catBarContainer: {
        flex: 1,
    },
    catMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: '6@ms',
    },
    catName: {
        color: COLORS.text,
        fontSize: '13@ms',
        fontWeight: '700',
    },
    catDuration: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '600',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#232936',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: '13@ms',
        textAlign: 'center',
        paddingVertical: '20@ms',
    },
});
