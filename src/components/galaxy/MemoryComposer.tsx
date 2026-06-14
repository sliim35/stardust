import { useEffect, useId, useRef, useState } from "react";
import type { AddMemoryErrorKey } from "#/lib/galaxy/add-memory";
import type { MemoryStar } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import { addStarFn } from "#/server/add-star";

/**
 * "Add your star" composer (#183) — the minimal English input affordance for the
 * MVP write path (NOT the conversational agent — that is #182). A quiet trigger
 * opens a small panel with a textarea; submit calls the `addStarFn` server fn
 * (moderate → Workers-AI mood → derive → D1 insert) and, on success, ignites the
 * returned star in the live sky via `onStarAdded` and routes ASTRO's confirmation
 * through the `narration` seam via `onConfirm`. A rejection shows the authored
 * `chat.error.*` message inline.
 *
 * Chrome is Tailwind utilities reading the @theme tokens (#75 boundary); all copy
 * comes from the typed catalog via `getMessages(useLocale())` (no inline strings).
 * The submit/loading state is client-only (no SSR `Date`/random), and the panel
 * starts closed, so the SSR markup is the trigger button alone — byte-stable.
 */

type Props = {
  /** Ignite the saved star in the live sky (the store's `addStar`). */
  onStarAdded: (star: MemoryStar) => void;
  /** Route ASTRO's confirmation line through the `narration` seam. */
  onConfirm: (message: string) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; errorKey: AddMemoryErrorKey };

export const MemoryComposer = ({ onStarAdded, onConfirm }: Props) => {
  const m = getMessages(useLocale());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fieldId = useId();
  const errorId = useId();
  // Guard the in-flight submit against an unmount mid-await: a composer that
  // unmounts while `addStarFn` is resolving must not fire `onConfirm` /
  // `onStarAdded` on a gone parent (review #188).
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const submitting = status.kind === "submitting";

  const close = () => {
    setOpen(false);
    setText("");
    setStatus({ kind: "idle" });
  };

  const onSubmit = async () => {
    if (submitting) return;
    setStatus({ kind: "submitting" });
    try {
      const result = await addStarFn({ data: text });
      if (!mounted.current) return;
      if (result.ok) {
        onStarAdded(result.star);
        onConfirm(m.chat.success);
        close();
        return;
      }
      setStatus({ kind: "error", errorKey: result.errorKey });
    } catch {
      if (!mounted.current) return;
      setStatus({ kind: "error", errorKey: "failed" });
    }
  };

  if (!open) {
    return (
      <div className="pointer-events-none absolute right-[max(28px,env(safe-area-inset-right))] bottom-[max(22px,env(safe-area-inset-bottom))] max-[620px]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto cursor-pointer rounded-snug border border-accent-soft bg-transparent px-4 py-2 font-mono text-eyebrow text-accent transition-colors duration-200 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          {m.chat.open}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute right-[max(28px,env(safe-area-inset-right))] bottom-[max(22px,env(safe-area-inset-bottom))] max-[620px]:hidden">
      <div className="pointer-events-auto flex w-[min(360px,80vw)] flex-col gap-3 rounded border border-accent-soft bg-surface p-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <label
            htmlFor={fieldId}
            className="font-mono text-eyebrow text-accent"
          >
            {m.chat.label}
          </label>
          <button
            type="button"
            onClick={close}
            aria-label={m.chat.close}
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-eyebrow text-dim-3 transition-colors duration-200 hover:text-accent focus-visible:rounded-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            ×
          </button>
        </div>
        <textarea
          id={fieldId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={m.chat.placeholder}
          rows={3}
          disabled={submitting}
          aria-invalid={status.kind === "error"}
          aria-describedby={status.kind === "error" ? errorId : undefined}
          className="resize-none rounded-snug border border-accent-soft bg-space-deep/60 px-3 py-2 font-sans text-dim placeholder:text-dim-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60"
        />
        {status.kind === "error" && (
          <p
            id={errorId}
            role="alert"
            className="m-0 font-sans text-count text-dim-2"
          >
            {m.chat.error[status.errorKey]}
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="cursor-pointer self-end rounded-snug border border-accent bg-accent-soft px-4 py-2 font-mono text-eyebrow text-accent transition-colors duration-200 hover:bg-accent hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
        >
          {submitting ? m.chat.submitting : m.chat.submit}
        </button>
      </div>
    </div>
  );
};
