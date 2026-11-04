/**
 * Bot Telegram báo cho chủ app:
 * - Món mới lọt top Mua (giá offer, hạn offer, giá bán, hạn bán)
 * - Offer đề xuất có thể đã khớp (giá sàn chạm giá offer) hoặc hết hạn hôm nay
 * - Hàng đang giữ trong Sổ Flip tới lúc nên bán (vòng mùa báo Bán, hoặc chạm giá bán mục tiêu)
 *
 * Đăng ký nhận tin: nhắn cho bot "/start <mã FLIP_OWNER_KEY>" (hoặc đặt TELEGRAM_CHAT_ID trong .env).
 * Lệnh khác: /top (top Mua hiện tại), /giu (hàng đang giữ), /tatbao, /help.
 * Mỗi tin chỉ gửi 1 lần (lưu khoá trong collection notify_log).
 */
const telegram = require('../clients/telegramClient.cjs');
const { getCollection } = require('../config/db.cjs');
const marketRepo = require('../repositories/marketRepository.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = ts => new Date(ts).toISOString().slice(0, 10);
const fmt = n => (n == null || !Number.isFinite(n) ? '–' : Number(n.toPrecision(4)).toString());
const pct = n => (n == null || !Number.isFinite(n) ? '–' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);
const vnDate = d => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let started = false;
const notifyLog = () => getCollection('notify_log');
const owners = () => require('../services/flipService.cjs').getOwnerFarmIds();

async function chatIds() {
  const fromEnv = String(process.env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  const meta = await marketRepo.getMeta('telegram');
  return [...new Set([...fromEnv, ...(meta.chatIds || [])])];
}

async function broadcast(text) {
  for (const id of await chatIds()) {
    await telegram.sendMessage(id, text).catch(e => console.warn('[Telegram] Gửi tin lỗi:', e.message));
  }
}

/** Gửi 1 lần cho mỗi khoá */
async function notifyOnce(key, text) {
  // Chưa ai đăng ký thì không ghi khoá, để lúc đăng ký xong vẫn nhận được tin trong ngày
  if (!(await chatIds()).length) return false;
  const r = await notifyLog().updateOne({ _id: key }, { $setOnInsert: { at: Date.now(), text } }, { upsert: true });
  if (!r.upsertedCount) return false;
  await broadcast(text);
  return true;
}

const buyText = s => `🟢 <b>Mua ${esc(s.item)}</b>${s.rank ? ` (#${s.rank})` : ''}\n`
  + `Đặt offer <b>${fmt(s.buyPrice)}</b> tới ${vnDate(s.buyBy)} (giá sàn đang ${fmt(s.price)})\n`
  + `Khớp rồi treo bán <b>${fmt(s.sellTarget)}</b>, chậm nhất ${vnDate(s.sellBy)} · lãi ròng ${pct(s.netMargin)}`;

const holdText = h => `🟣 <b>Bán ${esc(h.item)}</b> (đang giữ ${fmt(h.qty)})\n${esc(h.note)}\n`
  + `Giá hiện tại ${fmt(h.price)}, giá vốn ${fmt(h.avgCost)} → lãi sau thuế ${pct(h.netNow)}`;

/** Gọi sau mỗi lượt theo dõi đề xuất (jobs/recoTracker) */
async function onRecoResult({ logged, changes }) {
  if (!telegram.isConfigured()) return;
  const today = utcDate(Date.now());
  for (const s of logged.rows) await notifyOnce(`buy|${today}|${s.item}`, buyText(s));

  for (const c of changes) {
    const r = c.reco;
    if (c.to === 'holding' && c.from !== 'holding') {
      await notifyOnce(`fill|${r._id}`, `✅ Offer <b>${esc(r.item)}</b> ${fmt(r.buyPrice)} có thể đã khớp (giá sàn chạm ${fmt(c.eval.fillPrice)}). Nhớ treo bán ${fmt(r.sellTarget)}, chậm nhất ${vnDate(r.sellBy)}`);
    }
  }
  // Offer hết hạn hôm nay mà chưa khớp
  const expiring = await getCollection('market_reco').find({ buyBy: today, 'eval.status': 'pending' }).toArray();
  for (const r of expiring) {
    await notifyOnce(`expire|${r._id}`, `⏰ Offer <b>${esc(r.item)}</b> ${fmt(r.buyPrice)} hết hạn hôm nay (${vnDate(r.buyBy)}). Chưa khớp thì huỷ để giải phóng SFL`);
  }

  // Hàng đang giữ tới lúc bán
  const { rows } = await require('../services/marketService.cjs').getHoldings(owners());
  for (const h of rows.filter(x => x.action === 'sell_now')) {
    await notifyOnce(`sell|${today}|${h.farmId}|${h.item}`, holdText(h));
  }
}

async function topText() {
  const { signals } = await require('../services/marketService.cjs').getSignals({ farmId: owners()[0] });
  const buys = signals.filter(s => s.decision === 'buy');
  return buys.length ? buys.map(buyText).join('\n\n') : 'Hiện chưa có món nào đủ điều kiện Mua.';
}

async function holdingsText() {
  const { rows } = await require('../services/marketService.cjs').getHoldings(owners());
  if (!rows.length) return 'Không có lô nào đang giữ.';
  return rows.slice(0, 15).map(h => `${h.action === 'sell_now' ? '🟣 Bán' : '⏳ Giữ'} <b>${esc(h.item)}</b> ×${fmt(h.qty)} · vốn ${fmt(h.avgCost)} · giờ ${fmt(h.price)} (${pct(h.netNow)})`
    + (h.action === 'hold' ? `\n   treo bán ${fmt(h.target)} (${pct(h.netAtTarget)}), đỉnh ~${vnDate(h.sellBy)}` : '')).join('\n');
}

const HELP = 'Lệnh: /top (món nên mua), /giu (hàng đang giữ), /tatbao (ngừng nhận tin), /help';

async function handleMessage(msg) {
  const chatId = String(msg.chat?.id || '');
  const text = String(msg.text || '').trim();
  if (!chatId || !text.startsWith('/')) return;
  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const registered = (await chatIds()).includes(chatId);
  const { keysMatch } = require('../services/flipService.cjs');

  if (cmd === '/start') {
    if (!registered && !(process.env.FLIP_OWNER_KEY && keysMatch(args[0] || '', process.env.FLIP_OWNER_KEY))) {
      return telegram.sendMessage(chatId, 'Gửi "/start <mã chủ app>" để nhận tin.');
    }
    const meta = await marketRepo.getMeta('telegram');
    await marketRepo.setMeta('telegram', { chatIds: [...new Set([...(meta.chatIds || []), chatId])] });
    return telegram.sendMessage(chatId, `Đã đăng ký nhận tin SFL Flip. ${HELP}`);
  }
  if (!registered) return null;
  if (cmd === '/top') return telegram.sendMessage(chatId, await topText());
  if (cmd === '/giu') return telegram.sendMessage(chatId, await holdingsText());
  if (cmd === '/tatbao') {
    const meta = await marketRepo.getMeta('telegram');
    await marketRepo.setMeta('telegram', { chatIds: (meta.chatIds || []).filter(id => id !== chatId) });
    return telegram.sendMessage(chatId, 'Đã ngừng gửi tin cho chat này. Gửi /start <mã chủ app> để bật lại.');
  }
  return telegram.sendMessage(chatId, HELP);
}

/** Nhận lệnh bằng long polling (không cần webhook hay mở cổng) */
async function pollLoop() {
  const meta = await marketRepo.getMeta('telegram');
  let offset = meta.offset || 0;
  let fails = 0;
  for (;;) {
    try {
      const updates = await telegram.getUpdates(offset);
      if (fails >= 3) console.log(`[Telegram] Kết nối lại được sau ${fails} lần lỗi`);
      fails = 0;
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) await handleMessage(u.message).catch(e => console.warn('[Telegram] Lỗi xử lý lệnh:', e.message));
      }
      if (updates.length) await marketRepo.setMeta('telegram', { offset });
    } catch (e) {
      fails++;
      // Lùi dần 10s → 5 phút. Lỗi lẻ tẻ (1–2 lần rồi nối lại) không ghi log; lỗi liên tiếp ghi ở lần 3 và mỗi 10 lần
      const wait = e.status === 409 ? 60000 : Math.min(10000 * 2 ** Math.min(fails - 1, 5), 5 * 60 * 1000);
      if (fails === 3 || (fails > 3 && fails % 10 === 0)) {
        const cause = e.cause?.code || e.cause?.message || '';
        const hint = e.status === 409 ? ' (token đang chạy ở nơi khác, vd bản local)' : e.status === 401 ? ' (token sai)' : '';
        console.warn(`[Telegram] Lỗi nhận lệnh (lần ${fails}): ${e.message}${cause ? ` [${cause}]` : ''}${hint}, thử lại sau ${Math.round(wait / 1000)}s`);
      }
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

function startTelegramBot() {
  if (started || !telegram.isConfigured()) return false;
  started = true;
  getCollection('notify_log').createIndex({ at: 1 }, { expireAfterSeconds: 60 * DAY_MS / 1000 }).catch(() => {});
  pollLoop();
  console.log('[Telegram] Bot đang chạy. Nhắn "/start <mã chủ app>" cho bot để nhận tin');
  return true;
}

module.exports = { startTelegramBot, onRecoResult, handleMessage, buyText, holdText };
