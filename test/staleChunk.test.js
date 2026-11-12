import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isStaleChunkError, reloadForStaleChunk } from '../src/flip/lib/staleChunk.js';

describe('staleChunk (file JS cũ mất sau khi deploy bản mới)', () => {
  it('nhận ra lỗi tải module động của Chrome / Safari / Firefox, bỏ qua lỗi khác', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x.vercel.app/assets/LedgerPage-CpPN7tQj.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });

  describe('reloadForStaleChunk', () => {
    let store;
    let reload;
    beforeEach(() => {
      store = {};
      reload = vi.fn();
      globalThis.window = {
        sessionStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
        location: { reload }
      };
    });
    afterEach(() => { delete globalThis.window; });

    it('tải lại 1 lần, lỗi tiếp trong 30 giây thì không tải lại nữa (không lặp vô hạn)', () => {
      expect(reloadForStaleChunk()).toBe(true);
      expect(reloadForStaleChunk()).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('không dùng được sessionStorage thì không tự tải lại', () => {
      globalThis.window.sessionStorage = { getItem: () => { throw new Error('blocked'); } };
      expect(reloadForStaleChunk()).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
