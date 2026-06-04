import { PixelAstronaut } from "./PixelAstronaut";

/**
 * ASTRO (#70) — the galaxy's quiet host, pinned in the reserved bottom-right slot of
 * the stage. A sibling of `<GalaxyChrome />` inside `.galaxy-stage__fit`, so it scales
 * with `--stage-scale` but ignores the camera/parallax (it stays in the corner like the
 * title). At rest it is pure decorative chrome: `aria-hidden`, `pointer-events: none`
 * (clicks pass through), gently bobbing — never a tab stop, never a control.
 *
 * Placement, the bob keyframe (~4s ease-in-out), the optional drift, the small-screen
 * hide, and the reduced-motion gate all live in `.galaxy-astro*` CSS (src/styles.css),
 * so this component is draw-only. `#70` ships the at-rest `idle` sprite only — pose
 * switching is #71, the speech bubble is #72.
 */

type Props = {
  /**
   * #72 seam — when ASTRO speaks. `undefined` (default) → silent + `aria-hidden`; the
   * sprite stays decorative. The speech bubble + its `aria-live` surface are built in
   * #72; this prop is the documented, intentional hook and is otherwise unused here.
   */
  message?: string;
};

export const Astro = ({ message }: Props) => {
  // The #72 contract is captured but not yet wired — reference it so the seam is
  // explicit and the unused prop is intentional, not dead.
  void message;

  // The sprite themes itself from the inherited `--color-accent` @theme var (published
  // per-palette on the stage), so no accent prop is threaded through here.
  return (
    <div className="galaxy-astro" aria-hidden="true">
      <div className="galaxy-astro__drift">
        <PixelAstronaut />
      </div>
    </div>
  );
};
