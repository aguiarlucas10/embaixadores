import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@apps': path.resolve(__dirname, './src/apps'),
    },
  },
  // base: '/' — CNAME ativo no domínio embaixadores.saintgermainbrand.com.br
  base: '/',
})
