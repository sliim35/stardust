import { useEffect, useState } from "react";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";

/**
 * Contain-fit the fixed 1280×800 stage into the viewport (`object-fit: contain`
 * for a transformed box). Returns the scale; the stage is centered in CSS and
 * letterboxed by the surrounding deep field. SSR renders at scale 1 and settles
 * on hydration (transform-only — no layout reflow).
 */
export const useStageFit = (): number => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const recompute = () =>
      setScale(
        Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H),
      );
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  return scale;
};
