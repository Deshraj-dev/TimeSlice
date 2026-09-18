import {
  computeAchievementMetrics,
  buildAchievementCategories,
} from '../src/screens/AchievementsScreen';

describe('Achievements Logic', () => {
  test('handles empty data for new users correctly', () => {
    const metrics = computeAchievementMetrics({
      userData: null,
      focusSessions: [],
      activities: [],
      todayStr: '2026-09-12',
      currentMin: 720,
    });

    expect(metrics.bestStreak).toBe(0);
    expect(metrics.lifetimeFocusSessions).toBe(0);
    expect(metrics.lifetimeFocusHours).toBe(0);
    expect(metrics.totalPlannedActivities).toBe(0);
    expect(metrics.completedActivitiesCount).toBe(0);
    expect(metrics.hasEarlyBird).toBe(false);
    expect(metrics.hasNightOwl).toBe(false);
    expect(metrics.hasComeback).toBe(false);
    expect(metrics.totalUniqueActiveDays).toBe(0);

    const categories = buildAchievementCategories(metrics);
    expect(categories).toHaveLength(7);

    const allBadges = categories.flatMap((c) => c.badges);
    expect(allBadges).toHaveLength(28);

    const unlocked = allBadges.filter((b) => b.unlocked);
    expect(unlocked).toHaveLength(0);
  });

  test('preserves all 8 legacy achievement IDs', () => {
    const categories = buildAchievementCategories({});
    const allBadgeIds = categories.flatMap((c) => c.badges).map((b) => b.id);

    const legacyIds = [
      'first_step',
      'streak_3',
      'streak_7',
      'hours_1',
      'hours_10',
      'cat_study',
      'cat_work',
      'cat_exercise',
    ];

    legacyIds.forEach((id) => {
      expect(allBadgeIds).toContain(id);
    });
  });

  test('contains all 24 requested v1 achievement IDs', () => {
    const categories = buildAchievementCategories({});
    const allBadgeIds = categories.flatMap((c) => c.badges).map((b) => b.id);

    const requestedIds = [
      'first_slice',
      'first_step',
      'day_one',
      'getting_serious',
      'streak_3',
      'streak_7',
      'streak_14',
      'streak_30',
      'focused_mind',
      'deep_focus',
      'focus_master',
      'hours_10',
      'planner',
      'time_architect',
      'perfect_day',
      'week_master',
      'productive_week',
      'early_bird',
      'night_owl',
      'comeback',
      'slices_100',
      'focus_champion',
      'veteran_30',
      'master_500',
    ];

    requestedIds.forEach((id) => {
      expect(allBadgeIds).toContain(id);
    });
  });

  test('correctly unlocks achievements based on real data', () => {
    const metrics = computeAchievementMetrics({
      userData: {
        bestStreak: 7,
        lastActiveFocusDate: '2026-09-12',
      },
      focusSessions: [
        { completed: true, actualFocusedMinutes: 60, category: 'study', createdAt: '2026-09-01T10:00:00Z' },
        { completed: true, actualFocusedMinutes: 60, category: 'work', createdAt: '2026-09-10T10:00:00Z' },
      ],
      activities: [
        // Early bird on past date
        { id: 'act1', date: '2026-09-01', startTime: '07:30', endTime: '08:30' },
        // Night owl on past date
        { id: 'act2', date: '2026-09-10', startTime: '20:30', endTime: '21:30' },
        // Additional activities
        { id: 'act3', date: '2026-09-10', startTime: '10:00', endTime: '11:00' },
        { id: 'act4', date: '2026-09-10', startTime: '11:00', endTime: '12:00' },
        { id: 'act5', date: '2026-09-10', startTime: '12:00', endTime: '13:00' },
      ],
      todayStr: '2026-09-12',
      currentMin: 600,
    });

    expect(metrics.bestStreak).toBe(7);
    expect(metrics.lifetimeFocusSessions).toBe(2);
    expect(metrics.lifetimeFocusHours).toBe(2);
    expect(metrics.totalPlannedActivities).toBe(5);
    expect(metrics.completedActivitiesCount).toBe(5);
    expect(metrics.hasEarlyBird).toBe(true);
    expect(metrics.hasNightOwl).toBe(true);
    expect(metrics.hasComeback).toBe(true); // 2026-09-01 to 2026-09-10 = 9 days gap (>= 8)

    const categories = buildAchievementCategories(metrics);
    const badgesMap = {};
    categories.flatMap((c) => c.badges).forEach((b) => {
      badgesMap[b.id] = b;
    });

    expect(badgesMap.first_slice.unlocked).toBe(true);
    expect(badgesMap.first_step.unlocked).toBe(true);
    expect(badgesMap.getting_serious.unlocked).toBe(true);
    expect(badgesMap.streak_3.unlocked).toBe(true);
    expect(badgesMap.streak_7.unlocked).toBe(true);
    expect(badgesMap.streak_14.unlocked).toBe(false);
    expect(badgesMap.hours_1.unlocked).toBe(true);
    expect(badgesMap.early_bird.unlocked).toBe(true);
    expect(badgesMap.night_owl.unlocked).toBe(true);
    expect(badgesMap.comeback.unlocked).toBe(true);
  });
});
