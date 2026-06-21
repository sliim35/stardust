/**
 * Layer A — the curated real-astronomy dataset (ADR-0010 §4, #146).
 *
 * The real *setting* the visitor lands in: the real Milky Way, its real Local-Group
 * neighbours, and the real labelled deep-space features inside our galaxy — each at
 * its **real light-year distance**, with curated, factual lore. This is the source
 * the renderer + store read instead of the dropped procedural `g1…g6` decoy galaxies.
 *
 * **SSR-safe (ADR-0003):** a static `as const` list — NO module-scope `Math.random()`
 * / `Date.now()` / `new Date`, no fetch, byte-stable across SSR and the client.
 *
 * **Hand-authored, close-to-real placement (ADR-0010 §4-②):** `(r, angle)` are
 * curated so the arrangement reads recognizable and is **ordered by real distance**
 * (nearer reads nearer) — NOT a survey-accurate projection. The real number rides
 * along in `realDistance` for the lore cards + the scale net. No `logScale` engine.
 * The Local-Group angles are curated to the locked FINAL composition
 * (`docs/design/proofs/2026-06-05-local-group-tier-FINAL.png`, slice I-2 #112) in
 * screen convention (+y down): M31 upper-left · M33 upper-right · LMC lower-left.
 * The LG ring projection (`lg-composition.ts`) consumes them.
 *
 * **All user-facing copy is in the i18n catalog (`loreKey`, en+ru)** — never inline
 * here (the standing all-user-text-via-i18n rule + ADR-0010 §4). `loreKey` is the
 * post-v1 ASTRO-AI swap-seam.
 *
 * **v1 scope = Local Group + Milky-Way tier ONLY.** No planets — the Solar-System
 * tier (Sol-as-sun + planets-as-solo-stars) is deferred to #127.
 */

import type { LoreKey, RealObject, Tier } from "#/lib/galaxy/types";

/** The home Milky Way — the one descendable galaxy at the Local-Group tier. */
export const HOME_MILKY_WAY_ID = "home";
/** Sol — "her home", the one descendable star inside the Milky Way. */
export const SOL_ID = "sol";
/** Andromeda (M31) — the giant anchor that optionally carries M32 / M110. */
export const ANDROMEDA_ID = "andromeda";

/**
 * The whole curated dataset. Two tiers:
 *  - `localGroup`: the home Milky Way (gateway) + the 3 real neighbours (spec §5.1),
 *    ordered by real distance (LMC < M31 < M33).
 *  - `galaxy` (parentId = home): the Milky-Way interior — Sgr A*, the Orion Arm,
 *    Sol (gateway), and the 3 named nebulae (Pillars, Crab, Orion).
 *
 * Cool palette throughout; GOLD (`#f5d6a0`) is reserved for chrome + Sol — neighbours
 * never gold-ify (ADR-0010 §4). `gateway:true` is set on ALL 4 Local-Group galaxies
 * (BR22 — every galaxy is enterable, #196) + Sol; Sol is the only tier-3 gateway.
 *
 * Authored as `as const satisfies` (per-field literal-checked against `RealObject`),
 * then exported through the **widened** `REAL_OBJECTS` below so consumers see the full
 * `RealObject` shape (optional fields like `gateway`/`parentId` present on every member,
 * not narrowed away by the tuple's per-element union).
 */
