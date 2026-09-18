import { layoutDayActivities } from '../src/screens/CalendarScreen';
import { parseTimeToMinutes } from '../src/utils/dateHelpers';

describe('Planner Calendar Layout & Activity Positioning', () => {
  test('returns empty array when no activities are provided', () => {
    expect(layoutDayActivities([])).toEqual([]);
    expect(layoutDayActivities(null)).toEqual([]);
    expect(layoutDayActivities(undefined)).toEqual([]);
  });

  test('single activity receives full column width (numCols = 1)', () => {
    const activities = [
      { id: '1', title: 'Deep Work', startTime: '09:00', endTime: '10:30' },
    ];
    const layout = layoutDayActivities(activities);
    expect(layout).toHaveLength(1);
    expect(layout[0].colIndex).toBe(0);
    expect(layout[0].numCols).toBe(1);
    expect(layout[0].act.id).toBe('1');
  });

  test('two overlapping activities receive side-by-side columns (numCols = 2)', () => {
    const activities = [
      { id: '1', title: 'Task A', startTime: '14:00', endTime: '15:30' },
      { id: '2', title: 'Task B', startTime: '14:30', endTime: '16:00' },
    ];
    const layout = layoutDayActivities(activities);
    expect(layout).toHaveLength(2);
    expect(layout[0].numCols).toBe(2);
    expect(layout[1].numCols).toBe(2);
    expect(layout[0].colIndex).toBe(0);
    expect(layout[1].colIndex).toBe(1);
  });

  test('three simultaneous activities are assigned 3 non-overlapping columns', () => {
    const activities = [
      { id: '1', title: 'Test Write', startTime: '14:00', endTime: '15:30' },
      { id: '2', title: 'Sprint Architecture', startTime: '14:00', endTime: '15:30' },
      { id: '3', title: 'Auth Test Own', startTime: '14:00', endTime: '15:30' },
    ];
    const layout = layoutDayActivities(activities);
    expect(layout).toHaveLength(3);
    const colIndices = layout.map((item) => item.colIndex).sort();
    expect(colIndices).toEqual([0, 1, 2]);
    layout.forEach((item) => {
      expect(item.numCols).toBe(3);
    });
  });

  test('sequential non-overlapping activities both receive numCols = 1', () => {
    const activities = [
      { id: '1', title: 'Morning Standup', startTime: '09:00', endTime: '09:30' },
      { id: '2', title: 'Sprint Planning', startTime: '10:00', endTime: '11:00' },
    ];
    const layout = layoutDayActivities(activities);
    expect(layout).toHaveLength(2);
    expect(layout[0].numCols).toBe(1);
    expect(layout[0].colIndex).toBe(0);
    expect(layout[1].numCols).toBe(1);
    expect(layout[1].colIndex).toBe(0);
  });

  test('supports full 24-hour activities (early morning and late night)', () => {
    const earlyAct = { id: 'early', title: 'Early Workout', startTime: '05:30', endTime: '06:30' };
    const lateAct = { id: 'late', title: 'Late Review', startTime: '22:00', endTime: '23:30' };

    const earlyMins = parseTimeToMinutes(earlyAct.startTime);
    const lateMins = parseTimeToMinutes(lateAct.startTime);

    expect(earlyMins).toBe(330);
    expect(lateMins).toBe(1320);

    const layout = layoutDayActivities([earlyAct, lateAct]);
    expect(layout).toHaveLength(2);
    expect(layout[0].numCols).toBe(1);
    expect(layout[1].numCols).toBe(1);
  });
});
