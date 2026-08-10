import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        map: 'map.html',
      },
    },
  },
  resolve: {
    alias: {
      // Ran 主题组件用 @/ 引用自身目录（原版 Komari 路径约定）
      '@': fileURLToPath(new URL('./src/ran', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
