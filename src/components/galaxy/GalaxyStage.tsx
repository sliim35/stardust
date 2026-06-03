import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createInMemoryStore } from "#/lib/galaxy/store";
import { DeepStarfield } from "./DeepStarfield";
import { GalaxyBackdrop } from "./GalaxyBackdrop";
import { GalaxyChrome } from "./GalaxyChrome";
import { MemoryStarLayer } from "./MemoryStarLayer";
import { useGalaxyCamera } from "./useGalaxyCamera";
import { useStageFit } from "./useStageFit";

/** How long the `memIgnite` fade-in runs before a new star settles to twinkle. */
const IGNITE_MS = 1600;

/**
 * The top-level galaxy scene (#4): composes L1 (deep starfield) · L2 (the disk)
 * · L3 (memory stars) under an eased camera + parallax, contain-fit to the
 * viewport. Reads a `GalaxySky` from the in-memory store seam (#2) and ignites
 * any star added through it without moving the rest (AC3). Live producers
 * (Telegram ingestion) arrive in epic #8; here the seam is local.
 *
 * SSR-safe: the disk/deep-field canvases draw client-side, while the DOM memory
 * layer + chrome render server-side over the seeded CSS starfield placeholder
 * (ADR-0003).
 */
export const GalaxyStage = () => {
  const [store] = useState(() => createInMemoryStore());
  const [sky, setSky] = useState(() => store.getSky());
  const [ignitingIds, setIgnitingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const skyRef = useRef(sky);
  skyRef.current = sky;

  useEffect(() => {
    return store.subscribe?.((next) => {
      const known = new Set(skyRef.current.stars.map((s) => s.id));
      const fresh = next.stars.filter((s) => !known.has(s.id)).map((s) => s.id);
      setSky(next);
      if (fresh.length === 0) return;
      setIgnitingIds((cur) => new Set([...cur, ...fresh]));
      for (const id of fresh) {
        setTimeout(() => {
          setIgnitingIds((cur) => {
            const n = new Set(cur);
            n.delete(id);
            return n;
          });
        }, IGNITE_MS);
      }
    });
  }, [store]);

  const scale = useStageFit();
  const cam = useGalaxyCamera();

  return (
    <div
      className="galaxy-stage"
      onPointerMove={cam.onPointerMove}
      onPointerLeave={cam.onPointerLeave}
    >
      <div className="galaxy-l1-wrap" ref={cam.l1} aria-hidden="true">
        <DeepStarfield />
      </div>
      <div
        className="galaxy-stage__fit"
        style={{ "--stage-scale": scale } as CSSProperties}
      >
        <div className="galaxy-stage__camera" ref={cam.cam}>
          <div className="galaxy-l2-wrap" ref={cam.l2}>
            <GalaxyBackdrop backdrop={sky.backdrop} />
          </div>
          <div className="galaxy-l3-wrap" ref={cam.l3}>
            <MemoryStarLayer stars={sky.stars} ignitingIds={ignitingIds} />
          </div>
        </div>
        <GalaxyChrome count={sky.stars.length} />
      </div>
    </div>
  );
};
