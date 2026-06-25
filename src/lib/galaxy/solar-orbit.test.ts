import { describe, expect, it } from "vitest";
import { SOL_SYSTEM_STAR_ID, solarSystemObjects } from "#/lib/galaxy/realdata";
import {
  ORBIT_BASE_SPEED,
  ORBIT_KEPLER_EXP,
  orbitAngle,
  orbitSpeed,
  PLANET_COLORS,
  PLANET_CUES,
  ringXY,
  SOLAR_ORBIT_RX,
  SOLAR_ORBIT_TILT,
  SUN_CORONA_OPACITY_MAX,
  SUN_CORONA_OPACITY_MIN,
  SUN_CORONA_SCALE_MAX,
  SUN_CORONA_SCALE_MIN,
  SUN_PULSE_PERIOD,
  SUN_PULSE_SCALE_AMPLITUDE,
  sunCoronaOpacity,
  sunCoronaScale,
  sunPhotosphereScale,
} from "#/lib/galaxy/solar-orbit";
import type { RealObject } from "#/lib/galaxy/types";

const TAU = Math.PI * 2;

const planet = (id: string): RealObject => {
  const o = solarSystemObjects().find((x) => x.id === id);
  if (!o) throw new Error(`no planet ${id}`);
  return o;
};

// ── orbitSpeed ────────────────────────────────────────────────────────────────

describe("orbitSpeed — angular speed (rad/s) by orbital radius", () => {
  it("returns a positive speed for every planet", () => {
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet") continue;
      expect(orbitSpeed(o.placement.r)).toBeGreaterThan(0);
    }
  });

  it("inner planets are strictly faster than outer ones", () => {
    expect(orbitSpeed(planet("mercury").placement.r)).toBeGreaterThan(
      orbitSpeed(planet("venus").placement.r),
    );
    expect(orbitSpeed(planet("mars").placement.r)).toBeGreaterThan(
      orbitSpeed(planet("jupiter").placement.r),
    );
    expect(orbitSpeed(planet("earth").placement.r)).toBeGreaterThan(
      orbitSpeed(planet("neptune").placement.r),
    );
  });

  it("Mercury (innermost) is the fastest planet", () => {
    const mercurySpeed = orbitSpeed(planet("mercury").placement.r);
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet" || o.id === "mercury") continue;
      expect(mercurySpeed).toBeGreaterThan(orbitSpeed(o.placement.r));
    }
  });

  it("Neptune (outermost) is the slowest planet", () => {
    const neptuneSpeed = orbitSpeed(planet("neptune").placement.r);
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet" || o.id === "neptune") continue;
      expect(orbitSpeed(o.placement.r)).toBeGreaterThan(neptuneSpeed);
    }
  });

  it("is deterministic — same radius gives same speed", () => {
    const r = planet("earth").placement.r;
    expect(orbitSpeed(r)).toBe(orbitSpeed(r));
  });

  it("ORBIT_BASE_SPEED is a positive rad/s value (the tunable knob)", () => {
    expect(ORBIT_BASE_SPEED).toBeGreaterThan(0);
    expect(ORBIT_KEPLER_EXP).toBeGreaterThan(0);
  });
});

// ── orbitAngle ───────────────────────────────────────────────────────────────

describe("orbitAngle — current orbital angle (rad) at time t", () => {
  it("at t=0 returns the authored static placement angle", () => {
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet") continue;
      expect(orbitAngle(o, 0)).toBeCloseTo(o.placement.angle, 10);
    }
  });

  it("angle increases with time (prograde orbit)", () => {
    const earth = planet("earth");
    expect(orbitAngle(earth, 1)).toBeGreaterThan(orbitAngle(earth, 0));
    expect(orbitAngle(earth, 10)).toBeGreaterThan(orbitAngle(earth, 1));
  });

  it("wraps at TAU — result always in [0, TAU)", () => {
    const mercury = planet("mercury");
    // After many full orbits the angle must still be in range.
    const tLong = 1000;
    const angle = orbitAngle(mercury, tLong);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(TAU);
  });

  it("outer planets advance more slowly than inner ones at equal time", () => {
    const t = 10;
    const mercuryDelta =
      orbitAngle(planet("mercury"), t) - planet("mercury").placement.angle;
    const neptuneDelta =
      orbitAngle(planet("neptune"), t) - planet("neptune").placement.angle;
    // Both wrap-safe because t is small relative to one orbit.
    expect(mercuryDelta).toBeGreaterThan(neptuneDelta);
  });

  it("reduced-motion returns the static authored angle exactly", () => {
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet") continue;
      expect(orbitAngle(o, 9999, true)).toBe(o.placement.angle);
    }
  });

  it("is deterministic — same inputs yield same angle", () => {
    const earth = planet("earth");
    expect(orbitAngle(earth, 42.7)).toBe(orbitAngle(earth, 42.7));
  });

  it("a paused planet (same t repeated) holds its angle", () => {
    const mars = planet("mars");
    const t = 15;
    expect(orbitAngle(mars, t)).toBe(orbitAngle(mars, t));
  });
});

