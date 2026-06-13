import { useEffect, useState } from "react";
import { GalaxyStage } from "#/components/galaxy/GalaxyStage";
import type { DeepLinkSearch } from "#/lib/galaxy/deep-link";
import { AstroLoader } from "./AstroLoader";

/**
 * Wires `AstroLoader` (#79) as the app's **initial loading state** for the galaxy
 * home route. The loader is shown over the stage on first mount and dismissed by a
 * **simulated ready trigger** (a short timer) — presentation-only, NOT real
 * load-progress data (story Out of scope). On the no-JS / SSR pass the loader is
 * present and the stage renders behind it; the client mounts, the timer fires,
 * `ready` flips, and the loader fades out (`onHidden` unmounts it).
 *
 * Swap the timer for a router `pendingComponent` / Suspense fallback or a real
 * readiness signal when one exists — the `ready`/`onHidden` props are that seam.
 */

/** Simulated minimum display time for ASTRO's debut (presentation-only). */
const SIMULATED_READY_MS = 2500;

type GalaxyWithLoaderProps = {
  /** The arrival URL's wayfinding params (#129) — passed through to the stage. */
  deepLink?: DeepLinkSearch;
};

export const GalaxyWithLoader = ({ deepLink }: GalaxyWithLoaderProps = {}) => {
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), SIMULATED_READY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <GalaxyStage deepLink={deepLink} />
      {showLoader ? (
        <AstroLoader ready={ready} onHidden={() => setShowLoader(false)} />
      ) : null}
    </>
  );
};
