import App from './App.jsx'
import { FarmProvider } from './context/FarmContext.jsx'

/** Giao diện cũ (trước khi app chỉ còn FLIP), bật bằng VITE_FEATURE_LEGACY=true */
export default function LegacyRoot() {
  return (
    <FarmProvider>
      <App />
    </FarmProvider>
  )
}
