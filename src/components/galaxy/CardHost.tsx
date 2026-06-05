import { createContext, type ReactNode, useContext } from "react";
import { getMessages, useLocale } from "#/lib/i18n";
import { Card } from "./Card";
import type { CardTarget } from "./card-model";
import { useCard } from "./useCard";

/**
 * `CardHost` — the card system's mount point + the **`openCard` API provider**
 * (interaction spec §4). It owns the open/close state (`useCard`), resolves the
 * active-locale catalog (`getMessages(useLocale())`), and renders the one open
 * `Card` over a dismiss backdrop. Children read `openCard` / `close` from
 * `useCardContext()` and call `openCard(target)` (a `RealObject` → lore, a
 * `MemoryStar` → memory).
 *
 * **Deliberately NOT wired to GalaxyStage clicks** (ADR-0010 / spec §1): the
 * click→openCard wiring is a later slice (E, tier-nav). This host only provides
 * the API + the rendered card + dismissal (close button, Escape, backdrop click);
 * one card at a time is guaranteed by the underlying reducer.
 */

type CardApi = {
  openCard: (target: CardTarget) => void;
  close: () => void;
};

const CardContext = createContext<CardApi | null>(null);

/** Read the `openCard` / `close` API. Throws if used outside a `<CardHost>`. */
export const useCardContext = (): CardApi => {
  const ctx = useContext(CardContext);
  if (ctx === null) {
    throw new Error("useCardContext must be used within a <CardHost>");
  }
  return ctx;
};

export const CardHost = ({ children }: { children?: ReactNode }) => {
  const { model, openCard, close } = useCard();
  const messages = getMessages(useLocale());

  return (
    <CardContext.Provider value={{ openCard, close }}>
      {children}
      {model && (
        <div className="galaxy-card-layer">
          {/* A decorative click-to-dismiss scrim (mouse-only convenience). It is
              aria-hidden + carries no role/semantics, so it isn't an interactive
              element biome flags: keyboard dismissal is fully owned by the focused
              dialog's Escape (Card.tsx) — the standard accessible modal pattern. */}
          <div
            className="galaxy-card-backdrop"
            aria-hidden="true"
            onClick={close}
          />
          <Card model={model} messages={messages} onClose={close} />
        </div>
      )}
    </CardContext.Provider>
  );
};
