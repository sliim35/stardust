/**
 * The object-focus → cached-narration seam (ADR-0013 §2/§5, story #184). Returns a
 * stable `onNarrate(object)` callback the click wiring fires when a real object's
 * lore card opens: it asks the `narrateFn` server fn for a cached interesting fact
 * (keyed by the object's `loreKey`) and, on a hit, routes it through the SAME
 * `narration` seam ASTRO already uses.
 *
 * Coherent layering (story §"Wiring sites"): this shares `narration` state with
 * #183's add-star confirmation and the tier-transition lines without racing them —
 * it only ever fires on an object-card open, and writes the SAME `setNarration`
 * setter. A later confirmation/tier line simply replaces it (the seam is
 * last-writer-wins by design).
 *
 * SSR-safe (ADR-0003): the fetch happens in a click handler (client-only, request
 * scope), never at module scope; `env.AI`/KV live behind the server fn. Graceful
 * (ADR-0013 §5): a `null` result (AI/KV absent or failing) leaves the bubble as it
 * was — no narration rather than a broken view — and a thrown fn is swallowed.
 */

import { useCallback } from "react";
import { narrationRequestFor } from "#/lib/galaxy/narration-trigger";
import type { LoreEntry } from "#/lib/i18n/types";
import { narrateFn } from "#/server/narrate";

/** The minimal slice of a clicked object the narration trigger reads. */
type WithLoreKey = { loreKey: string };

export const useObjectNarration = (
  setNarration: (line: string) => void,
  lore: Record<string, Pick<LoreEntry, "name">>,
) =>
  useCallback(
    (object: WithLoreKey) => {
      const request = narrationRequestFor(object, lore);
      void narrateFn({ data: request })
        .then((line) => {
          // A hit/fresh generation takes the bubble over (same seam as #125/#183);
          // a graceful `null` leaves whatever ASTRO was already saying.
          if (line != null && line.length > 0) setNarration(line);
        })
        .catch(() => {
          // The server fn already degrades to `null`; this guards a transport
          // throw so a failed narration never crashes the read-only sky.
        });
    },
    [setNarration, lore],
  );
