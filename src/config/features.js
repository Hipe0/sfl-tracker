/**
 * Bật/tắt giao diện. App hiện chỉ chạy FLIP; giao diện cũ (dashboard, deliveries, chores, đấu giá...)
 * vẫn giữ nguyên code trong src/App.jsx và src/components, chỉ không hiển thị.
 * Muốn xem lại giao diện cũ: đặt VITE_FEATURE_LEGACY=true trong .env (hoặc sửa legacyApp thành true).
 */
export const FEATURES = {
  legacyApp: import.meta.env.VITE_FEATURE_LEGACY === 'true'
};