// ── ringXY ───────────────────────────────────────────────────────────────────

describe("ringXY — stage coords for a planet at angle theta", () => {
  it("places r=0 at the centre (Sol)", () => {
    const cx = 640;
    const cy = 400;
    const pos = ringXY(0, 0, cx, cy);
    expect(pos.x).toBeCloseTo(cx, 6);
    expect(pos.y).toBeCloseTo(cy, 6);
  });

  it("applies ecliptic foreshortening — y range is tilt × x range", () => {
    const cx = 640;
    const cy = 400;
    const r = 0.5;
    const right = ringXY(r, 0, cx, cy); // angle = 0 → rightmost
    const bottom = ringXY(r, Math.PI / 2, cx, cy); // angle = π/2 → bottommost (y-max)
    const xExtent = Math.abs(right.x - cx);
    const yExtent = Math.abs(bottom.y - cy);
    expect(yExtent).toBeCloseTo(xExtent * SOLAR_ORBIT_TILT, 4);
  });

  it("outer planets sit farther from Sol than inner ones at the same angle", () => {
    const cx = 640;
    const cy = 400;
    const theta = 0;
    const mercury = ringXY(planet("mercury").placement.r, theta, cx, cy);
    const neptune = ringXY(planet("neptune").placement.r, theta, cx, cy);
    const dMercury = Math.hypot(mercury.x - cx, mercury.y - cy);
    const dNeptune = Math.hypot(neptune.x - cx, neptune.y - cy);
    expect(dNeptune).toBeGreaterThan(dMercury);
  });

  it("uses SOLAR_ORBIT_RX as the px-per-unit factor", () => {
    const cx = 640;
    const cy = 400;
    const pos = ringXY(1, 0, cx, cy); // r=1, angle=0 → far right
    expect(pos.x - cx).toBeCloseTo(SOLAR_ORBIT_RX, 4);
    expect(pos.y - cy).toBeCloseTo(0, 4);
  });
});

// ── Sun pulse ─────────────────────────────────────────────────────────────────

describe("sunPhotosphereScale — disk scale over time", () => {
  it("equals 1.0 at t=0 (starts at rest)", () => {
    expect(sunPhotosphereScale(0)).toBeCloseTo(1, 10);
  });

  it("oscillates between 1 and 1+amplitude", () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      sunPhotosphereScale((i * SUN_PULSE_PERIOD) / 99),
    );
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // The scale must dip below 1 and reach near 1+amplitude.
    expect(min).toBeGreaterThanOrEqual(1 - SUN_PULSE_SCALE_AMPLITUDE - 0.001);
    expect(max).toBeLessThanOrEqual(1 + SUN_PULSE_SCALE_AMPLITUDE + 0.001);
  });

  it("is periodic — same value at t and t + period", () => {
    const t = 3.14;
    expect(sunPhotosphereScale(t)).toBeCloseTo(
      sunPhotosphereScale(t + SUN_PULSE_PERIOD),
      10,
    );
  });

  it("reduced-motion returns exactly 1.0 for any t", () => {
    expect(sunPhotosphereScale(0, true)).toBe(1);
    expect(sunPhotosphereScale(99, true)).toBe(1);
  });

  it("SUN_PULSE_PERIOD is ~7s (spec knob)", () => {
    expect(SUN_PULSE_PERIOD).toBeCloseTo(7, 5);
  });

  it("SUN_PULSE_SCALE_AMPLITUDE is ±2.2% (spec knob)", () => {
    expect(SUN_PULSE_SCALE_AMPLITUDE).toBeCloseTo(0.022, 5);
  });
});

describe("sunCoronaOpacity — corona opacity over time", () => {
  it("starts in range [MIN, MAX] at t=0", () => {
    const v = sunCoronaOpacity(0);
    expect(v).toBeGreaterThanOrEqual(SUN_CORONA_OPACITY_MIN - 0.001);
    expect(v).toBeLessThanOrEqual(SUN_CORONA_OPACITY_MAX + 0.001);
  });

  it("stays within [MIN, MAX] at all times", () => {
    for (let i = 0; i < 100; i++) {
      const v = sunCoronaOpacity((i * SUN_PULSE_PERIOD) / 99);
      expect(v).toBeGreaterThanOrEqual(SUN_CORONA_OPACITY_MIN - 0.001);
      expect(v).toBeLessThanOrEqual(SUN_CORONA_OPACITY_MAX + 0.001);
    }
  });

  it("reduced-motion returns the mid at-rest value (~0.8)", () => {
    const v = sunCoronaOpacity(0, true);
    expect(v).toBeCloseTo(0.8, 1);
  });

  it("SUN_CORONA knobs are in spec range", () => {
    expect(SUN_CORONA_OPACITY_MIN).toBeCloseTo(0.5, 5);
    expect(SUN_CORONA_OPACITY_MAX).toBeCloseTo(0.85, 5);
  });
});

