import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 相对路径打包：dist 可放在任意子目录下托管。
  // 注意：dist/index.html 不能直接双击打开（产物是 type="module"，file:// 下被 CORS 拦掉），
  // 需要单文件版本时执行 npm run release。
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
})
