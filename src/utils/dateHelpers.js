const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatDateToReadable = (dateStr) => {
    if (!dateStr) return '';
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const d = new Date(year, month, day);
    const dayName = DAYS[d.getDay()];
    const monthName = MONTHS[month];

    const today = getTodayDateString();
    if (dateStr === today) {
        return `Today, ${monthName} ${day}`;
    }

    const targetDate = new Date(year, month, day);
    const [tYear, tMonth, tDay] = today.split('-').map(Number);
    const todayDate = new Date(tYear, tMonth - 1, tDay);
    const diffTime = targetDate - todayDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        return `Tomorrow, ${monthName} ${day}`;
    } else if (diffDays === -1) {
        return `Yesterday, ${monthName} ${day}`;
    }

    return `${dayName}, ${monthName} ${day}`;
};

export const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export const formatMinutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatDuration = (minutes) => {
    if (minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) {
        return `${h}h ${m}m`;
    } else if (h > 0) {
        return `${h}h`;
    } else {
        return `${m}m`;
    }
};

export const checkTimeOverlap = (startA, endA, startB, endB) => {
    const aStart = parseTimeToMinutes(startA);
    const aEnd = parseTimeToMinutes(endA);
    const bStart = parseTimeToMinutes(startB);
    const bEnd = parseTimeToMinutes(endB);
    return aStart < bEnd && aEnd > bStart;
};

export const getDateStripRange = (centerDateStr) => {
    const [year, month, day] = centerDateStr.split('-').map(Number);
    const centerDate = new Date(year, month - 1, day);
    const range = [];

    for (let i = -3; i <= 10; i++) {
        const target = new Date(centerDate.getTime());
        target.setDate(centerDate.getDate() + i);

        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        range.push({
            dateStr,
            dayName: DAYS[target.getDay()],
            dayNum: String(target.getDate()),
            monthName: MONTHS[target.getMonth()],
        });
    }
    return range;
};

export const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
};

export const getYesterdayDateString = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getWeekDates = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayIndex = date.getDay();
    const shift = dayIndex === 0 ? 6 : dayIndex - 1;
    
    const monday = new Date(date.getTime());
    monday.setDate(date.getDate() - shift);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
        const target = new Date(monday.getTime());
        target.setDate(monday.getDate() + i);
        
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        week.push({
            dateStr: `${y}-${m}-${d}`,
            dayName: DAYS[target.getDay()],
            dayNum: target.getDate(),
        });
    }
    return week;
};
