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

// The default suite (`pnpm test`/CI) only collects `*.test.ts[x]`. Non-blocking eval
// harnesses end in `*.smoke.ts` and are pulled in ONLY when `RUN_MOOD_SMOKE=1` is set
// (#211 AC4) — so a red eval can never fail the default gate. Vitest 4 dropped the
// `--include` CLI flag, so the opt-in lives here in config, env-gated.
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
    // `include` is built above: `*.smoke.ts` is added only under `RUN_MOOD_SMOKE=1`. The
    // mood-classifier accuracy smoke needs the real Workers-AI model, so it's a manual /
    // preview eval, run on demand:
    //   RUN_MOOD_SMOKE=1 pnpm test src/lib/galaxy/mood-detect.smoke.ts
    include,
    // Polyfills jsdom's missing `matchMedia` for component tests; a no-op under node.
    setupFiles: ['src/test/setup-dom.ts'],
  },
})
