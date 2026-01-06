import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, '')
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/avatars': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})