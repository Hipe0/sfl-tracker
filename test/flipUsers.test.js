import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let users;
let svc;
const env = { ...process.env };
beforeAll(() => {
  // db.cjs thoát process nếu thiếu MONGODB_URI; client chỉ kết nối khi initDB() được gọi
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:1/test';
  users = require('../src-backend/services/flipUsers.cjs');
  svc = require('../src-backend/services/flipService.cjs');
});
afterEach(() => {
  for (const k of ['FLIP_ENABLED', 'FLIP_KEY_SECRET', 'FLIP_PUBLIC_SIGNUP', 'FLIP_OWNER_KEY', 'FLIP_FARM_IDS']) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
});

describe('flipUsers', () => {
  it('mã hoá rồi giải mã lại đúng key, sai bí mật thì không giải được', () => {
    process.env.FLIP_KEY_SECRET = 'secret-a';
    const enc = users.encrypt('sfl_key_1234567890');
    expect(JSON.stringify(enc)).not.toContain('sfl_key');
    expect(users.decrypt(enc)).toBe('sfl_key_1234567890');
    process.env.FLIP_KEY_SECRET = 'secret-b';
    expect(() => users.decrypt(enc)).toThrow();
  });

  it('chỉ cho đăng ký khi bật FLIP và có FLIP_KEY_SECRET', () => {
    process.env.FLIP_ENABLED = 'true';
    delete process.env.FLIP_KEY_SECRET;
    expect(users.registrationEnabled()).toBe(false);
    process.env.FLIP_KEY_SECRET = 'x';
    expect(users.registrationEnabled()).toBe(true);
    process.env.FLIP_PUBLIC_SIGNUP = 'false';
    expect(users.registrationEnabled()).toBe(false);
  });

  it('kiểm tra farm ID và API key', () => {
    expect(users.validateInput({ farmId: '123', apiKey: 'abcdefgh12' }).errors).toEqual([]);
    expect(users.validateInput({ farmId: 'abc', apiKey: 'short' }).errors).toEqual(['farmId', 'apiKey']);
    expect(users.validateInput({ farmId: '1', apiKey: 'has space key' }).errors).toEqual(['apiKey']);
  });

  it('mã truy cập không đúng dạng thì không tra', () => {
    expect(users.findFarmByCode('random')).toBeNull();
    expect(users.findFarmByCode(undefined)).toBeNull();
  });
});

describe('quyền truy cập FLIP', () => {
  const run = (key, farmId) => {
    const req = { headers: { 'x-flip-key': key }, params: farmId ? { farmId } : {} };
    let code = 200;
    const res = { status(c) { code = c; return this; }, json() { return this; } };
    let passed = false;
    svc.requireFlipAccess(req, res, () => { passed = true; });
    return { passed, code, flip: req.flip };
  };

  it('mã chủ xem được farm của chủ, không xem được farm khác', () => {
    process.env.FLIP_ENABLED = 'true';
    process.env.FLIP_OWNER_KEY = 'owner-code';
    process.env.FLIP_FARM_IDS = '111';
    expect(run('owner-code', '111')).toMatchObject({ passed: true, flip: { role: 'owner', farms: ['111'] } });
    expect(run('owner-code', '222')).toMatchObject({ passed: false, code: 404 });
    expect(run('wrong', '111')).toMatchObject({ passed: false, code: 404 });
  });

  it('tắt FLIP thì mọi mã đều 404', () => {
    process.env.FLIP_ENABLED = 'false';
    process.env.FLIP_OWNER_KEY = 'owner-code';
    process.env.FLIP_FARM_IDS = '111';
    expect(run('owner-code', '111')).toMatchObject({ passed: false, code: 404 });
  });
});
