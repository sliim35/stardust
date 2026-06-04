/**
 * Minimal stage chrome for #4: the dedication title, the breadcrumb (only
 * `MILKY WAY` is active; `SOL`/`EARTH` are dimmed reserved slots for the future
 * cinematic), and the live memory count. The astronaut, stat captions, and the
 * `+ ADD YOUR STAR` ritual button are reserved chrome owned by later stories
 * (#15 / cinematic) and are not built here.
 */

export const GalaxyChrome = ({ count }: { count: number }) => (
  <div className="galaxy-chrome">
    <h1 className="galaxy-chrome__title">
      <span className="galaxy-chrome__for">For Mom</span>
      <span className="galaxy-chrome__sub">A QUIET PLACE IN THE MILKY WAY</span>
      <span className="sr-only">
        Memory Galaxy — a sky of stars, each one a memory.
      </span>
    </h1>
    <div className="galaxy-chrome__breadcrumb" aria-hidden="true">
      <span>MILKY WAY</span>
      <span className="is-dim"> › SOL › EARTH</span>
    </div>
    <div className="galaxy-chrome__count">{count} memories, still growing</div>
  </div>
);
