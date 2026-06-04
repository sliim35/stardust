import { getMessages, interpolate, useLocale } from "#/lib/i18n";

/**
 * Minimal stage chrome for #4: the dedication title, the breadcrumb (only
 * `MILKY WAY` is active; `SOL`/`EARTH` are dimmed reserved slots for the future
 * cinematic), and the live memory count. The astronaut, stat captions, and the
 * `+ ADD YOUR STAR` ritual button are reserved chrome owned by later stories
 * (#15 / cinematic) and are not built here.
 *
 * All user-facing copy comes from the message catalog (#103): the active locale
 * is resolved from the URL via `useLocale()` (en at `/`, ru at `/ru/`), so the
 * same component SSR-renders English or Russian chrome with no hardcoded strings.
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
      <div className="galaxy-chrome__breadcrumb" aria-hidden="true">
        <span>{m.chrome.breadcrumbMilkyWay}</span>
        <span className="is-dim">{m.chrome.breadcrumbSolEarth}</span>
      </div>
      <div className="galaxy-chrome__count">
        {interpolate(m.chrome.countLabel, { count })}
      </div>
    </div>
  );
};
