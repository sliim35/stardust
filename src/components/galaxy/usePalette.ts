import { useEffect, useState } from "react";
import { DEFAULT_PALETTE, isPalette } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

/** The localStorage key the chosen palette persists under (one source of truth). */
export const PALETTE_STORAGE_KEY = "galaxy-palette";

/**
 * Read the persisted palette synchronously, defaulting to `ember` (the
 * owner-resolved sky). SSR-safe: returns the default when `window`/localStorage
 * is absent or holds an unknown value, so callers can use it in a `useState`
 * initializer for a correct first **client** paint without a post-mount flip.
 * The galaxy stage owns the live choice; this is the read seam the loader (which
 * renders before the stage mounts) and the hook share.
 */
export const readPersistedPalette = (): Palette => {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const saved = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  return isPalette(saved) ? saved : DEFAULT_PALETTE;
};

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
