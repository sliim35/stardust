import { type CSSProperties, useEffect, useRef, useState } from "react";
import { PixelAstronaut } from "#/components/galaxy/PixelAstronaut";
import { DEFAULT_MOOD } from "#/lib/galaxy/astro";
import {
  DEFAULT_LABEL,
  DOT_DELAYS_MS,
  FADE_MS,
  LOADER_SPARKS,
  LOADER_STARS,
  type LoaderAccent,
  REDUCED_SWEEP_FILL,
} from "#/lib/galaxy/loader";
import {
  DEFAULT_PALETTE,
  paletteAccentVars,
  readPersistedPalette,
} from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";
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
 * Accent note: the loader must show the **exact same sky as the galaxy** — same
 * persisted source AND same default as `usePalette`/`GalaxyStage` (the shared,
 * unit-tested `readPersistedPalette`/`DEFAULT_PALETTE` lib seam). It publishes that
 * palette's accent vars onto its root (DRY via `paletteAccentVars`), so the sprite's
 * eyes/trim + halo + glow + the "thinking…" accent all track the chosen sky — pick a
 * cool palette and reload and the loader is that sky, not a hardcoded amber.
 *
 * The palette is resolved exactly like the galaxy hook: render the `DEFAULT_PALETTE`
 * (so SSR and the client's hydration paint agree — no mismatch), then read the saved
 * pick in a post-hydration `useEffect` and commit it to state. The earlier
 * initializer-only read froze the SSR `ember` value in the DOM (hydration never
 * reconciles a style set only in a `useState` initializer when no setter fires), so
 * the cool palette was read but never applied — that was the amber bug. The accent
 * settles to the chosen sky within the loader's hold; the starfield is client-only.
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
  // Resolve the sky exactly like `usePalette`/`GalaxyStage`: start at the
  // `DEFAULT_PALETTE` (matches the SSR markup so hydration agrees — no mismatch),
  // then read the persisted pick post-hydration and commit it. Committing via a
  // setter (not just a `useState` initializer) is what actually re-tints the DOM
  // on the client — the loader then matches the galaxy on any selected palette.
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  useEffect(() => {
    setPalette(readPersistedPalette());
  }, []);
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
      // Publish the selected/persisted sky's accent for the pre-galaxy surface
      // (see component doc) so the sprite + halo + glow + starfield all track it.
      style={paletteAccentVars(palette) as CSSProperties}
    >
      <LoaderStarfield palette={palette} />
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
              {/* Render the galaxy's resting frame (`DEFAULT_MOOD` = calm) — the
                  clean-navy visor + accent eye-dots, identical to the galaxy
                  mascot at rest (modulo the loader's own scale 6), NOT the old
                  #70 amber `V` pilot-light idle frame. */}
              <PixelAstronaut mood={DEFAULT_MOOD} scale={6} />
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
