import { useEffect, useState } from "react";

/**
 * `true` when the visitor asked the OS to reduce motion (`prefers-reduced-motion:
 * reduce`). Read in an effect — never at module/render scope — so SSR and the first
 * client render agree (`false`, the animated default) and the client snaps to instant
 * if reduced, with no hydration mismatch (the camera/backdrop/ASTRO convention).
 *
 * Subscribes to the query so a runtime OS toggle is honoured live.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
};
