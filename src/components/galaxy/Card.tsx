import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import type { Messages } from "#/lib/i18n/types";
import type { CardModel, LoreCardModel, MemoryCardModel } from "./card-model";
import { useReducedMotion } from "./useReducedMotion";

/**
 * The card — one soft-glass panel, two skins (interaction spec §4, ADR-0010 §1).
 * **Presentational + pure:** it takes a resolved `model` (lore | memory) + the
 * active `Messages` + `onClose`, so it renders identically given the same props
 * and is unit-testable without a router. `CardHost` does the `useLocale()` +
 * `useCard` wiring (the codebase's pure-leaf / thin-wrapper split).
 *
 * - **Lore skin** (Layer A — a real object): ASTRO's "FIELD LOG" eyebrow · the
 *   object name · its real-distance sublabel · the curated lore line. Copy is read
 *   from the `lore.<loreKey>` catalog entry — never inline.
 * - **Memory skin** (Layer B — a memory star): the mood eyebrow (in the mood label,
 *   tinted the agent-owned mood colour) · the name · the full memory text · opt-in
 *   attribution. The colour is rendered verbatim (the UI never recolours a star).
 *
 * Opens in place; **dismissable** (close button + Escape); **keyboard-focusable**
 * (`role="dialog"`, `aria-modal`, takes focus on open). `prefers-reduced-motion` →
 * `data-reduced-motion` flips the entrance from eased to instant (CSS, the styles
 * convention). Soft-glass look (blur + accent border) lives in `styles.css`.
 */

type Props = {
  model: CardModel;
  messages: Messages;
  onClose: () => void;
};

export const Card = ({ model, messages, onClose }: Props) => {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Take focus on open so Escape/Tab work immediately and the dialog is announced.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="galaxy-card"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      data-skin={model.skin}
      data-reduced-motion={reduced || undefined}
      style={{ "--card-accent": model.color } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="galaxy-card__close"
        aria-label={messages.card.close}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      {model.skin === "lore" ? (
        <LoreBody model={model} messages={messages} />
      ) : (
        <MemoryBody model={model} messages={messages} />
      )}
    </div>
  );
};

/** Lore skin — ASTRO's FIELD LOG: name · real distance sublabel · lore line. */
const LoreBody = ({
  model,
  messages,
}: {
  model: LoreCardModel;
  messages: Messages;
}) => {
  const lore = messages.lore[model.loreKey];
  return (
    <>
      <p className="galaxy-card__eyebrow">{messages.card.fieldLog}</p>
      <h2 className="galaxy-card__name">{lore.name}</h2>
      <p className="galaxy-card__sublabel">{lore.sublabel}</p>
      <p className="galaxy-card__body">{lore.line}</p>
    </>
  );
};

/** Memory skin — the mood eyebrow (mood-coloured) · name · the full memory text. */
const MemoryBody = ({
  model,
  messages,
}: {
  model: MemoryCardModel;
  messages: Messages;
}) => (
  <>
    <p className="galaxy-card__eyebrow galaxy-card__eyebrow--mood">
      <span className="galaxy-card__mood">{messages.moods[model.mood]}</span>
      {model.who ? (
        <span className="galaxy-card__who"> · {model.who}</span>
      ) : null}
    </p>
    {model.name && <h2 className="galaxy-card__name">{model.name}</h2>}
    <p className="galaxy-card__body galaxy-card__body--memory">{model.text}</p>
  </>
);
