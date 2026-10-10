import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let svc;
beforeAll(() => {
  // db.cjs thoát process nếu thiếu MONGODB_URI; client chỉ kết nối khi initDB() được gọi
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:1/test';
  process.env.SFL_API_KEY = 'test-key';
  svc = require('../src-backend/services/farmSyncService.cjs');
});

const directQueue = { add: (fn) => fn() };

function jsonResponse(body, status = 200) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) };
}

function fakeCollection() {
  const docs = new Map();
  return {
    docs,
    find(filter) {
      const ids = filter._id.$in;
      return { toArray: async () => ids.filter(id => docs.has(id)).map(id => ({ _id: id, ...docs.get(id) })) };
    },
    async bulkWrite(ops) {
      for (const { updateOne } of ops) {
        const id = updateOne.filter._id;
        if (!docs.has(id) && !updateOne.upsert) continue;
        docs.set(id, { ...(docs.get(id) || {}), ...updateOne.update.$set });
      }
    }
  };
}

describe('parseFarmIds', () => {
  it('accepts comma, space and semicolon separated ids and drops junk', () => {
    expect(svc.parseFarmIds('123, 456 789;abc')).toEqual(['123', '456', '789']);
    expect(svc.parseFarmIds(undefined)).toEqual([]);
  });
});

describe('fetchFarmsBatch', () => {
  it('retries skipped ids in halves and reports ids that stay skipped', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      const { ids } = JSON.parse(init.body);
      calls.push(ids);
      expect(init.headers['x-api-key']).toBe('test-key');
      if (ids.length === 3) return jsonResponse({ farms: { 1: { updatedAt: 'a' } }, skipped: [2, 3] });
      if (ids[0] === 2) return jsonResponse({ farms: { 2: { updatedAt: 'b' } }, skipped: [] });
      return jsonResponse({ farms: {}, skipped: [3] });
    };

    // splitThreshold 0: coi mọi response là gần giới hạn 5.5MB
    const { farms, missing, deferred } = await svc.fetchFarmsBatch(['1', '2', '3'], { fetchImpl, queue: directQueue, splitThreshold: 0 });
    expect(Object.keys(farms).sort()).toEqual(['1', '2']);
    expect(missing).toEqual(['3']);
    expect(deferred).toEqual([]);
    expect(calls).toEqual([[1, 2, 3], [2], [3]]);
  });

  it('does not retry skipped ids when the response is small', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push(JSON.parse(init.body).ids);
      return jsonResponse({ farms: { 1: { updatedAt: 'a' } }, skipped: [2, 3] });
    };

    const { farms, missing } = await svc.fetchFarmsBatch(['1', '2', '3'], { fetchImpl, queue: directQueue });
    expect(Object.keys(farms)).toEqual(['1']);
    expect(missing).toEqual(['2', '3']);
    expect(calls).toEqual([[1, 2, 3]]);
  });

  it('keeps fetched farms and defers skipped ids when a retry hits 429', async () => {
    const fetchImpl = async (url, init) => {
      const { ids } = JSON.parse(init.body);
      if (ids.length === 3) return jsonResponse({ farms: { 1: { updatedAt: 'a' } }, skipped: [2, 3] });
      return jsonResponse({}, 429);
    };

    const { farms, missing, deferred } = await svc.fetchFarmsBatch(['1', '2', '3'], { fetchImpl, queue: directQueue, splitThreshold: 0 });
    expect(Object.keys(farms)).toEqual(['1']);
    expect(missing).toEqual([]);
    expect(deferred).toEqual(['2', '3']);
  });

  it('throws RateLimitError on 429', async () => {
    const fetchImpl = async () => jsonResponse({}, 429);
    await expect(svc.fetchFarmsBatch(['1'], { fetchImpl, queue: directQueue })).rejects.toBeInstanceOf(svc.RateLimitError);
  });
});

describe('syncTrackedFarms', () => {
  it('batches by 100 and only rewrites farms whose updatedAt changed', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    let version = 'v1';
    const batches = [];
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body);
      batches.push(body.ids.length);
      const farms = {};
      body.ids.forEach(id => { farms[id] = { updatedAt: id === 1 ? version : 'same', coins: id }; });
      return jsonResponse({ farms, skipped: [] });
    };
    const collection = fakeCollection();

    const first = await svc.syncTrackedFarms({ ids, collection, fetchImpl, queue: directQueue });
    expect(batches).toEqual([100, 50]);
    expect(first).toMatchObject({ tracked: 150, fetched: 150, changed: 150 });
    expect(collection.docs.get('42').farm.coins).toBe(42);

    version = 'v2';
    const second = await svc.syncTrackedFarms({ ids, collection, fetchImpl, queue: directQueue });
    expect(second.changed).toBe(1);
    expect(collection.docs.get('1').updatedAt).toBe('v2');
    expect(svc.getFarmSyncStatus()).toMatchObject({ tracked: 150, changed: 1, lastError: null });
  });
});
