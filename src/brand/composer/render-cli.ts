/**
 * CLI: render the default brand set into `brand/renders/<channel>/`.
 *
 *   pnpm tsx src/brand/composer/render-cli.ts
 *
 * Each render emits a PNG + a JSON sidecar (#83 AC9). Output is deterministic:
 * same seed ⇒ byte-identical PNG. `brand/renders/` is committed (spec §AC4 — the
 * outward-facing deliverables).
 */

import { fileURLToPath } from "node:url";
import { DEFAULT_RENDER_SET, writeRender } from "#/brand/composer/render-set";

const main = async (): Promise<void> => {
  // repo-root/brand/renders (this file lives at src/brand/composer/)
  const outDir = fileURLToPath(
    new URL("../../../brand/renders/", import.meta.url),
  );
  for (const { name, input } of DEFAULT_RENDER_SET) {
    const { png } = await writeRender(outDir, name, input);
    console.log(`rendered ${input.channel}/${name} → ${png}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
