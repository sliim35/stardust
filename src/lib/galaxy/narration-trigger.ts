/**
 * The narration TRIGGER mapping (ADR-0013 §2/§5) — pure: a clicked real object →
 * the `{ key, subject }` the narration server fn needs. Keeps the wiring in
 * `GalaxyStage` thin and the subject derivation headless-testable.
 *
 * Chosen trigger (the build-story decision, pinned by tests): when the visitor
 * opens a real object's lore card, ASTRO ALSO narrates a cached interesting fact
 * about it, keyed by the object's stable `loreKey`. This layers cleanly onto the
 * existing `narration` seam — it does not clobber #183's add-star confirmation
 * (which fires only on submit) or the tier-transition lines (which fire on a tier
 * change, not an object click).
 *
 * The cache `key` is the `loreKey` (a stable, finite, normalizable id set); the
 * `subject` is the object's English display name from the catalog (so the AI prompt
 * can name the real object). English-only MVP (ADR-0013 §4); ru → #182.
 */

import type { LoreEntry } from "#/lib/i18n/types";

/** The narration request sent to the server fn (`src/server/narrate.ts`). */
export type NarrationRequest = { key: string; subject: string };

/** The minimal slice of a clicked object the trigger needs — just its lore key. */
type WithLoreKey = { loreKey: string };

/**
 * Build the narration request for a clicked real object: key by its `loreKey`,
 * subject from the catalog's English `name` (falling back to the key itself if the
 * catalog entry is somehow absent, so the subject is never empty).
 */
export const narrationRequestFor = (
  object: WithLoreKey,
  lore: Record<string, Pick<LoreEntry, "name">>,
): NarrationRequest => ({
  key: object.loreKey,
  subject: lore[object.loreKey]?.name ?? object.loreKey,
});
