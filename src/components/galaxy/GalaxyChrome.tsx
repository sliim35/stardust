import { getMessages, interpolate, useLocale } from "#/lib/i18n";

/**
 * Minimal stage chrome (#4): the dedication title, the tier breadcrumb, and the
 * live memory count. Per the owner's HD-2D critique:
 *
 * - **Title** — "for mom" is the memory voice: lower-case serif italic (casing in
 *   the catalog, style in `.galaxy-chrome__for`). The system never uses title-case.
 * - **Breadcrumb** — `LOCAL GROUP › MILKY WAY › SOL` (ADR-0010: there is **no Earth
 *   tier**). MILKY WAY is the current tier → bright; LOCAL GROUP (ancestor) and SOL
 *   (descendant) are dim. The ` › ` separators are rendered here, not in the catalog.
 * - **Count** — the live count sits in the **bottom-left caption slot** (not orphaned
 *   dead-centre): bottom-left = caption, bottom-right = astronaut + scale.
 *
 * All user-facing copy comes from the message catalog (#103): the active locale is
 * resolved from the URL via `useLocale()` (en at `/`, ru at `/ru/`), so the same
 * component SSR-renders English or Russian chrome with no hardcoded strings.
 */
export const GalaxyChrome = ({ count }: { count: number }) => {
  const m = getMessages(useLocale());
  return (
    <div className="galaxy-chrome">
      <h1 className="galaxy-chrome__title">
        <span className="galaxy-chrome__for">{m.chrome.forMom}</span>
        <span className="galaxy-chrome__sub">{m.chrome.subtitle}</span>
        <span className="sr-only">{m.chrome.srOnly}</span>
      </h1>
      <nav className="galaxy-chrome__breadcrumb" aria-hidden="true">
        <span className="is-dim">{m.chrome.breadcrumbLocalGroup}</span>
        <span className="galaxy-chrome__sep">›</span>
        <span>{m.chrome.breadcrumbMilkyWay}</span>
        <span className="galaxy-chrome__sep">›</span>
        <span className="is-dim">{m.chrome.breadcrumbSol}</span>
      </nav>
      <div className="galaxy-chrome__count">
        {interpolate(m.chrome.countLabel, { count })}
      </div>
    </div>
  );
};
