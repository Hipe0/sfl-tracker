import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { FEATURES } from './config/features.js'
import FlipApp from './flip/FlipApp.jsx'
import { reloadForStaleChunk } from './flip/lib/staleChunk.js'

// Vercel vừa deploy bản mới mà tab đang mở còn trỏ file JS cũ (đã bị xoá): tải lại trang để lấy bản mới
window.addEventListener('vite:preloadError', () => { reloadForStaleChunk() })

// Giao diện cũ chỉ tải khi bật cờ legacyApp (code vẫn giữ nguyên)
const LegacyApp = lazy(() => import('./LegacyRoot.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {FEATURES.legacyApp
      ? <Suspense fallback={null}><LegacyApp /></Suspense>
      : <FlipApp />}
  </StrictMode>,
)