const REAL_OBJECTS_DATA = [
  // ── Local-Group tier ─────────────────────────────────────────────────────────
  {
    id: HOME_MILKY_WAY_ID,
    kind: "galaxy",
    name: "Milky Way",
    catalogue: "MW",
    tier: "localGroup",
    realDistance: { value: 100000, unit: "ly" },
    placement: { r: 0, angle: 0 },
    shape: "barred-spiral",
    size: 1,
    brightness: 1,
    color: "#9ab4e0",
    loreKey: "milkyWay",
    gateway: true,
    arms: 4,
    barAngle: 0.44, // ~25°
    tilt: 0.74,
  },
  {
    id: "lmc",
    kind: "galaxy",
    name: "Large Magellanic Cloud",
    catalogue: "LMC",
    tier: "localGroup",
    realDistance: { value: 163000, unit: "ly" },
    placement: { r: 0.22, angle: 2.62 }, // lower-left (FINAL proof)
    shape: "magellanic",
    size: 0.42,
    brightness: 0.7,
    color: "#b6c6e6",
    loreKey: "lmc",
    gateway: true, // BR22 — every Local-Group galaxy is enterable (#196)
  },
  {
    id: ANDROMEDA_ID,
    kind: "galaxy",
    name: "Andromeda",
    catalogue: "M31",
    tier: "localGroup",
    realDistance: { value: 2.5, unit: "Mly" },
    placement: { r: 0.62, angle: 3.8 }, // upper-left (FINAL proof)
    shape: "barred-spiral",
    size: 0.78,
    brightness: 0.82,
    color: "#8fb0e4",
    loreKey: "andromeda",
    gateway: true, // BR22 — every Local-Group galaxy is enterable (#196)
    arms: 2,
    barAngle: -0.55, // sky position angle — the "/" diagonal of the FINAL proof
    tilt: 0.42, // steep ~77° inclination → a thin tilted disk
    satellites: [
      {
        id: "m32",
        kind: "galaxy",
        name: "M32",
        catalogue: "M32",
        tier: "localGroup",
        parentId: ANDROMEDA_ID,
        realDistance: { value: 2.5, unit: "Mly" },
        placement: { r: 0.56, angle: 3.68 }, // flanks its host (v1.1)
        shape: "dwarf-spheroidal",
        size: 0.12,
        brightness: 0.4,
        color: "#a7bce0",
        loreKey: "m32",
      },
      {
        id: "m110",
        kind: "galaxy",
        name: "M110",
        catalogue: "M110",
        tier: "localGroup",
        parentId: ANDROMEDA_ID,
        realDistance: { value: 2.7, unit: "Mly" },
        placement: { r: 0.68, angle: 3.92 }, // flanks its host (v1.1)
        shape: "dwarf-spheroidal",
        size: 0.14,
        brightness: 0.36,
        color: "#a3b8de",
        loreKey: "m110",
      },
    ],
  },
  {
    id: "triangulum",
    kind: "galaxy",
    name: "Triangulum",
    catalogue: "M33",
    tier: "localGroup",
    realDistance: { value: 2.7, unit: "Mly" },
    placement: { r: 0.78, angle: 5.66 }, // upper-right (FINAL proof)
    // Real M33 is the textbook FLOCCULENT spiral — loose, patchy, beaded arm
    // fragments and a tiny core, no bar. Its own recipe since the owner pass
    // 2026-06-10 (it read as a MW twin under the shared grand-design generator).
    shape: "flocculent-spiral",
    size: 0.62, // legibility-curated: the proof's face-on pinwheel reads large
    brightness: 0.62,
    color: "#93b6dd",
    loreKey: "triangulum",
    gateway: true, // BR22 — every Local-Group galaxy is enterable (#196)
    arms: 5, // many short arm fragments, not the MW's 4 grand sweeps
    barAngle: 0,
    tilt: 0.9,
  },
  // ── Milky-Way interior tier (parentId = home) ────────────────────────────────
  {
    id: "sgra",
    kind: "marker",
    name: "Sgr A*",
    catalogue: "Sgr A*",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 26000, unit: "ly" },
    placement: { r: 0, angle: 0 },
    shape: "marker",
    size: 0.2,
    brightness: 0.9,
    color: "#c9d6f2",
    loreKey: "sgrA",
  },
  {
    id: "orionArm",
    kind: "armLabel",
    name: "Orion Arm",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 27000, unit: "ly" },
    placement: { r: 0.46, angle: 0.62 },
    shape: "marker",
    size: 0.5,
    brightness: 0.4,
    color: "#8ea6cc",
    loreKey: "orionArm",
  },
  {
    id: SOL_ID,
    kind: "star",
    name: "Sol",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 26000, unit: "ly" },
    placement: { r: 0.5, angle: 0.42 },
    shape: "star",
    size: 0.34,
    brightness: 1,
    color: "#f5d6a0", // GOLD — reserved for Sol + chrome only
    loreKey: "sol",
    gateway: true,
  },
  {
    id: "pillars",
    kind: "nebula",
    name: "Pillars of Creation",
    catalogue: "M16",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 7000, unit: "ly" },
    placement: { r: 0.72, angle: 1.62 },
    shape: "nebula",
    size: 0.3,
    brightness: 0.6,
    color: "#9cc6c0",
    loreKey: "pillars",
  },
  {
    id: "crab",
    kind: "nebula",
    name: "Crab Nebula",
    catalogue: "M1",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 6500, unit: "ly" },
    placement: { r: 0.66, angle: 2.84 },
    shape: "nebula",
    size: 0.26,
    brightness: 0.58,
    color: "#b0a6dc",
    loreKey: "crab",
  },
  {
    id: "orion",
    kind: "nebula",
    name: "Orion Nebula",
    catalogue: "M42",
    tier: "galaxy",
    parentId: HOME_MILKY_WAY_ID,
    realDistance: { value: 1344, unit: "ly" },
    placement: { r: 0.58, angle: 5.4 },
    shape: "nebula",
    size: 0.28,
    brightness: 0.64,
    color: "#9ec0e2",
    loreKey: "orion",
  },
] as const satisfies readonly RealObject[];

/**
 * The curated dataset, widened to `readonly RealObject[]`. Same identity every read
 * (it IS the authored `as const` array — SSR-stable), but typed so `.find`/index
 * access yields the full `RealObject` (optional fields visible), not a narrow member.
 */
export const REAL_OBJECTS: readonly RealObject[] = REAL_OBJECTS_DATA;

/**
 * A galaxy's nav id → its i18n `loreKey` (BR22-frame #198). The nav state carries the
 * real-object *id* (`home`/`andromeda`/…); per-galaxy lore + breadcrumb key by `loreKey`
 * — they diverge only for the home MW (`home` → `milkyWay`). Falls back to the home MW
 * key for `null` (the LG overview) or an unknown id, mirroring `skyFor`'s home-fallback.
 */
export const loreKeyForGalaxy = (galaxyId: string | null): LoreKey =>
  REAL_OBJECTS.find((o) => o.id === galaxyId)?.loreKey ?? "milkyWay";

/**
 * The 4 placed Local-Group neighbours (spec §5.1) — every `localGroup`-tier galaxy
 * except the home Milky Way. Satellites (M32 / M110) ride on Andromeda, not here.
 */
export const localGroupNeighbours = (): readonly RealObject[] =>
  REAL_OBJECTS.filter(
    (o) => o.tier === "localGroup" && o.id !== HOME_MILKY_WAY_ID,
  );

/**
 * Select the top-level real objects for one `(tier, parentId)` view — what wave-2
 * rendering consumes (ADR-0010 §4). Satellites are nested on their host, so they
 * never appear as their own view object. A `localGroup`-tier query takes no parent.
 */
export const realObjectsForView = (
  tier: Tier,
  parentId?: string,
): readonly RealObject[] =>
  REAL_OBJECTS.filter((o) => o.tier === tier && o.parentId === parentId);
