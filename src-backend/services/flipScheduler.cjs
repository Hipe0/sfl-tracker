/**
 * Quyết định nhịp lấy giao dịch FLIP: bình thường chậm, đang gom hàng thì nhanh.
 * Hàm thuần để test, không gọi API.
 */

function getSchedulerConfig(env = process.env) {
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  // 60 giây (người dùng chọn 2026-11-02). Bản 75 giây trước đây dựa trên giả thuyết "API chặn khi cùng key gọi sát
  // nhau ~1 phút", đã sai: docs + đo thật 2026-11-08 cho thấy giới hạn là ~1 request / 5 giây mỗi IP mỗi endpoint
  const normalMs = num(env.FLIP_SYNC_INTERVAL_SECONDS, 60) * 1000;
  return {
    // Chế độ gom hàng (nhịp nhanh) mặc định TẮT: luôn lấy giao dịch theo nhịp thường (60 giây).
    // FLIP_FAST_MODE=true để bật lại nhịp nhanh khi gom hàng
    fastEnabled: env.FLIP_FAST_MODE === 'true',
    normalMs,
    fastMs: num(env.FLIP_FAST_INTERVAL_SECONDS, 10) * 1000,
    // Số lệnh mới trong một lượt để coi là đang gom hàng
    burstThreshold: num(env.FLIP_BURST_THRESHOLD, 10),
    // Lệnh mới nhất khớp trong khoảng này cũng coi là đang giao dịch. Ít nhất 2 nhịp thường,
    // không thì lệnh khớp 61–119 giây trước lượt lấy (nhịp 60 giây) bị bỏ qua
    activeWindowMs: Math.max(num(env.FLIP_ACTIVE_WINDOW_SECONDS, 60) * 1000, 2 * normalMs),
    // Tự phát hiện đang gom hàng thì tự bật chế độ gom như bấm nút, giữ 10 phút kể từ lệnh mới nhất
    autoBurstMs: num(env.FLIP_AUTO_BURST_MINUTES, 10) * 60 * 1000,
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
    auto: false,
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
  if (config.fastEnabled === false) {
    if (newTrades > 0) {
      state.lastNewTradeAt = now;
      state.idleStreak = 0;
    } else {
      state.idleStreak += 1;
    }
    state.mode = 'normal';
    state.manualUntil = 0;
    state.auto = false;
    return state;
  }
  const recentlyActive = result.newestFulfilledAt != null && now - result.newestFulfilledAt <= config.activeWindowMs;

  if (newTrades > 0) {
    state.lastNewTradeAt = now;
    state.idleStreak = 0;
  } else {
    state.idleStreak += 1;
  }

  const burstDetected = newTrades >= config.burstThreshold || (newTrades > 0 && recentlyActive);
  if (burstDetected) {
    // Tự bật chế độ gom hàng (không cần bấm nút); đang bật tay thì chỉ kéo dài thêm. Tắt thì bấm nút Dừng gom hàng
    if (!(state.manualUntil > now)) state.auto = true;
    state.manualUntil = Math.max(state.manualUntil, now + config.autoBurstMs);
  }
  const manual = state.manualUntil > now;
  // Chế độ gom tự bật vừa hết hạn (10 phút không có lệnh mới) thì về nhịp thường ngay
  const autoExpired = !manual && state.auto;
  if (!manual) state.auto = false;

  if (burstDetected || manual) {
    state.mode = 'fast';
  } else if (state.mode === 'fast' && (autoExpired || state.idleStreak >= config.idlePollsToSlowDown)) {
    state.mode = 'normal';
  }
  return state;
}

function nextDelay(state, now, config) {
  if (config.fastEnabled === false) return config.normalMs;
  if (state.manualUntil > now) return config.fastMs;
  return state.mode === 'fast' ? config.fastMs : config.normalMs;
}

function startManualBurst(state, now, config, minutes) {
  if (config.fastEnabled === false) return state;
  const ms = minutes > 0 ? minutes * 60 * 1000 : config.manualBurstMs;
  state.manualUntil = now + ms;
  state.auto = false;
  state.mode = 'fast';
  state.idleStreak = 0;
  return state;
}

module.exports = { getSchedulerConfig, createFarmState, applyPollResult, nextDelay, startManualBurst };
