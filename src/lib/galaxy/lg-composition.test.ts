import { describe, expect, it } from "vitest";
import {
  MW_PLACEMENT,
  placedExtent,
  placedSupport,
} from "#/lib/galaxy/backdrop";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import {
  LG_FRAMING,
  LG_GOLD,
  LG_MW_PLACEMENT,
  lgGalaxies,
  lgGoldAccents,
  lgHitTargets,
  lgLabels,
  lgPlacementFor,
} from "#/lib/galaxy/lg-composition";
import { GALAXY_CENTER, GALAXY_R, STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  REAL_OBJECTS,
  SOL_ID,
} from "#/lib/galaxy/realdata";
import type { RealObject } from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";

const byId = (id: string): RealObject => {
  const o = REAL_OBJECTS.find((x) => x.id === id);
  if (!o) throw new Error(`no real object ${id}`);
  return o;
};

const dist = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  Math.hypot(a.cx - b.cx, a.cy - b.cy);

/** Every placed disk of the LG scene — the shrunk MW + the 4 spread neighbours. */
const allPlaced = () => [
  LG_MW_PLACEMENT,
  ...lgGalaxies().map(({ place }) => place),
];

describe("LG_FRAMING — the Local-Group resting camera (I-2, FINAL proof)", () => {
  it("zooms out below the galaxy-tier identity, so the descend dives IN", () => {
    expect(LG_FRAMING.zoom).toBeLessThan(DEFAULT_FRAMING.zoom);
    expect(LG_FRAMING.zoom).toBeGreaterThan(0);
  });

  it("frames the MW near the screen centre, slightly low (owner relayout 2026-06-10)", () => {
    // Screen position of a world point W under {cx, cy, zoom}:
    // S = stage-centre + zoom · (W − camera-centre)  (cameraTransform math).
    const sx =
      GALAXY_CENTER.x + LG_FRAMING.zoom * (LG_MW_PLACEMENT.cx - LG_FRAMING.cx);
    const sy =
      GALAXY_CENTER.y + LG_FRAMING.zoom * (LG_MW_PLACEMENT.cy - LG_FRAMING.cy);
    // Owner relayout: the composition rose from the FINAL proof's ~70px-low
    // anchor — roughly centred, a touch low so the top chrome breathes.
    expect(sx).toBeGreaterThan(600);
    expect(sx).toBeLessThan(680);
    expect(sy).toBeGreaterThan(395);
    expect(sy).toBeLessThan(440);
  });
});

describe("LG_MW_PLACEMENT — the home disk shrunk among its neighbours", () => {
  it("keeps the MW's world centre invariant across tiers — the descend lands ON it", () => {
    expect(LG_MW_PLACEMENT.cx).toBe(GALAXY_CENTER.x);
    expect(LG_MW_PLACEMENT.cy).toBe(GALAXY_CENTER.y);
  });

  it("shrinks the disk but keeps it the largest object in the scene", () => {
    expect(LG_MW_PLACEMENT.r).toBeLessThan(GALAXY_R);
    expect(LG_MW_PLACEMENT.r).toBeGreaterThan(GALAXY_R / 2);
    for (const { place } of lgGalaxies()) {
      expect(place.r).toBeLessThan(LG_MW_PLACEMENT.r);
    }
  });

  it("keeps the home orientation (same galaxy, same tilt + position angle)", () => {
    expect(LG_MW_PLACEMENT.tilt).toBe(MW_PLACEMENT.tilt);
    expect(LG_MW_PLACEMENT.pa).toBe(MW_PLACEMENT.pa);
  });
});

