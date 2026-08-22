import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getISOYearWeek } = require('../src-backend/utils/isoWeek.cjs');

describe('getISOYearWeek', () => {
  it('keeps late Sunday UTC in the current ISO week (not local Monday)', () => {
    // 2026-01-04 20:00 UTC is still Sunday; ISO week 2 starts Monday 00:00 UTC.
    // In UTC+7 this instant is already Monday 03:00 local — the old local-date
    // helper would label it 2026-W02 and disagree with toISOString() date keys.
    expect(getISOYearWeek(new Date('2026-01-04T20:00:00.000Z'))).toBe('2026-W01');
    expect(getISOYearWeek(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-W02');
  });

  it('places late December dates in the next ISO year when required', () => {
    expect(getISOYearWeek(new Date('2025-12-29T12:00:00.000Z'))).toBe('2026-W01');
  });
});
