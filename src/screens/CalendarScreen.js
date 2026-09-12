import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    StatusBar,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import ActivityModal from '../components/ActivityModal';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../components/AppIcon';
import {
    getTodayDateString,
    formatDateToReadable,
    parseTimeToMinutes,
    formatDuration,
    getDaysInMonth,
    getFirstDayOfMonth,
    getWeekDates,
} from '../utils/dateHelpers';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_MAP = {
    work: { label: 'Work', icon: 'work', color: '#06B6D4' },
    study: { label: 'Study', icon: 'study', color: '#8B5CF6' },
    exercise: { label: 'Exercise', icon: 'exercise', color: '#10B981' },
    lunch: { label: 'Lunch', icon: 'lunch', color: '#F97316' },
    leisure: { label: 'Leisure', icon: 'leisure', color: '#3B82F6' },
    other: { label: 'Other', icon: 'other', color: '#64748B' },
};

export default function CalendarScreen({ navigation }) {
    const todayStr = getTodayDateString();
    const [selectedDate, setSelectedDate] = useState(todayStr);

    const [viewMode, setViewMode] = useState('Month');
    const [viewedYear, setViewedYear] = useState(new Date().getFullYear());
    const [viewedMonth, setViewedMonth] = useState(new Date().getMonth());

    const [markedDates, setMarkedDates] = useState({});
    const [monthActivities, setMonthActivities] = useState({});

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);

    // Fetch activities for the viewed month
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const padMonth = String(viewedMonth + 1).padStart(2, '0');
        const startStr = `${viewedYear}-${padMonth}-01`;

        let endStr;
        if (viewedMonth === 11) {
            endStr = `${viewedYear + 1}-01-01`;
        } else {
            endStr = `${viewedYear}-${String(viewedMonth + 2).padStart(2, '0')}-01`;
        }

        const q = query(
            collection(db, 'users', user.uid, 'activities'),
            where('date', '>=', startStr),
            where('date', '<', endStr)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const marked = {};
                const activitiesByDate = {};

                snapshot.forEach((d) => {
                    const act = { id: d.id, ...d.data() };
                    marked[act.date] = true;

                    if (!activitiesByDate[act.date]) {
                        activitiesByDate[act.date] = [];
                    }
                    activitiesByDate[act.date].push(act);
                });

                // Sort each date's activities chronologically
                Object.keys(activitiesByDate).forEach((dateKey) => {
                    activitiesByDate[dateKey].sort((a, b) => {
                        return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
                    });
                });

                setMarkedDates(marked);
                setMonthActivities(activitiesByDate);
            },
            (error) => {
                console.error('Error fetching calendar activities:', error);
                Alert.alert('Error', 'Failed to load schedule for this month.');
            }
        );

        return unsubscribe;
    }, [viewedYear, viewedMonth]);

    const prevMonth = () => {
        setViewedMonth((prev) => {
            if (prev === 0) {
                setViewedYear((y) => y - 1);
                return 11;
            }
            return prev - 1;
        });
    };

    const nextMonth = () => {
        setViewedMonth((prev) => {
            if (prev === 11) {
                setViewedYear((y) => y + 1);
                return 0;
            }
            return prev + 1;
        });
    };

    // Generate month grid coordinates
    const generateCalendarDays = () => {
        const daysInMonth = getDaysInMonth(viewedYear, viewedMonth);
        const firstDayIndex = getFirstDayOfMonth(viewedYear, viewedMonth);

        const gridDays = [];

        // Previous month padding cells
        for (let i = 0; i < firstDayIndex; i++) {
            gridDays.push({ dayNum: null, dateStr: null });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const padDay = String(d).padStart(2, '0');
            const padMonth = String(viewedMonth + 1).padStart(2, '0');
            const dateStr = `${viewedYear}-${padMonth}-${padDay}`;
            gridDays.push({ dayNum: d, dateStr });
        }

        return gridDays;
    };

    const calendarDays = generateCalendarDays();
    const activeDateActivities = monthActivities[selectedDate] || [];

    const renderMonthView = () => {
        return (
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.monthSelector}>
                    <TouchableOpacity
                        style={styles.arrowButton}
                        onPress={prevMonth}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Svg width={moderateScale(16)} height={moderateScale(16)} viewBox="0 0 24 24" fill="none">
                            <Polyline
                                points="15 18 9 12 15 6"
                                stroke={COLORS.primary}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>

                    <Text style={styles.monthLabel}>
                        {MONTH_NAMES[viewedMonth]} {viewedYear}
                    </Text>

                    <TouchableOpacity
                        style={styles.arrowButton}
                        onPress={nextMonth}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Svg width={moderateScale(16)} height={moderateScale(16)} viewBox="0 0 24 24" fill="none">
                            <Polyline
                                points="9 18 15 12 9 6"
                                stroke={COLORS.primary}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                </View>

                <View style={styles.calendarCard}>
                    <View style={styles.weekdaysRow}>
                        {WEEKDAYS.map((day) => (
                            <Text key={day} style={styles.weekdayText}>
                                {day.substring(0, 1)}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {calendarDays.map((item, idx) => {
                            if (item.dayNum === null) {
                                return <View key={`empty-${idx}`} style={styles.emptyDayCell} />;
                            }

                            const isSelected = item.dateStr === selectedDate;
                            const isToday = item.dateStr === todayStr;
                            const hasActivities = markedDates[item.dateStr];

                            return (
                                <TouchableOpacity
                                    key={item.dateStr}
                                    style={[
                                        styles.dayCell,
                                        isSelected && styles.dayCellSelected,
                                        isToday && !isSelected && styles.dayCellToday,
                                    ]}
                                    onPress={() => setSelectedDate(item.dateStr)}
                                >
                                    <Text
                                        style={[
                                            styles.dayCellText,
                                            isSelected && styles.dayCellTextSelected,
                                        ]}
                                    >
                                        {item.dayNum}
                                    </Text>
                                    {hasActivities && (
                                        <View
                                            style={[
                                                styles.activityDot,
                                                isSelected && styles.activityDotSelected,
                                            ]}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <SectionHeader
                    title={formatDateToReadable(selectedDate)}
                    actionText={activeDateActivities.length > 0 ? "+ Add" : undefined}
                    onActionPress={activeDateActivities.length > 0 ? () => {
                        setEditingActivity(null);
                        setIsModalVisible(true);
                    } : undefined}
                />

                {activeDateActivities.length === 0 ? (
                    <Card style={styles.emptyCard}>
                        <View style={styles.emptyIcon}>
                            <AppIcon name="calendar" size={moderateScale(24)} color={COLORS.primary} strokeWidth={2} />
                        </View>
                        <Text style={styles.emptyTitle}>No Activities Planned</Text>
                        <Text style={styles.emptyText}>
                            Your schedule is completely clear for this date.
                        </Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            activeOpacity={0.85}
                            onPress={() => {
                                setEditingActivity(null);
                                setIsModalVisible(true);
                            }}
                        >
                            <Text style={styles.addButtonText}>+ Plan Activity</Text>
                        </TouchableOpacity>
                    </Card>
                ) : (
                    <View style={styles.activitiesList}>
                        {activeDateActivities.map((act) => {
                            const cat = CATEGORY_MAP[act.category] || CATEGORY_MAP.other;
                            const durationText = formatDuration(
                                parseTimeToMinutes(act.endTime) - parseTimeToMinutes(act.startTime)
                            );
                            return (
                                <TouchableOpacity
                                    key={act.id}
                                    activeOpacity={0.85}
                                    style={[styles.activityCard, { borderLeftColor: cat.color }]}
                                    onPress={() => {
                                        setEditingActivity(act);
                                        setIsModalVisible(true);
                                    }}
                                >
                                    <View style={styles.activityInfo}>
                                        <View style={styles.titleRow}>
                                            <View style={[styles.activityCategorySquircle, { backgroundColor: `${cat.color}22` }]}>
                                                <AppIcon name={cat.icon} size={moderateScale(13)} color={cat.color} strokeWidth={2.2} />
                                            </View>
                                            <Text style={styles.activityTitleText} numberOfLines={1}>
                                                {act.title}
                                            </Text>
                                        </View>
                                        <Text style={styles.activityTimeSub}>
                                            {act.startTime} – {act.endTime} • {durationText}
                                        </Text>
                                        {act.notes ? (
                                            <Text style={styles.activityNotesText} numberOfLines={1}>
                                                {act.notes}
                                            </Text>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        );
    };

    const renderWeekView = () => {
        const weekDays = getWeekDates(selectedDate);
        const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 to 21:00

        return (
            <View style={styles.weekViewContainer}>
                <View style={styles.weekHeaderRow}>
                    {weekDays.map((day) => {
                        const isSel = day.dateStr === selectedDate;
                        const isToday = day.dateStr === todayStr;
                        return (
                            <TouchableOpacity
                                key={day.dateStr}
                                style={[
                                    styles.weekHeaderCell,
                                    isSel && styles.weekHeaderCellSelected,
                                    isToday && !isSel && styles.weekHeaderCellToday,
                                ]}
                                onPress={() => setSelectedDate(day.dateStr)}
                            >
                                <Text style={[styles.weekDayName, isSel && styles.weekDayNameSelected]}>
                                    {day.dayName.substring(0, 3)}
                                </Text>
                                <Text style={[styles.weekDayNum, isSel && styles.weekDayNumSelected]}>
                                    {day.dayNum}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.weeklyGridBody}>
                        <View style={styles.weeklyTimeColumn}>
                            {hours.map((h) => (
                                <View key={h} style={styles.weeklyTimeCell}>
                                    <Text style={styles.weeklyTimeText}>
                                        {String(h).padStart(2, '0')}:00
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {weekDays.map((day) => {
                            const dayActs = monthActivities[day.dateStr] || [];
                            const isSel = day.dateStr === selectedDate;
                            return (
                                <View
                                    key={day.dateStr}
                                    style={[
                                        styles.weeklyDayColumn,
                                        isSel && styles.weeklyDayColumnSelected,
                                    ]}
                                >
                                    {hours.map((h) => (
                                        <View key={h} style={styles.weeklyGridHourCell} />
                                    ))}

                                    {dayActs.map((act) => {
                                        const startMins = parseTimeToMinutes(act.startTime);
                                        const endMins = parseTimeToMinutes(act.endTime);
                                        const gridStart = 7 * 60;
                                        const topOffset = Math.max(0, startMins - gridStart);
                                        const actHeight = Math.max(30, endMins - startMins);
                                        const cat = CATEGORY_MAP[act.category] || CATEGORY_MAP.other;

                                        return (
                                            <TouchableOpacity
                                                key={act.id}
                                                style={[
                                                    styles.weeklyActivityBlock,
                                                    {
                                                        top: topOffset,
                                                        height: actHeight,
                                                        backgroundColor: `${cat.color}20`,
                                                        borderColor: cat.color,
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setEditingActivity(act);
                                                    setIsModalVisible(true);
                                                }}
                                            >
                                                <Text style={[styles.weeklyActivityTitle, { color: cat.color }]} numberOfLines={1}>
                                                    {act.title}
                                                </Text>
                                                {actHeight >= 40 && (
                                                    <Text style={styles.weeklyActivityTime} numberOfLines={1}>
                                                        {act.startTime}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        );
    };

    const renderDayView = () => {
        const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 to 21:00

        return (
            <View style={styles.dayViewContainer}>
                <View style={styles.dayHeaderCard}>
                    <Text style={styles.dayHeaderLabel}>
                        {formatDateToReadable(selectedDate)}
                    </Text>
                    <TouchableOpacity
                        style={styles.dayHeaderAddButton}
                        onPress={() => {
                            setEditingActivity(null);
                            setIsModalVisible(true);
                        }}
                    >
                        <Text style={styles.dayHeaderAddButtonText}>+ Add Activity</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dayScrollContent}>
                    <View style={styles.dayGridBody}>
                        <View style={styles.dayTimeColumn}>
                            {hours.map((h) => (
                                <View key={h} style={styles.dayTimeCell}>
                                    <Text style={styles.dayTimeText}>
                                        {String(h).padStart(2, '0')}:00
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.dayColumnSpace}>
                            {hours.map((h) => (
                                <View key={h} style={styles.dayGridHourCell} />
                            ))}

                            {activeDateActivities.map((act) => {
                                const startMins = parseTimeToMinutes(act.startTime);
                                const endMins = parseTimeToMinutes(act.endTime);
                                const gridStart = 7 * 60;
                                const topOffset = Math.max(0, startMins - gridStart);
                                const actHeight = Math.max(45, endMins - startMins);
                                const cat = CATEGORY_MAP[act.category] || CATEGORY_MAP.other;

                                return (
                                    <TouchableOpacity
                                        key={act.id}
                                        style={[
                                            styles.dayActivityBlock,
                                            {
                                                top: topOffset,
                                                height: actHeight,
                                                backgroundColor: `${cat.color}20`,
                                                borderColor: cat.color,
                                            },
                                        ]}
                                        onPress={() => {
                                            setEditingActivity(act);
                                            setIsModalVisible(true);
                                        }}
                                    >
                                        <View style={[styles.dayActivityLeftAccent, { backgroundColor: cat.color }]}>
                                            <AppIcon name={cat.icon} size={moderateScale(15)} color="#0B0E14" strokeWidth={2.4} />
                                        </View>
                                        <View style={styles.dayActivityInfo}>
                                            <Text style={styles.dayActivityTitle} numberOfLines={1}>
                                                {act.title}
                                            </Text>
                                            <Text style={styles.dayActivityTime} numberOfLines={1}>
                                                {act.startTime} - {act.endTime} ({formatDuration(endMins - startMins)})
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}
                >
                    <AppIcon name="arrow-left" size={moderateScale(14)} color={COLORS.primary} strokeWidth={2.4} />
                    <Text style={styles.backButtonText}>Dashboard</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Planner</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <View style={styles.tabContainer}>
                {['Day', 'Week', 'Month'].map((mode) => {
                    const isActive = viewMode === mode;
                    return (
                        <TouchableOpacity
                            key={mode}
                            activeOpacity={0.8}
                            style={[
                                styles.tabButton,
                                isActive && styles.tabButtonActive,
                            ]}
                            onPress={() => setViewMode(mode)}
                        >
                            <Text
                                style={[
                                    styles.tabButtonText,
                                    isActive && styles.tabButtonTextActive,
                                ]}
                            >
                                {mode}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {viewMode === 'Month'
                ? renderMonthView()
                : viewMode === 'Week'
                ? renderWeekView()
                : renderDayView()}
            <ActivityModal
                visible={isModalVisible}
                onClose={() => {
                    setIsModalVisible(false);
                    setEditingActivity(null);
                }}
                activity={editingActivity && editingActivity.id ? editingActivity : null}
                selectedDate={selectedDate}
                existingActivities={activeDateActivities}
                onSaveSuccess={() => {
                    console.log('Calendar schedule updated.');
                }}
            />
        </View>
    );
}

const styles = ScaledSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: '16@ms',
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30),
        paddingBottom: '16@ms',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6@ms',
        paddingVertical: '8@ms',
        paddingHorizontal: '14@ms',
        borderRadius: '20@ms',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backButtonText: {
        color: COLORS.primary,
        fontSize: '13@ms',
        fontWeight: '700',
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: '18@ms',
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerPlaceholder: {
        width: '80@s',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: '24@ms',
        padding: '4@ms',
        marginHorizontal: '20@ms',
        marginVertical: '12@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: '8@ms',
        borderRadius: '20@ms',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonActive: {
        backgroundColor: COLORS.primary,
    },
    tabButtonText: {
        color: COLORS.textMuted,
        fontSize: '13@ms',
        fontWeight: '700',
    },
    tabButtonTextActive: {
        color: '#0B0E14',
        fontWeight: '800',
    },
    scrollContent: {
        paddingHorizontal: '20@ms',
        paddingBottom: '40@ms',
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16@ms',
        marginBottom: '14@ms',
        backgroundColor: COLORS.card,
        borderRadius: '16@ms',
        paddingHorizontal: '8@ms',
        paddingVertical: '6@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    arrowButton: {
        padding: '10@ms',
        borderRadius: '12@ms',
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthLabel: {
        color: COLORS.text,
        fontSize: '16@ms',
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    calendarCard: {
        backgroundColor: COLORS.card,
        borderRadius: '20@ms',
        padding: '16@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: '20@ms',
    },
    weekdaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: '12@ms',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        paddingBottom: '8@ms',
    },
    weekdayText: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '800',
        width: '14.28%',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    emptyDayCell: {
        width: '14.28%',
        aspectRatio: 1,
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '12@ms',
        position: 'relative',
        marginVertical: '2@ms',
    },
    dayCellSelected: {
        backgroundColor: COLORS.primary,
    },
    dayCellToday: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    dayCellText: {
        color: COLORS.text,
        fontSize: '13@ms',
        fontWeight: '700',
    },
    dayCellTextSelected: {
        color: '#0B0E14',
        fontWeight: '900',
    },
    activityDot: {
        position: 'absolute',
        bottom: 5,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
    },
    activityDotSelected: {
        backgroundColor: '#0B0E14',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '10@ms',
        marginBottom: '15@ms',
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: '16@ms',
        fontWeight: '800',
    },
    headerAddButton: {
        backgroundColor: COLORS.card,
        paddingVertical: '6@ms',
        paddingHorizontal: '12@ms',
        borderRadius: '8@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    headerAddButtonText: {
        color: COLORS.primary,
        fontSize: '12@ms',
        fontWeight: '700',
    },
    emptyCard: {
        backgroundColor: COLORS.card,
        borderRadius: '20@ms',
        padding: '28@ms',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyIcon: {
        width: '56@ms',
        height: '56@ms',
        borderRadius: '28@ms',
        backgroundColor: COLORS.cardElevated,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '14@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: '16@ms',
        fontWeight: '800',
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: '13@ms',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: '6@ms',
    },
    addButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: '20@ms',
        paddingVertical: '12@ms',
        borderRadius: '20@ms',
        marginTop: '18@ms',
    },
    addButtonText: {
        color: '#0B0E14',
        fontSize: '13@ms',
        fontWeight: '800',
    },
    activitiesList: {
        gap: '10@ms',
    },
    activityCard: {
        backgroundColor: COLORS.card,
        borderRadius: '16@ms',
        padding: '16@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderLeftWidth: 4,
    },
    activityInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityCategorySquircle: {
        width: '28@ms',
        height: '28@ms',
        borderRadius: '8@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '10@ms',
    },
    activityTitleText: {
        color: COLORS.text,
        fontSize: '15@ms',
        fontWeight: '800',
        flex: 1,
    },
    activityTimeSub: {
        color: COLORS.textSecondary,
        fontSize: '12@ms',
        fontWeight: '600',
        marginTop: '6@ms',
        marginLeft: '38@ms',
    },
    activityNotesText: {
        color: COLORS.textMuted,
        fontSize: '12@ms',
        marginTop: '4@ms',
        marginLeft: '38@ms',
    },
    weekViewContainer: {
        flex: 1,
    },
    weekHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: '10@ms',
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        marginBottom: '8@ms',
    },
    weekHeaderCell: {
        alignItems: 'center',
        paddingVertical: '8@ms',
        paddingHorizontal: '10@ms',
        borderRadius: '14@ms',
        width: '46@s',
    },
    weekHeaderCellSelected: {
        backgroundColor: COLORS.primary,
    },
    weekHeaderCellToday: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    weekDayName: {
        color: COLORS.textMuted,
        fontSize: '10@ms',
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    weekDayNameSelected: {
        color: '#0B0E14',
    },
    weekDayNum: {
        color: COLORS.text,
        fontSize: '14@ms',
        fontWeight: '800',
        marginTop: '4@ms',
    },
    weekDayNumSelected: {
        color: '#0B0E14',
        fontWeight: '900',
    },
    weeklyGridBody: {
        flexDirection: 'row',
        paddingRight: '20@ms',
        height: '920@vs',
    },
    weeklyTimeColumn: {
        width: '55@s',
        backgroundColor: COLORS.background,
        borderRightWidth: 1,
        borderColor: COLORS.border,
        paddingTop: '10@ms',
    },
    weeklyTimeCell: {
        height: '60@vs',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    weeklyTimeText: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '700',
    },
    weeklyDayColumn: {
        width: '105@s',
        position: 'relative',
        borderRightWidth: 1,
        borderColor: COLORS.border,
    },
    weeklyDayColumnSelected: {
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
    },
    weeklyGridHourCell: {
        height: '60@vs',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    weeklyActivityBlock: {
        position: 'absolute',
        left: 4,
        right: 4,
        borderRadius: '8@ms',
        borderLeftWidth: 3,
        padding: '4@ms',
        justifyContent: 'flex-start',
        overflow: 'hidden',
    },
    weeklyActivityTitle: {
        fontSize: '10@ms',
        fontWeight: '800',
    },
    weeklyActivityTime: {
        fontSize: '8@ms',
        color: COLORS.textMuted,
        marginTop: '2@ms',
    },
    dayViewContainer: {
        flex: 1,
    },
    dayHeaderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: '20@ms',
        paddingVertical: '12@ms',
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    dayHeaderLabel: {
        color: COLORS.text,
        fontSize: '15@ms',
        fontWeight: '800',
    },
    dayHeaderAddButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: '7@ms',
        paddingHorizontal: '14@ms',
        borderRadius: '20@ms',
    },
    dayHeaderAddButtonText: {
        color: '#0B0E14',
        fontSize: '12@ms',
        fontWeight: '800',
    },
    dayGridBody: {
        flexDirection: 'row',
        height: '920@vs',
    },
    dayTimeColumn: {
        width: '60@s',
        borderRightWidth: 1,
        borderColor: COLORS.border,
        paddingTop: '10@ms',
    },
    dayTimeCell: {
        height: '60@vs',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    dayTimeText: {
        color: COLORS.textMuted,
        fontSize: '11@ms',
        fontWeight: '700',
    },
    dayColumnSpace: {
        flex: 1,
        position: 'relative',
    },
    dayGridHourCell: {
        height: '60@vs',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    dayActivityBlock: {
        position: 'absolute',
        left: 10,
        right: 10,
        borderRadius: '12@ms',
        borderLeftWidth: 4,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: '10@ms',
        paddingVertical: '6@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dayActivityLeftAccent: {
        width: '32@ms',
        height: '32@ms',
        borderRadius: '8@ms',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: '8@ms',
    },
    dayActivityInfo: {
        flex: 1,
        marginLeft: '10@ms',
        justifyContent: 'center',
    },
    dayActivityTitle: {
        color: COLORS.text,
        fontSize: '13@ms',
        fontWeight: '800',
    },
    dayActivityTime: {
        color: COLORS.textSecondary,
        fontSize: '11@ms',
        fontWeight: '600',
        marginTop: '2@ms',
    },
    dayScrollContent: {
        paddingBottom: '50@ms',
    },
});
