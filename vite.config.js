import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El proxy redirige /api al backend .NET para evitar problemas de CORS en dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5142',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5142',
        changeOrigin: true,
      },
    },
  },
})
