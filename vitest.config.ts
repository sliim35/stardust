import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Standalone Vitest config.
// The app's `vite.config.ts` includes the Cloudflare Workers plugin, which is
// incompatible with the way Vitest/Vite create the SSR environment (it throws a
// `resolve.external` startup error). Most unit tests are pure functions, so the
// **default** environment stays plain Node. A handful of component tests (`.test.tsx`)
// render React with Testing Library; they opt into jsdom per-file via a
// `// @vitest-environment jsdom` docblock (#146/#5 card system), so the pure suite
// pays no jsdom cost. We wire the `#/` import alias the source files rely on, plus
// the React plugin so JSX/TSX transforms in component tests.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^#\/(.*)$/, replacement: `${r('./src')}/$1` },
      // The `cloudflare:workers` virtual module is provided by the Cloudflare Vite
      // plugin, which this standalone config omits (it breaks Vitest's SSR env).
      // Server-fn modules import `{ env }` from it at module scope; alias it to a
      // throwing stub so those imports resolve. Component tests render only the
      // chrome and never invoke the server fn (#183).
      { find: 'cloudflare:workers', replacement: r('./src/test/cloudflare-workers-stub.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Polyfills jsdom's missing `matchMedia` for component tests; a no-op under node.
    setupFiles: ['src/test/setup-dom.ts'],
  },
})
