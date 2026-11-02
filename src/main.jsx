import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { FEATURES } from './config/features.js'
import FlipApp from './flip/FlipApp.jsx'

// Giao diện cũ chỉ tải khi bật cờ legacyApp (code vẫn giữ nguyên)
const LegacyApp = lazy(() => import('./LegacyRoot.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {FEATURES.legacyApp
      ? <Suspense fallback={null}><LegacyApp /></Suspense>
      : <FlipApp />}
  </StrictMode>,
)
