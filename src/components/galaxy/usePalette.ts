import { useEffect, useState } from "react";
import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  readPersistedPalette,
} from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

// `readPersistedPalette` + `PALETTE_STORAGE_KEY` now live in the pure lib
// `#/lib/galaxy/palette` (the single, unit-tested resolution seam the loader and
// the galaxy stage share). Re-exported here so existing importers keep working.
export { PALETTE_STORAGE_KEY, readPersistedPalette };

/**
 * The chosen backdrop theme (#44 resolved as a user choice, layered over a
 * fixed default). SSR renders the `ember` (amber) default — the owner-resolved
 * amber-vs-green sky (2026-06-04); the saved pick is restored after hydration
 * and persisted on change. Only the backdrop is themed — memory-star colors
 * stay agent-owned.
 */
export const usePalette = (): [Palette, (p: Palette) => void] => {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    setPalette(readPersistedPalette());
  }, []);

  const choose = (next: Palette) => {
    setPalette(next);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
  };

  return [palette, choose];
};
