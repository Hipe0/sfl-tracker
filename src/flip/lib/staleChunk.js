/**
 * Lỗi "Failed to fetch dynamically imported module .../assets/LedgerPage-xxxx.js":
 * Vercel deploy bản mới thì file JS cũ (tên có mã băm) không còn, tab đang mở từ trước vẫn trỏ tên cũ.
 * Bấm thử lại trong trang không ăn thua (React.lazy nhớ luôn lần lỗi), phải tải lại cả trang để lấy index.html mới.
 */
const KEY = 'sfl_stale_chunk_reload_at';
const RETRY_MS = 30 * 1000;

const PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export const isStaleChunkError = err => PATTERN.test(String(err?.message || err || ''));

/**
 * Tải lại trang 1 lần. Trong 30 giây đã tải lại vì lỗi này rồi mà vẫn lỗi thì thôi (lỗi thật, không tải lại mãi).
 * Không đọc/ghi được sessionStorage thì cũng không tự tải lại, để khỏi lặp vô hạn.
 * @returns {boolean} true nếu đang tải lại
 */
export function reloadForStaleChunk() {
  try {
    const last = Number(window.sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < RETRY_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
