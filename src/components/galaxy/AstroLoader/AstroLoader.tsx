import { type CSSProperties, useEffect, useRef, useState } from "react";
import { PixelAstronaut } from "#/components/galaxy/PixelAstronaut";
import {
  DEFAULT_LABEL,
  DOT_DELAYS_MS,
  FADE_MS,
  LOADER_SPARKS,
  LOADER_STARS,
  type LoaderAccent,
  REDUCED_SWEEP_FILL,
} from "#/lib/galaxy/loader";
import { paletteAccentVars } from "#/lib/galaxy/palette";
import { LoaderStarfield } from "./LoaderStarfield";

/**
 * AstroLoader (#79) — the Memory Galaxy's first surface: a full-screen deep-space
 * loading screen recreated from the Claude Design handoff `astro/Loader.html`
 * (output recreated fresh per ADR-0002 §2). Deep-space backdrop + radial amber
 * glow, a seeded twinkling starfield (`LoaderStarfield`), the STARLIGHT ASTRO
 * sprite (`PixelAstronaut`) bobbing inside a slow drift in an accent halo, fixed
 * twinkling sparks, italic "thinking…" with three staggered dots, a mono sub-label,
 * and an accent sweep progress track. Full `prefers-reduced-motion` support lives in
 * the CSS (`src/styles.css` `.astro-loader*`); all timing/layout numbers live in the
 * pure, unit-tested `#/lib/galaxy/loader`.
 *
 * The host `window.AstroLoader.setLabel()/.hide()` API from the handoff is replaced
 * by React props (out of scope per the story): `label` updates the sub copy, and
 * `onReady` (driven by the caller) triggers the opacity fade-out, after which
 * `onHidden` lets the parent unmount it.
 *
 * Accent note: the loader renders pre-galaxy, where the app default `--color-accent`
 * is sea-glass green (#75 @theme). To make ASTRO's visor-glow/trim read the intended
 * **amber**, the loader root publishes the `ember` accent vars (DRY via
 * `paletteAccentVars("ember")`), so the sprite + halo + glow all track amber.
 */

type Props = {
  /** Sub-label copy (default "gathering her stars"). Updatable by the caller. */
  label?: string;
  /**
   * Caller flips this true when the app is ready; the loader fades out then calls
   * `onHidden`. Presentation-only — wire it to a route-pending / simulated trigger,
   * never to real load-progress data (story Out of scope).
   */
  ready?: boolean;
  /** Called once the fade-out completes, so the parent can unmount the loader. */
  onHidden?: () => void;
};

const Accent = ({ accent, kind }: { accent: LoaderAccent; kind: string }) => (
  <i
    className={`astro-loader__${kind}`}
    aria-hidden="true"
    style={
      {
        left: accent.left,
        top: accent.top,
        color: accent.color,
        animationDelay: `${accent.delayMs}ms`,
        ...(accent.durationMs
          ? { animationDuration: `${accent.durationMs}ms` }
          : {}),
      } as CSSProperties
    }
  />
);

export const AstroLoader = ({ label, ready = false, onHidden }: Props) => {
  const [hidden, setHidden] = useState(false);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  // Fade out once the caller signals ready, then notify the parent after the CSS
  // opacity transition so it can unmount us (the handoff `.hide()` equivalent).
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      setHidden(true);
      onHiddenRef.current?.();
    }, FADE_MS);
    return () => clearTimeout(id);
  }, [ready]);

  if (hidden) return null;

  return (
    <div
      className="astro-loader"
      aria-live="polite"
      aria-busy={!ready}
      data-ready={ready ? "" : undefined}
      // Pin the amber accent for the pre-galaxy surface (see component doc).
      style={paletteAccentVars("ember") as CSSProperties}
    >
      <LoaderStarfield />
      <div className="astro-loader__center">
        <div className="astro-loader__stage">
          <div className="astro-loader__halo" aria-hidden="true" />
          {LOADER_SPARKS.map((a) => (
            <Accent key={`spark-${a.left}-${a.top}`} accent={a} kind="spark" />
          ))}
          {LOADER_STARS.map((a) => (
            <Accent key={`star-${a.left}-${a.top}`} accent={a} kind="star" />
          ))}
          <div className="astro-loader__drift">
            <div className="astro-loader__bob">
              <PixelAstronaut scale={6} />
            </div>
          </div>
        </div>

        <div className="astro-loader__word">
          thinking
          {DOT_DELAYS_MS.map((delay) => (
            <span
              key={delay}
              className="astro-loader__dot"
              style={{ animationDelay: `${delay}ms` }}
            >
              .
            </span>
          ))}
        </div>

        <div className="astro-loader__sub">{label ?? DEFAULT_LABEL}</div>

        <div
          className="astro-loader__track"
          aria-hidden="true"
          style={
            {
              "--reduced-fill": `${REDUCED_SWEEP_FILL * 100}%`,
            } as CSSProperties
          }
        />
      </div>
    </div>
  );
};
