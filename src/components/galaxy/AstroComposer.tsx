import { useEffect, useId, useRef, useState } from "react";
import type { AddMemoryErrorKey } from "#/lib/galaxy/add-memory";
import type { MemoryStar } from "#/lib/galaxy/types";
import { getMessages, interpolate, useLocale } from "#/lib/i18n";
import type { Messages } from "#/lib/i18n/types";
import { commitStarFn, proposeStarFn } from "#/server/add-star";

/**
 * The "add your star" form, rendered INSIDE ASTRO's speech bubble (#183 redesign,
 * dir. A). ASTRO invites the memory and the form lives in the *same* glass surface —
 * one voice, no second panel competing for the bottom-right corner.
 *
 * **Confirm-first (#219, BR-add-star).** The submit is now two steps: `proposeStarFn`
 * classifies the emotion (the now-12-way model) + trigger and routes the star to its
 * host galaxy WITHOUT persisting, then the user sees WHERE it will go (the emotion +
 * target galaxy) and confirms before `commitStarFn` writes it — the owner's safety net
 * for shipping a 12-way classifier on llama-8b, where a misroute is permanent. "Back"
 * returns to the textarea with the typed text intact so a misclassification isn't lost.
 *
 * Chrome is Tailwind utilities reading the `@theme` tokens (#75 boundary); every
 * string comes from the typed catalog (#103). SSR-safe: no module-scope clock/random;
 * the only async is the click-driven propose/commit. A `mounted` ref guards the
 * post-await path so an unmount mid-flight can't fire `onSuccess` on a gone parent.
 *
 * Cross-galaxy fly-to on confirm (ADR-0014 open Q4) is the nav track's surface (#198
 * owns the transition layer). When that fly API lands, the confirm path is the seam to
 * call it with the proposal's `placement.parentId`; until then we persist + ignite in
 * place. TODO(#198): on confirm, fly the camera to `proposed.placement.parentId`.
 */
type Props = {
  /** A saved star: ignite it (parent) + the line ASTRO should speak next. */
  onSuccess: (star: MemoryStar, confirmation: string) => void;
  /**
   * Exit the composer without saving (the write-view "Cancel"). The bubble's old ▾
   * dismiss was removed (owner 2026-06-25 — it read as non-functional), so the form
   * carries its own explicit exit; `Astro` wires this to `setComposing(false)`.
   */
  onCancel: () => void;
};

// The single seam between partition ids (`hostGalaxyFor`) and the `lore.*` catalog
// keys for their names (no inline galaxy names — ADR-0007); unknown → Milky Way.
const GALAXY_LORE_KEY = {
  home: "milkyWay",
  andromeda: "andromeda",
  triangulum: "triangulum",
  lmc: "lmc",
} as const satisfies Record<string, keyof Messages["lore"]>;

const galaxyName = (m: Messages, hostGalaxyId: string): string =>
  m.lore[
    GALAXY_LORE_KEY[hostGalaxyId as keyof typeof GALAXY_LORE_KEY] ?? "milkyWay"
  ].name;

type Status =
  | { kind: "write" }
  | { kind: "submitting" }
  | { kind: "confirm"; star: MemoryStar; hostGalaxyId: string }
  | { kind: "error"; errorKey: AddMemoryErrorKey };

// The composer's two button recipes (filled primary / ghost secondary) — each used by
// BOTH the write step and the confirm step. Hoisted to a const (the repo's pattern for a
// repeated className, cf. GalaxyStage `dimClass`) rather than a <Button> component;
// clsx/cva are unused in src. The `disabled:*` utilities are inert on the confirm-step
// buttons (no `disabled` prop), so all four buttons share these verbatim.
const PRIMARY_BTN =
  "cursor-pointer rounded-snug border border-accent bg-accent-soft px-4 py-2 font-sans text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none";
const SECONDARY_BTN =
  "cursor-pointer rounded-snug border border-accent-soft bg-transparent px-3 py-2 font-sans text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none";

export const AstroComposer = ({ onSuccess, onCancel }: Props) => {
  const m = getMessages(useLocale());
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "write" });
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

  // Step 1 — classify + route, no persist. Surfaces the proposal for confirmation.
  const onSubmit = async () => {
    if (submitting) return;
    setStatus({ kind: "submitting" });
    try {
      const result = await proposeStarFn({ data: text });
      if (!mounted.current) return;
      if (result.ok) {
        setStatus({
          kind: "confirm",
          star: result.star,
          hostGalaxyId: result.hostGalaxyId,
        });
        return;
      }
      setStatus({ kind: "error", errorKey: result.errorKey });
    } catch {
      if (!mounted.current) return;
      setStatus({ kind: "error", errorKey: "failed" });
    }
  };

  // Step 2 — persist the confirmed proposal, then ignite it in the live sky.
  const onConfirm = async (star: MemoryStar) => {
    if (submitting) return;
    setStatus({ kind: "submitting" });
    try {
      const result = await commitStarFn({ data: star });
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

  // "Back" from confirm: return to the textarea with the typed text intact.
  const onBack = () => setStatus({ kind: "write" });

  if (status.kind === "confirm") {
    const prompt = interpolate(m.chat.confirm.prompt, {
      emotion: m.moods[status.star.mood],
      galaxy: galaxyName(m, status.hostGalaxyId),
    });
    return (
      <div className="mt-3 flex w-full flex-col gap-3">
        <p className="m-0 font-sans text-base text-text leading-normal">
          {prompt}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onBack} className={SECONDARY_BTN}>
            {m.chat.confirm.back}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(status.star)}
            className={PRIMARY_BTN}
          >
            {m.chat.confirm.confirm}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex w-full flex-col gap-3">
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
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={SECONDARY_BTN}
        >
          {m.chat.cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={PRIMARY_BTN}
        >
          {submitting ? m.chat.submitting : m.chat.submit}
        </button>
      </div>
    </div>
  );
};
