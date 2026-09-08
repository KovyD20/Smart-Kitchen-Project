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
    // Vitest runs test files in parallel workers, and the jsdom ones (a full
    // React render plus fake timers) are slow enough that the 5s default turns
    // machine load into a red build: a different test times out on each run,
    // never the same one twice, and `--no-file-parallelism` makes them all pass.
    // A timeout is there to stop a hang, not to measure speed, so give the slow
    // ones room. Raise this rather than chasing the flake if it comes back.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
