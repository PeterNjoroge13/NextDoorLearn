const db = require('../db/database');

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAME_TO_INDEX = WEEK_DAYS.reduce((acc, day, index) => {
  acc[day.toLowerCase()] = index;
  return acc;
}, {});

const isValidTimeString = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

const timeToMinutes = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const toIsoDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const getDayOfWeekFromDate = (date) => {
  const isoDate = toIsoDate(date);
  return isoDate.getUTCDay();
};

const normalizeSlots = (slots = [], timezone = null) => {
  if (!Array.isArray(slots)) {
    return { error: 'Slots must be an array' };
  }

  const normalized = [];
  for (const slot of slots) {
    const dayOfWeek = Number(slot.dayOfWeek);
    const startTime = String(slot.startTime || '').trim();
    const endTime = String(slot.endTime || '').trim();
    const slotTimezone = (slot.timezone || timezone || '').trim() || null;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { error: 'Each slot must have dayOfWeek between 0 and 6' };
    }

    if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
      return { error: 'Each slot must have valid startTime and endTime in HH:MM format' };
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (startMinutes >= endMinutes) {
      return { error: 'Each slot must have startTime earlier than endTime' };
    }

    normalized.push({
      dayOfWeek,
      startTime,
      endTime,
      timezone: slotTimezone,
      startMinutes,
      endMinutes
    });
  }

  normalized.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startMinutes - b.startMinutes;
  });

  for (let i = 1; i < normalized.length; i += 1) {
    const previous = normalized[i - 1];
    const current = normalized[i];
    if (previous.dayOfWeek === current.dayOfWeek && previous.endMinutes > current.startMinutes) {
      return { error: `Overlapping slots detected for ${WEEK_DAYS[current.dayOfWeek]}` };
    }
  }

  return { slots: normalized };
};

const getAvailabilitySlots = (tutorId) => {
  const tableSlots = db.prepare(`
    SELECT day_of_week, start_time, end_time, timezone
    FROM tutor_availability_slots
    WHERE tutor_id = ? AND is_active = 1
    ORDER BY day_of_week ASC, start_time ASC
  `).all(tutorId);

  if (tableSlots.length > 0) {
    return tableSlots.map((slot) => ({
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      timezone: slot.timezone || null
    }));
  }

  const legacy = db.prepare('SELECT availability FROM tutor_profiles WHERE user_id = ?').get(tutorId);
  if (!legacy || !legacy.availability) {
    return [];
  }

  try {
    const parsed = typeof legacy.availability === 'string' ? JSON.parse(legacy.availability) : legacy.availability;
    if (Array.isArray(parsed?.slots)) {
      return parsed.slots;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      const converted = [];
      Object.entries(parsed).forEach(([key, value]) => {
        const dayOfWeek = DAY_NAME_TO_INDEX[String(key).toLowerCase()];
        if (dayOfWeek === undefined || !Array.isArray(value)) {
          return;
        }
        value.forEach((slot) => {
          if (!slot) return;
          const startTime = slot.startTime || slot.start || slot.from;
          const endTime = slot.endTime || slot.end || slot.to;
          if (isValidTimeString(startTime) && isValidTimeString(endTime)) {
            converted.push({
              dayOfWeek,
              startTime,
              endTime,
              timezone: slot.timezone || null
            });
          }
        });
      });
      return converted;
    }
    return [];
  } catch (error) {
    return [];
  }
};

const isTimeRangeWithinAvailability = (tutorId, scheduledDate, startTime, endTime) => {
  const dayOfWeek = getDayOfWeekFromDate(scheduledDate);
  const slots = getAvailabilitySlots(tutorId);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return slots.some((slot) => {
    if (Number(slot.dayOfWeek) !== dayOfWeek) return false;
    if (!isValidTimeString(slot.startTime) || !isValidTimeString(slot.endTime)) return false;
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    return slotStart <= startMinutes && slotEnd >= endMinutes;
  });
};

module.exports = {
  WEEK_DAYS,
  isValidTimeString,
  timeToMinutes,
  getDayOfWeekFromDate,
  normalizeSlots,
  getAvailabilitySlots,
  isTimeRangeWithinAvailability
};
