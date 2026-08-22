/**
 * ISO week-year helpers. Game resets and history keys are UTC-based
 * (same as Date#toISOString date stamps), so local timezone must not
 * shift Sunday/Monday week boundaries.
 */
const getISOYearWeek = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

module.exports = { getISOYearWeek };