describe("lgPlacementFor — authored placement → spread LG stage coords", () => {
  it("places all 4 neighbours, deterministically", () => {
    expect(lgGalaxies()).toHaveLength(4);
    expect(lgGalaxies()).toEqual(lgGalaxies());
  });

  it("spreads every neighbour's centre clear OUT of the MW disk (the #167 pile-up fix)", () => {
    for (const { object, place } of lgGalaxies()) {
      expect(
        dist(place, LG_MW_PLACEMENT),
        `${object.id} centre sits inside the MW disk`,
      ).toBeGreaterThan(LG_MW_PLACEMENT.r);
    }
  });

  it("lands each neighbour in its FINAL-proof quadrant around the MW", () => {
    const quadrant = (id: string) => {
      const { place } = lgGalaxies().find((p) => p.object.id === id) ?? {};
      if (!place) throw new Error(`no placed ${id}`);
      return {
        left: place.cx < GALAXY_CENTER.x,
        up: place.cy < GALAXY_CENTER.y,
      };
    };
    expect(quadrant("andromeda")).toEqual({ left: true, up: true });
    expect(quadrant("triangulum")).toEqual({ left: false, up: true });
    expect(quadrant("lmc")).toEqual({ left: true, up: false });
    expect(quadrant("smc")).toEqual({ left: false, up: false });
  });

  it("keeps every pair of galaxies separated (no centre inside another disk, cores disjoint)", () => {
    const placed = allPlaced();
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = dist(placed[i], placed[j]);
        // No galaxy's centre may sit inside another's disk (the owner's complaint)…
        expect(d).toBeGreaterThan(Math.max(placed[i].r, placed[j].r));
        // …and the dense cores must read as clearly distinct objects.
        expect(d).toBeGreaterThan(0.6 * (placed[i].r + placed[j].r));
      }
    }
  });

  // The owner's sparseness floor (#167 follow-up, 2026-06-06): "clear breathing
  // room between every pair" — pinned, not vibes. Measured along the
  // centre-to-centre line: the gap between the two silhouettes' directional
  // reaches (`placedSupport`, the exact ellipse bound the axis-aligned
  // `placedExtent` boxes) must clear the floor for EVERY pair, the MW included.
  const MIN_PAIR_GAP = 60;

  it(`keeps ≥ ${MIN_PAIR_GAP}px of clear space between every pair of placed silhouettes`, () => {
    const placed = allPlaced();
    const ids = [HOME_MILKY_WAY_ID, ...lgGalaxies().map((p) => p.object.id)];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = dist(placed[i], placed[j]);
        const ux = (placed[j].cx - placed[i].cx) / d;
        const uy = (placed[j].cy - placed[i].cy) / d;
        const gap =
          d -
          placedSupport(placed[i], ux, uy) -
          placedSupport(placed[j], ux, uy);
        expect(gap, `${ids[i]} ↔ ${ids[j]} gap`).toBeGreaterThanOrEqual(
          MIN_PAIR_GAP,
        );
      }
    }
  });

  it("fits every disk inside the stage canvas (no clamped point pile-ups)", () => {
    for (const place of allPlaced()) {
      const extent = placedExtent(place);
      expect(place.cx - extent.x).toBeGreaterThanOrEqual(0);
      expect(place.cx + extent.x).toBeLessThanOrEqual(STAGE_W);
      expect(place.cy - extent.y).toBeGreaterThanOrEqual(0);
      expect(place.cy + extent.y).toBeLessThanOrEqual(STAGE_H);
    }
  });

  it("scales by distance — far (Mly) galaxies shrink more than the near satellites", () => {
    const relative = (o: RealObject) =>
      lgPlacementFor(o).r / (GALAXY_R * o.size);
    const far = ["andromeda", "triangulum"].map((id) => relative(byId(id)));
    const near = ["lmc", "smc"].map((id) => relative(byId(id)));
    for (const f of far) for (const n of near) expect(f).toBeLessThan(n);
  });

  it("keeps each neighbour's own orientation (tilt / position angle ride along)", () => {
    const m31 = byId("andromeda");
    const place = lgPlacementFor(m31);
    expect(place.tilt).toBe(m31.tilt);
    expect(place.pa).toBe(m31.barAngle);
  });
});

