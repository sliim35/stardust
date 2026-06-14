import { useEffect, useId, useRef, useState } from "react";
import type { AddMemoryErrorKey } from "#/lib/galaxy/add-memory";
import type { MemoryStar } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import { addStarFn } from "#/server/add-star";

/**
 * The "add your star" form, rendered INSIDE ASTRO's speech bubble (#183 redesign,
 * dir. A). ASTRO invites the memory and the form lives in the *same* glass surface —
 * one voice, no second panel competing for the bottom-right corner (the old layout
 * collided with the bubble + sprite). Submit calls the `addStarFn` server fn
 * (moderate → Workers-AI mood → derive → D1 insert); on success the parent ignites
 * the returned star in the live sky and ASTRO speaks the confirmation. Cancelling is
 * the bubble's own × (the parent flips composing off) — no second close control.
 *
 * Chrome is Tailwind utilities reading the `@theme` tokens (#75 boundary); every
 * string comes from the typed catalog (#103). Typography FLOWS with the bubble —
 * Nunito body at 16px (`text-base`), an accent CTA at `text-sm` — never the 10px mono
 * eyebrow the standalone panel mistakenly used.
 *
 * SSR-safe: no module-scope clock/random; the only async is the click-driven submit.
 * A `mounted` ref guards the post-await path so an unmount mid-flight can't fire
 * `onSuccess` on a gone parent.
 */
type Props = {
  /** A saved star: ignite it (parent) + the line ASTRO should speak next. */
  onSuccess: (star: MemoryStar, confirmation: string) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; errorKey: AddMemoryErrorKey };

export const AstroComposer = ({ onSuccess }: Props) => {
  const m = getMessages(useLocale());
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fieldId = useId();
  const errorId = useId();
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const submitting = status.kind === "submitting";

  const onSubmit = async () => {
    if (submitting) return;
    setStatus({ kind: "submitting" });
    try {
      const result = await addStarFn({ data: text });
      if (!mounted.current) return;
      if (result.ok) {
        onSuccess(result.star, m.chat.success);
        return;
      }
      setStatus({ kind: "error", errorKey: result.errorKey });
    } catch {
      if (!mounted.current) return;
      setStatus({ kind: "error", errorKey: "failed" });
    }
  };

  return (
    <div className="mt-3 flex w-[min(280px,62vw)] flex-col gap-3">
      <label htmlFor={fieldId} className="font-sans text-base text-text">
        {m.chat.label}
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={m.chat.placeholder}
        rows={3}
        disabled={submitting}
        aria-invalid={status.kind === "error"}
        aria-describedby={status.kind === "error" ? errorId : undefined}
        className="w-full resize-none rounded-snug border border-accent-soft bg-space-deep/60 px-3 py-2 font-sans text-base text-text leading-normal placeholder:text-dim-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60"
      />
      {status.kind === "error" && (
        <p
          id={errorId}
          role="alert"
          className="m-0 font-sans text-sm text-dim-2"
        >
          {m.chat.error[status.errorKey]}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="cursor-pointer self-end rounded-snug border border-accent bg-accent-soft px-4 py-2 font-sans text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
      >
        {submitting ? m.chat.submitting : m.chat.submit}
      </button>
    </div>
  );
};
