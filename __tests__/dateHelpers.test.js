import {
  parseTimeToMinutes,
  formatMinutesToTime,
  formatDuration,
  checkTimeOverlap,
  formatDateToReadable,
  getDaysInMonth,
  getFirstDayOfMonth,
  getYesterdayDateString,
  getWeekDates,
} from '../src/utils/dateHelpers';

describe('dateHelpers', () => {
  test('parseTimeToMinutes should parse HH:MM correct', () => {
    expect(parseTimeToMinutes('08:00')).toBe(480);
    expect(parseTimeToMinutes('13:30')).toBe(810);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('')).toBe(0);
  });

  test('formatMinutesToTime should format minutes to HH:MM', () => {
    expect(formatMinutesToTime(480)).toBe('08:00');
    expect(formatMinutesToTime(810)).toBe('13:30');
    expect(formatMinutesToTime(0)).toBe('00:00');
  });

  test('formatDuration should format duration correctly', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
  });

  test('checkTimeOverlap should check if times overlap', () => {
    // Overlapping
    expect(checkTimeOverlap('08:00', '09:00', '08:30', '09:30')).toBe(true);
    expect(checkTimeOverlap('08:00', '10:00', '09:00', '09:30')).toBe(true);
    expect(checkTimeOverlap('08:00', '09:00', '07:30', '08:30')).toBe(true);

    // Non-overlapping (adjacent)
    expect(checkTimeOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
    expect(checkTimeOverlap('09:00', '10:00', '08:00', '09:00')).toBe(false);

    // Non-overlapping (separated)
    expect(checkTimeOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
  });

  test('formatDateToReadable should format date string', () => {
    // Note: since today varies, we check output format
    expect(formatDateToReadable('2026-08-19')).toContain('Aug 19');
    expect(formatDateToReadable('2026-12-25')).toContain('Dec 25');
  });

  test('getDaysInMonth should calculate days including leap years', () => {
    // Feb 2026 (non-leap) -> 28 days
    expect(getDaysInMonth(2026, 1)).toBe(28);
    // Feb 2028 (leap year) -> 29 days
    expect(getDaysInMonth(2028, 1)).toBe(29);
    // Aug 2026 -> 31 days
    expect(getDaysInMonth(2026, 7)).toBe(31);
    // Apr 2026 -> 30 days
    expect(getDaysInMonth(2026, 3)).toBe(30);
  });

  test('getFirstDayOfMonth should return correct weekday starting index', () => {
    // Aug 1, 2026 is Saturday (6)
    expect(getFirstDayOfMonth(2026, 7)).toBe(6);
    // Dec 1, 2026 is Tuesday (2)
    expect(getFirstDayOfMonth(2026, 11)).toBe(2);
  });

  test('getYesterdayDateString should calculate yesterday date correctly', () => {
    // Normal transition
    expect(getYesterdayDateString('2026-08-20')).toBe('2026-08-19');
    // Month boundary
    expect(getYesterdayDateString('2026-08-01')).toBe('2026-07-31');
    // Year boundary
    expect(getYesterdayDateString('2026-01-01')).toBe('2025-12-31');
    // Leap year boundary (Feb 29 to Feb 28)
    expect(getYesterdayDateString('2028-03-01')).toBe('2028-02-29');
  });

  test('getWeekDates should return 7 correct week days starting on Monday', () => {
    const week = getWeekDates('2026-08-20');
    expect(week).toHaveLength(7);
    expect(week[0].dateStr).toBe('2026-08-17');
    expect(week[3].dateStr).toBe('2026-08-20');
    expect(week[6].dateStr).toBe('2026-08-23');
  });
});
