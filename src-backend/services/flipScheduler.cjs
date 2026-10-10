/**
 * Quyết định nhịp lấy giao dịch FLIP: bình thường chậm, đang gom hàng thì nhanh.
 * Hàm thuần để test, không gọi API.
 */

function getSchedulerConfig(env = process.env) {
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    normalMs: num(env.FLIP_SYNC_INTERVAL_SECONDS, 60) * 1000,
    fastMs: num(env.FLIP_FAST_INTERVAL_SECONDS, 10) * 1000,
    // Số lệnh mới trong một lượt để coi là đang gom hàng
    burstThreshold: num(env.FLIP_BURST_THRESHOLD, 10),
    // Lệnh mới nhất khớp trong khoảng này cũng coi là đang giao dịch
    activeWindowMs: num(env.FLIP_ACTIVE_WINDOW_SECONDS, 60) * 1000,
    // Số lượt liên tiếp không có lệnh mới trước khi về nhịp thường
    idlePollsToSlowDown: num(env.FLIP_IDLE_POLLS, 3),
    manualBurstMs: num(env.FLIP_MANUAL_BURST_MINUTES, 10) * 60 * 1000
  };
}

function createFarmState() {
  return {
    mode: 'normal',
    idleStreak: 0,
    manualUntil: 0,
    lastPollAt: null,
    lastNewTradeAt: null
  };
}

/**
 * Cập nhật trạng thái sau một lượt lấy giao dịch
 * @param {object} state Trạng thái hiện tại (bị thay đổi tại chỗ và trả về)
 * @param {{ newTrades: number, newestFulfilledAt: number|null }} result
 */
function applyPollResult(state, result, now, config) {
  state.lastPollAt = now;
  const newTrades = result.newTrades || 0;
  const recentlyActive = result.newestFulfilledAt != null && now - result.newestFulfilledAt <= config.activeWindowMs;

  if (newTrades > 0) {
    state.lastNewTradeAt = now;
    state.idleStreak = 0;
  } else {
    state.idleStreak += 1;
  }

  const burstDetected = newTrades >= config.burstThreshold || (newTrades > 0 && recentlyActive);
  const manual = state.manualUntil > now;

  if (burstDetected || manual) {
    state.mode = 'fast';
  } else if (state.mode === 'fast' && state.idleStreak >= config.idlePollsToSlowDown) {
    state.mode = 'normal';
  }
  return state;
}

function nextDelay(state, now, config) {
  if (state.manualUntil > now) return config.fastMs;
  return state.mode === 'fast' ? config.fastMs : config.normalMs;
}

function startManualBurst(state, now, config, minutes) {
  const ms = minutes > 0 ? minutes * 60 * 1000 : config.manualBurstMs;
  state.manualUntil = now + ms;
  state.mode = 'fast';
  state.idleStreak = 0;
  return state;
}

module.exports = { getSchedulerConfig, createFarmState, applyPollResult, nextDelay, startManualBurst };
