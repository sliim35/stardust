import { cloudflare } from "@cloudflare/vite-plugin";
import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Cloudflare Workers forbid generating random values in global (module-init)
// scope. `@tanstack/ai-event-client` calls crypto.randomUUID() at import time to
// build a devtools runtime id, which crashes SSR on every route. Seed the global
// it guards on so that random call is skipped. Prepended to every output chunk so
// it runs before the offending module's body, regardless of import order.
const SEED_AI_DEVTOOLS_RUNTIME_ID =
  'globalThis.__TANSTACK_AI_DEVTOOLS_RUNTIME_ID__ ||= "ssr";';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    rollupOptions: {
      output: { banner: SEED_AI_DEVTOOLS_RUNTIME_ID },
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    contentCollections(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
