/**
 * Gọi Telegram Bot API (không phải API game). Token lấy từ TELEGRAM_BOT_TOKEN trong .env, không bao giờ in ra log.
 */
const BASE = 'https://api.telegram.org';
// Render hay bị ETIMEDOUT khi kết nối Telegram qua IPv6: ưu tiên IPv4 (áp cho cả tiến trình, không ảnh hưởng gì khác)
require('dns').setDefaultResultOrder('ipv4first');

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

async function call(method, body = {}, { timeoutMs = 35000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      const err = new Error(`Telegram ${method}: ${data.description || res.status}`);
      err.status = res.status;
      throw err;
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

const sendMessage = (chatId, text) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
const getUpdates = (offset, timeout = 25) => call('getUpdates', { offset, timeout, allowed_updates: ['message'] }, { timeoutMs: (timeout + 10) * 1000 });

module.exports = { isConfigured: () => Boolean(token()), sendMessage, getUpdates };