describe("sunCoronaScale — corona CSS scale over time", () => {
  it("stays within [MIN, MAX] at all times", () => {
    for (let i = 0; i < 100; i++) {
      const v = sunCoronaScale((i * SUN_PULSE_PERIOD) / 99);
      expect(v).toBeGreaterThanOrEqual(SUN_CORONA_SCALE_MIN - 0.001);
      expect(v).toBeLessThanOrEqual(SUN_CORONA_SCALE_MAX + 0.001);
    }
  });

  it("reduced-motion returns 1.0 for any t", () => {
    expect(sunCoronaScale(0, true)).toBe(1);
    expect(sunCoronaScale(55, true)).toBe(1);
  });

  it("SUN_CORONA_SCALE knobs are in spec range", () => {
    expect(SUN_CORONA_SCALE_MIN).toBeCloseTo(0.95, 5);
    expect(SUN_CORONA_SCALE_MAX).toBeCloseTo(1.06, 5);
  });
});

// ── Planet cue / colour mapping ───────────────────────────────────────────────

describe("PLANET_CUES — per-planet recognizable-cue descriptor (S2 design spec)", () => {
  const PLANET_IDS = [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ] as const;

  it("covers all 8 planets — no gaps", () => {
    for (const id of PLANET_IDS) {
      expect(PLANET_CUES[id]).toBeDefined();
    }
    expect(Object.keys(PLANET_CUES).sort()).toEqual([...PLANET_IDS].sort());
  });

  it("Mercury is the bare rock — kind:'bare'", () => {
    expect(PLANET_CUES.mercury.kind).toBe("bare");
  });

  it("Venus is the haze-shroud — kind:'haze'", () => {
    expect(PLANET_CUES.venus.kind).toBe("haze");
  });

  it("Earth is the marble with a cloud swirl — kind:'marble', swirl:true", () => {
    const cue = PLANET_CUES.earth;
    expect(cue.kind).toBe("marble");
    if (cue.kind === "marble") expect(cue.swirl).toBe(true);
  });

  it("Mars has a polar cap — kind:'polarCap'", () => {
    expect(PLANET_CUES.mars.kind).toBe("polarCap");
  });

  it("Jupiter has cloud bands + the Great Red Spot — kind:'bands', hasSpot:true", () => {
    const cue = PLANET_CUES.jupiter;
    expect(cue.kind).toBe("bands");
    if (cue.kind === "bands") expect(cue.hasSpot).toBe(true);
  });

  it("Saturn has a tilted ring matching the ecliptic tilt — kind:'ring'", () => {
    const cue = PLANET_CUES.saturn;
    expect(cue.kind).toBe("ring");
    if (cue.kind === "ring") {
      expect(cue.tilt).toBeCloseTo(SOLAR_ORBIT_TILT, 5);
    }
  });

  it("Uranus is the smooth featureless ice ball — kind:'smooth'", () => {
    expect(PLANET_CUES.uranus.kind).toBe("smooth");
  });

  it("Neptune has dark storm mottling — kind:'storm'", () => {
    expect(PLANET_CUES.neptune.kind).toBe("storm");
  });
});

describe("PLANET_COLORS — signature colour per planet", () => {
  it("covers all 8 planets", () => {
    const PLANET_IDS = [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ] as const;
    for (const id of PLANET_IDS) {
      expect(PLANET_COLORS[id]).toBeDefined();
    }
  });

  it("every colour is a valid 6-digit hex", () => {
    for (const color of Object.values(PLANET_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("no planet colour equals the Sun's reserved gold (#f5d6a0)", () => {
    for (const color of Object.values(PLANET_COLORS)) {
      expect(color.toLowerCase()).not.toBe("#f5d6a0");
    }
  });

  it("matches the realdata.ts color values (colours kept in sync)", () => {
    for (const o of solarSystemObjects()) {
      if (o.kind !== "planet") continue;
      const id = o.id as keyof typeof PLANET_COLORS;
      if (PLANET_COLORS[id]) {
        expect(PLANET_COLORS[id].toLowerCase()).toBe(o.color.toLowerCase());
      }
    }
  });

  it("Sol's tier-3 star uses the gold colour (reserved, separate from PLANET_COLORS)", () => {
    const sol = solarSystemObjects().find((o) => o.id === SOL_SYSTEM_STAR_ID);
    expect(sol?.color.toLowerCase()).toBe("#f5d6a0");
  });
});
