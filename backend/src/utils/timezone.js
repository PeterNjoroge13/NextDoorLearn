// Converts a wall-clock date/time in an IANA time zone to the matching UTC instant.
// Kept free of database imports so migrations can use it without a circular require.
// node-postgres returns DATE columns as a Date at local midnight of the Node process, while
// SQLite returns 'YYYY-MM-DD' text. Read either back as the calendar date it represents.
const calendarDateParts = (date) => (date instanceof Date
  ? [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  : String(date).slice(0, 10).split('-').map(Number));

const zonedTimeToUtc = (date, time, timeZone = 'UTC') => {
  const [year, month, day] = calendarDateParts(date);
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    return new Date(guess - (represented - guess));
  } catch {
    return new Date(guess);
  }
};

module.exports = { zonedTimeToUtc };
