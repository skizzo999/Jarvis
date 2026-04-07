import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['jarvis.matteolizzo.it'],
    port: 3000,
    host: true
  }
})
