import { useMemo } from "react";
import { generateStars, starfieldShadow } from "#/lib/starfield";

/** Fixed seed → the same backdrop every render (SSR-stable, see starfield.ts). */
const BACKDROP_SEED = 1987;
/** Stars are scattered across this px square from the top-left of the viewport. */
const BACKDROP_SPREAD = 2000;
const BACKDROP_STARS = 220;

/**
 * The Memory Galaxy app shell: a deep-space nebula, a dim pixel-art starfield,
 * and a breathing core glow, with page content layered on top. This is the
 * decorative backdrop only — bright, clickable memory stars arrive with the
 * canvas renderer story.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const starfield = useMemo(
    () =>
      starfieldShadow(
        generateStars(BACKDROP_SEED, BACKDROP_STARS, BACKDROP_SPREAD),
      ),
    [],
  );

  return (
    <div className="galaxy">
      <div className="galaxy__core" aria-hidden="true" />
      <div
        className="galaxy__starfield"
        aria-hidden="true"
        style={{ boxShadow: starfield }}
      />
      <main className="galaxy__content">{children}</main>
    </div>
  );
}
