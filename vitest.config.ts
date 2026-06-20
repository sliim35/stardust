import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Standalone config: the app's Cloudflare Workers Vite plugin breaks Vitest's SSR env.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Vitest 4 dropped --include; *.smoke.ts is opt-in via RUN_MOOD_SMOKE.
const RUN_SMOKE = process.env.RUN_MOOD_SMOKE === '1'
const include = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  ...(RUN_SMOKE ? ['src/**/*.smoke.ts'] : []),
]

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^#\/(.*)$/, replacement: `${r('./src')}/$1` },
      // Stub `cloudflare:workers` (omitted with the CF plugin) so server-fn imports resolve.
      { find: 'cloudflare:workers', replacement: r('./src/test/cloudflare-workers-stub.ts') },
    ],
  },
  test: {
    environment: 'node',
    // smoke: RUN_MOOD_SMOKE=1 pnpm test src/lib/galaxy/mood-detect.smoke.ts
    include,
    // Polyfills jsdom's missing `matchMedia` for component tests; a no-op under node.
    setupFiles: ['src/test/setup-dom.ts'],
  },
})
