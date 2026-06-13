import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El proxy redirige /api al backend .NET para evitar problemas de CORS en dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        //target: 'http://localhost:5143',
        target: 'https://finances-backend-7njx.onrender.com',
        changeOrigin: true,
      },
      '/uploads': {
        //target: 'http://localhost:5143',
        target: 'https://finances-backend-7njx.onrender.com',
        changeOrigin: true,
      },
    },
  },
  // 'vite preview' en producción (Render): escucha en 0.0.0.0 y en el puerto
  // que inyecta la plataforma via la variable de entorno PORT.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
})
