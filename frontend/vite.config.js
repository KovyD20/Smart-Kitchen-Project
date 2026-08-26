import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  plugins: [react()],
  test: {
    // Most tests here cover pure logic, so Node stays the default. Hook and
    // component tests opt into a DOM per file with a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
