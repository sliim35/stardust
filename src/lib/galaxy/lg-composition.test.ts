import { describe, expect, it } from "vitest";
import { MW_PLACEMENT, placedExtent } from "#/lib/galaxy/backdrop";
import { DEFAULT_FRAMING } from "#/lib/galaxy/focus";
import {
  LG_FRAMING,
  LG_GOLD,
  LG_MW_PLACEMENT,
  lgGalaxies,
  lgGoldAccents,
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

  it("frames the MW slightly below the screen centre (the proof's anchor)", () => {
    // Screen position of a world point W under {cx, cy, zoom}:
    // S = stage-centre + zoom · (W − camera-centre)  (cameraTransform math).
    const sx =
      GALAXY_CENTER.x + LG_FRAMING.zoom * (LG_MW_PLACEMENT.cx - LG_FRAMING.cx);
    const sy =
      GALAXY_CENTER.y + LG_FRAMING.zoom * (LG_MW_PLACEMENT.cy - LG_FRAMING.cy);
    // FINAL proof: the MW reads roughly centred horizontally, ~70px low.
    expect(sx).toBeGreaterThan(600);
    expect(sx).toBeLessThan(680);
    expect(sy).toBeGreaterThan(430);
    expect(sy).toBeLessThan(510);
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
});
