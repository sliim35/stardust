import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Standalone Vitest config.
// The app's `vite.config.ts` includes the Cloudflare Workers plugin, which is
// incompatible with the way Vitest/Vite create the SSR environment (it throws a
// `resolve.external` startup error). Unit tests here are pure functions, so we
// run them in a plain Node environment and only wire up the two import aliases
// the source files rely on.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'content-collections',
        replacement: r('./.content-collections/generated'),
      },
      { find: /^#\/(.*)$/, replacement: `${r('./src')}/$1` },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
