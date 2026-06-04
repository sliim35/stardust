import { useEffect, useState } from "react";
import { DEFAULT_PALETTE, isPalette } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

const STORAGE_KEY = "galaxy-palette";

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
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isPalette(saved)) setPalette(saved);
  }, []);

  const choose = (next: Palette) => {
    setPalette(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return [palette, choose];
};
