import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 关键配置：确保打包后的路径是相对的，否则软件打开是白屏
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})