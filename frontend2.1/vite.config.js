import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Plugins used for both dev and testing
  plugins: [react()],
  
  // Electron-specific build settings
  base: './', 
  build: {
    outDir: '../electron2.1/frontend_build', 
    emptyOutDir: true,
  },

  // Vitest settings for your Unit Tests
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js', 
  },
})
