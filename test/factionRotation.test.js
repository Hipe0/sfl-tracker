import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const faction = require('../src-backend/domain/factionRotation.cjs');
const { applyFaction } = require('../src-backend/services/marketService.cjs');

const DAY = 864e5;
const iso = ts => new Date(ts).toISOString().slice(0, 10);

describe('factionRotation', () => {
  it('tuần 2026-11-02 là tuần 3, Bumpkins xin Eggplant/Rice/Barley (khớp API farm)', () => {
    const now = Date.parse('2026-11-03T10:00:00Z');
    expect(faction.weekIndexAt(now)).toBe(3);
    expect(faction.KITCHEN.bumpkins[2]).toEqual({ Eggplant: 20, Rice: 1, Barley: 30 });
    expect(faction.requestsAt(now).Eggplant).toEqual([{ faction: 'bumpkins', qty: 20 }]);
    expect(faction.weekIndexAt(Date.parse('2026-11-09T23:59:00Z'))).toBe(4);
    expect(faction.weekIndexAt(Date.parse('2027-01-25T00:00:00Z'))).toBe(3);
    expect(faction.weekIndexAt(Date.parse('2026-08-10T00:00:00Z'))).toBe(3);
  });

  it('mỗi tuần mỗi faction xin đúng 3 món, 4 faction dùng chung 12 bộ', () => {
    const key = w => JSON.stringify(Object.keys(w).sort());
    const sets = Object.values(faction.KITCHEN).map(weeks => weeks.map(key).sort());
    for (const weeks of Object.values(faction.KITCHEN)) {
      expect(weeks).toHaveLength(12);
      for (const w of weeks) expect(Object.keys(w)).toHaveLength(3);
    }
    for (const s of sets) expect(s).toEqual(sets[0]);
  });

  it('tuần thưởng chìa', () => {
    expect(faction.isKeyWeek(Date.parse('2026-11-25T00:00:00Z'))).toBe(true);
    expect(faction.isKeyWeek(Date.parse('2026-11-03T00:00:00Z'))).toBe(false);
  });

  it('lịch sử và báo Mua theo faction: không nhìn trước, không đè Bán', () => {
    const now = Date.parse('2026-11-03T10:00:00Z');
    // Cabbage được xin tuần sau (Sunflorians). Giá 1 bình thường, tuần được xin lên 1.4
    const daily = [];
    for (let t = Date.parse('2025-12-15T00:00:00Z'); t < now; t += DAY) {
      daily.push({ date: iso(t), close: faction.requestsAt(t).Cabbage ? 1.4 : 1 });
    }
    const h = faction.requestHistory('Cabbage', daily, now);
    expect(h.trades).toBeGreaterThanOrEqual(6);
    expect(h.avgNet).toBeCloseTo(1.4 * 0.9 - 1, 5);
    const signals = [
      { item: 'Cabbage', price: 1, decision: 'wait', reasons: [] },
      { item: 'Soybean', price: 1, decision: 'sell', reasons: [] },
      { item: 'Wheat', price: 1, decision: 'wait', reasons: [] }
    ];
    applyFaction(signals, { Cabbage: daily, Soybean: daily.map(d => ({ ...d })) }, now, 0.1);
    expect(signals[0]).toMatchObject({ decision: 'buy', buyPrice: 1, buyBy: '2026-11-08', sellBy: '2026-11-15' });
    expect(signals[0].sellTarget).toBeCloseTo(1.4, 5);
    expect(signals[1].decision).toBe('sell');
    expect(signals[2].faction).toBeUndefined();
  });
});

describe('factionWeek (Faction Pet + Kitchen)', () => {
  it('tuần 2026-11-02 khớp API farm Bumpkins, tuần sau là vòng 4', () => {
    const { factionWeek } = require('../src-backend/domain/factionRotation.cjs');
    const w = factionWeek(Date.UTC(2026, 10, 6));
    const b = w.factions.find(f => f.id === 'bumpkins');
    expect(w.week).toBe(3);
    expect(b.pet).toEqual({ 'Kale Omelette': 1, 'Carrot Juice': 5, 'Slow Juice': 1, 'Harvest Doll': 1 });
    expect(b.kitchen).toEqual({ Eggplant: 20, Rice: 1, Barley: 30 });
    const n = factionWeek(Date.UTC(2026, 10, 9));
    expect(n.week).toBe(4);
    expect(n.factions.find(f => f.id === 'bumpkins').pet['Cluck Doll']).toBe(1);
  });
});