describe("lgGoldAccents — Sol's amber mark + the globular-cluster sprinkles", () => {
  it("is deterministic and SSR-safe (same points every call)", () => {
    expect(lgGoldAccents()).toEqual(lgGoldAccents());
  });

  it("uses the reserved Sol gold — never a palette colour", () => {
    expect(LG_GOLD).toBe(byId(SOL_ID).color);
  });

  it("scatters every accent around the MW halo, on-stage, on whole pixels", () => {
    for (const p of lgGoldAccents()) {
      const d = Math.hypot(p.x - LG_MW_PLACEMENT.cx, p.y - LG_MW_PLACEMENT.cy);
      expect(d).toBeLessThanOrEqual(LG_MW_PLACEMENT.r * 1.3);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(STAGE_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(STAGE_H);
      expect(Number.isInteger(p.x)).toBe(true);
      expect(Number.isInteger(p.y)).toBe(true);
    }
  });

  it("puts the sun's mark ON the MW disk (inside the disk footprint)", () => {
    const [sol] = lgGoldAccents();
    const d = Math.hypot(
      sol.x - LG_MW_PLACEMENT.cx,
      sol.y - LG_MW_PLACEMENT.cy,
    );
    expect(d).toBeLessThan(LG_MW_PLACEMENT.r);
    expect(sol.alpha).toBeGreaterThan(0.8); // the one bright amber mark
  });
});

describe("lgHitTargets — hover/focus hit-targets over the placed silhouettes (#167)", () => {
  /** Placement per labelled galaxy — the same map the label tests build. */
  const placedById = () => {
    const placed = new Map(
      lgGalaxies().map(({ object, place }) => [object.id, place]),
    );
    placed.set(HOME_MILKY_WAY_ID, LG_MW_PLACEMENT);
    return placed;
  };

  it("covers the MW and all 4 neighbours — one target per labelled galaxy", () => {
    const targetIds = lgHitTargets()
      .map((t) => t.id)
      .sort();
    expect(targetIds).toEqual(
      lgLabels()
        .map((l) => l.id)
        .sort(),
    );
  });

  it("centres each target on its placement and sizes it to the silhouette reach (placedExtent)", () => {
    const placed = placedById();
    for (const t of lgHitTargets()) {
      const place = placed.get(t.id);
      if (!place) throw new Error(`no placement for ${t.id}`);
      // Derived through the composition module — constants changes flow here.
      expect(t.x).toBe(place.cx);
      expect(t.y).toBe(place.cy);
      expect(t.halfW).toBe(placedExtent(place).x);
      expect(t.halfH).toBe(placedExtent(place).y);
    }
  });

  it("carries the existing lore catalog key — the aria-label resolves en AND ru", () => {
    for (const t of lgHitTargets()) {
      expect(en.lore[t.loreKey].name.length).toBeGreaterThan(0);
      expect(en.lore[t.loreKey].sublabel.length).toBeGreaterThan(0);
      expect(ru.lore[t.loreKey].name.length).toBeGreaterThan(0);
      expect(ru.lore[t.loreKey].sublabel.length).toBeGreaterThan(0);
    }
  });
});

describe("lgLabels — serif name + mono distance anchors (FINAL proof)", () => {
  it("labels the MW and all 4 neighbours from the existing lore catalog (en+ru)", () => {
    const labels = lgLabels();
    expect(labels).toHaveLength(1 + localGroupNeighbours().length);
    expect(labels.map((l) => l.id)).toContain(HOME_MILKY_WAY_ID);
    for (const l of labels) {
      expect(en.lore[l.loreKey].name.length).toBeGreaterThan(0);
      expect(en.lore[l.loreKey].sublabel.length).toBeGreaterThan(0);
      expect(ru.lore[l.loreKey].name.length).toBeGreaterThan(0);
      expect(ru.lore[l.loreKey].sublabel.length).toBeGreaterThan(0);
    }
  });

  it("anchors each label on its galaxy's column, clear of the disk's seen mass", () => {
    const placedBy = new Map(
      lgGalaxies().map(({ object, place }) => [object.id, place]),
    );
    placedBy.set(HOME_MILKY_WAY_ID, LG_MW_PLACEMENT);
    for (const l of lgLabels()) {
      const place = placedBy.get(l.id);
      if (!place) throw new Error(`no placement for ${l.id}`);
      expect(l.x).toBe(place.cx);
      // Clumpy clouds anchor to their *visual* edge (inside the geometric r),
      // so the clearance contract is the half-extent, not the full bound.
      const clearance = placedExtent(place).y * 0.5;
      if (l.side === "above") expect(l.y).toBeLessThan(place.cy - clearance);
      else expect(l.y).toBeGreaterThan(place.cy + clearance);
    }
  });

  it("keeps every label anchor on the stage", () => {
    for (const l of lgLabels()) {
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x).toBeLessThanOrEqual(STAGE_W);
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeLessThanOrEqual(STAGE_H);
    }
  });

  it("anchors M33's label at FULL extent + gap — flocculent is rim-reaching, not clumpy (#177 review)", () => {
    // The flocculent knot ladder runs to ~0.93·r + spread: its seen mass fills
    // the disk like a spiral. The old spiral-or-not boolean dropped the new
    // shape into the 0.72 clumpy factor and collapsed the LG_LABEL_GAP
    // breathing room into the outer beads — pin the full-extent contract.
    const m33 = lgLabels().find((l) => l.id === "triangulum");
    if (!m33) throw new Error("no triangulum label");
    const place = lgGalaxies().find(
      ({ object }) => object.id === "triangulum",
    )?.place;
    if (!place) throw new Error("no triangulum placement");
    expect(m33.side).toBe("above");
    // gap = full projected half-extent + the authored 26px breathing room.
    expect(place.cy - m33.y).toBeGreaterThanOrEqual(placedExtent(place).y + 26);
  });
});
