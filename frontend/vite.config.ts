import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
    // Docker Desktop + bind mount на Windows: без polling Vite не видит сохранённые файлы
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
