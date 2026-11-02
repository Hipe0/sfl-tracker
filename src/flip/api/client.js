/**
 * Tầng gọi backend của app FLIP. Mọi request gửi kèm mã truy cập (x-flip-key).
 * Backend chỉ đọc DB; dữ liệu mới từ API Sunflower Land do job nền hoặc nút Đồng bộ đưa vào DB.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const NETWORK_MESSAGE = 'Không kết nối được server. Kiểm tra server backend (npm run dev) đã chạy chưa.';

export async function request(path, { key, method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(key ? { 'x-flip-key': key } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, { code: 'NETWORK' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new ApiError(data?.message || data?.error || `Lỗi server ${res.status}`, { status: res.status, code: data?.error, data });
  }
  return data?.data ?? data;
}

export const api = {
  publicInfo: () => request('/api/flip/public'),
  register: (farmId, apiKey) => request('/api/flip/register', { method: 'POST', body: { farmId, apiKey } }),
  status: key => request('/api/flip/status', { key }),
  sync: key => request('/api/flip/sync', { key, method: 'POST' }),
  calendar: key => request('/api/market/calendar', { key }),
  overview: (key, range) => request(`/api/market/overview?range=${range}`, { key }),
  signals: key => request('/api/market/signals', { key }),
  holdings: key => request('/api/market/holdings', { key }),
  recos: key => request('/api/market/recos', { key }),
  item: (key, item, { granularity, range }) =>
    request(`/api/market/items/${encodeURIComponent(item)}?granularity=${granularity}&range=${range}`, { key }),
  marketStatus: key => request('/api/market/status', { key }),
  demand: key => request('/api/market/demand', { key }),
  addDemand: (key, body) => request('/api/market/demand', { key, method: 'POST', body }),
  deleteDemand: (key, id) => request(`/api/market/demand/${id}`, { key, method: 'DELETE' })
};
