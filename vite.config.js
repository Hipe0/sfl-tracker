import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sfl-proxy': {
        target: 'https://sfl.world',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sfl-proxy/, '')
      }
    }
  }
})
