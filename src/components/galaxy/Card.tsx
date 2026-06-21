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
 * - **Lore skin** (Layer A — a real object): ASTRO's "FIELD LOG" eyebrow (mono +
 *   dim, *not* amber) · the object name · its real-distance sublabel · the curated
 *   lore line. Copy is read from the `lore.<loreKey>` catalog entry — never inline.
 * - **Memory skin** (Layer B — a memory star): the mood eyebrow (mono, uppercase,
 *   tinted the agent-owned mood colour) · the name · the full memory text (serif
 *   italic, warm) · opt-in attribution. The colour is rendered verbatim (the UI
 *   never recolours a star).
 *
 * Opens in place; **dismissable** (close button + Escape); **keyboard-focusable**
 * (`role="dialog"`, `aria-modal`, takes focus on open). `prefers-reduced-motion` →
 * `data-reduced-motion` flips the entrance from eased to instant (CSS, the styles
 * convention).
 *
 * **Styling boundary (#75 / #151 / #152):** the soft-glass chrome is Tailwind
 * utilities reading the `@theme` design tokens — *not* bespoke `.galaxy-card*` CSS.
 * The card reads as a **window cut into the void**: a subtle hairline + blur + a
 * thin **left-only** accent (a quoted passage) and a soft *drop* shadow — amber is
 * rare/earned, so there is **no** boxed glowing accent ring. The per-instance
 * `--card-accent` is the data-driven mood/object colour (like PaletteSwitcher's
 * `--swatch`); the kept `.galaxy-card*` class names are animation + test hooks only
 * (the `@keyframes` + reduced-motion gate live in `styles.css`, the loader precedent).
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
      // `galaxy-card` stays for the @keyframes entrance + reduced-motion gate +
      // the unit-test querySelector hooks; all *styling* is the utilities below.
      className="galaxy-card relative z-[1] w-max max-w-[min(420px,100%)] rounded border border-[color-mix(in_srgb,var(--card-accent)_28%,transparent)] border-l-2 border-l-(--card-accent) bg-surface px-[26px] pt-[22px] pb-[24px] shadow-[0_14px_46px_rgb(4_5_13/0.62)] backdrop-blur-[7px] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-(--card-accent)"
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
        className="absolute top-2 right-[10px] grid size-[22px] place-items-center border-0 bg-transparent p-0 font-mono text-[16px] leading-none text-dim-2 transition-colors duration-200 hover:text-text focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--card-accent) motion-reduce:transition-none"
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

/**
 * Lore skin — ASTRO's FIELD LOG: name · real distance sublabel · lore line.
 * The "FIELD LOG" eyebrow is mono + **dim** (not amber): amber is earned, and a
 * lore card is a quiet field note, not a memory.
 */
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
      <p className="m-0 mb-[10px] font-mono text-[10px] uppercase tracking-[0.22em] text-dim-2">
        {messages.card.fieldLog}
      </p>
      <h2 className="m-0 mb-[6px] font-serif text-[26px] font-normal leading-[1.15] text-text">
        {lore.name}
      </h2>
      <p className="m-0 mb-[14px] font-mono text-[11px] tracking-[0.06em] text-dim-2">
        {lore.sublabel}
      </p>
      <p className="m-0 font-serif text-[16px] leading-[1.5] text-dim">
        {lore.line}
      </p>
    </>
  );
};

/**
 * Memory skin — the mood eyebrow (mono, uppercase, in the agent-owned mood colour)
 * · name · the full memory text. The memory text is the heart of the card: serif
 * italic, lower-case, warm (loud enough to read first).
 */
const MemoryBody = ({
  model,
  messages,
}: {
  model: MemoryCardModel;
  messages: Messages;
}) => (
  <>
    <p className="m-0 mb-[10px] font-mono text-[10px] uppercase tracking-[0.22em]">
      {/* The mood word carries the agent's mood colour (the earned accent); the
          attribution stays dim so the mood reads first. */}
      <span className="text-(--card-accent)">{messages.moods[model.mood]}</span>
      {model.who ? <span className="text-dim-2"> · {model.who}</span> : null}
    </p>
    {model.name && (
      <h2 className="m-0 mb-[6px] font-serif text-[26px] font-normal leading-[1.15] text-text">
        {model.name}
      </h2>
    )}
    <p className="m-0 font-serif text-[16px] italic leading-[1.5] text-text">
      {model.text}
    </p>
    {model.trigger && (
      // The trigger chip (BR28) — a quiet pill below the memory, so "what sparked
      // it" reads after the memory itself, never competing with the mood eyebrow.
      <p className="mt-[14px] mb-0">
        <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--card-accent)_30%,transparent)] px-[10px] py-[3px] font-mono text-[10px] uppercase tracking-[0.16em] text-dim-2">
          {messages.card.trigger[model.trigger]}
        </span>
      </p>
    )}
  </>
);
