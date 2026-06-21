import { describe, expect, it, vi } from "vitest";
import type { ProposeMemoryDeps } from "#/lib/galaxy/add-memory";
import { commitMemory, proposeMemory } from "#/lib/galaxy/add-memory";
import { hostGalaxyFor, MOODS, placeStar } from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  FigureAnchor,
  MemoryStar,
  Mood,
  Trigger,
} from "#/lib/galaxy/types";

/** Default deps: a fixed clock + id, a mood/trigger stub. */
const deps = (over: Partial<ProposeMemoryDeps> = {}) => {
  const detectMood = vi.fn<(d: string) => Promise<Mood | null>>(
    async () => "joyful" as Mood,
  );
  const detectTrigger = vi.fn<(d: string) => Promise<Trigger | null>>(
    async () => "person" as Trigger,
  );
  return {
    detectMood,
    detectTrigger,
    now: () => 1748100000000,
    newId: () => "u-fixed",
    ...over,
  };
};

describe("proposeMemory (classify + route — NO persist, the confirm-first step)", () => {
  it("on a valid memory: classifies emotion + trigger and derives the routed star", async () => {
    const d = deps();
    const result = await proposeMemory("a quiet evening", d);

    expect(result.ok).toBe(true);
    expect(d.detectMood).toHaveBeenCalledTimes(1);
    expect(d.detectMood).toHaveBeenCalledWith("a quiet evening");
    if (result.ok) {
      expect(result.star.mood).toBe("joyful");
      expect(result.star.color).toBe(MOODS.joyful.color);
      const { r, angle } = placeStar("u-fixed", "joyful");
      expect(result.star.r).toBe(r);
      expect(result.star.angle).toBe(angle);
      expect(result.star.id).toBe("u-fixed");
      expect(result.star.createdAt).toBe(1748100000000);
      expect(result.star.text).toBe("a quiet evening");
    }
  });

  it("surfaces the host galaxy id so the UI can name the target before persist (AC2)", async () => {
    const d = deps({ detectMood: vi.fn(async (): Promise<Mood> => "wonder") });
    const result = await proposeMemory("the rings of saturn", d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostGalaxyId).toBe("andromeda");
      expect(result.hostGalaxyId).toBe(hostGalaxyFor("wonder"));
      expect(result.star.placement?.parentId).toBe("andromeda");
    }
  });

  it("captures the classified trigger onto the proposed star (AC1)", async () => {
    const d = deps({
      detectTrigger: vi.fn(async (): Promise<Trigger> => "action"),
    });
    const result = await proposeMemory("the snow-day morning", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.star.trigger).toBe("action");
  });

  it("an unclassifiable trigger is non-fatal — the star is proposed without one", async () => {
    const d = deps({ detectTrigger: vi.fn(async () => null) });
    const result = await proposeMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect("trigger" in result.star).toBe(false);
  });

  it("AI sets ONLY emotion/trigger — egg/deep are never on the proposed star", async () => {
    const d = deps();
    const result = await proposeMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("egg" in result.star).toBe(false);
      expect("deep" in result.star).toBe(false);
    }
  });

  it("MODERATION GATE: an empty submission is rejected BEFORE the AI", async () => {
    const d = deps();
    const result = await proposeMemory("   ", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
    expect(d.detectMood).not.toHaveBeenCalled();
    expect(d.detectTrigger).not.toHaveBeenCalled();
  });

  it("MODERATION GATE: a flagged submission is rejected BEFORE the AI", async () => {
    const d = deps();
    const result = await proposeMemory("free viagra here", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
    expect(d.detectMood).not.toHaveBeenCalled();
  });

  it("proposes the user's own trimmed text — never an AI-rewritten version", async () => {
    const d = deps();
    const result = await proposeMemory("  the blue door  ", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.star.text).toBe("the blue door");
  });

  it("an unclassifiable mood rejects with `unclear` (a wrong galaxy is permanent)", async () => {
    const d = deps({ detectMood: vi.fn(async () => null) });
    const result = await proposeMemory("a memory the model cannot place", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("unclear");
  });
});

describe("commitMemory (persist the confirmed proposal — server re-validates)", () => {
  /** A well-formed proposal whose derived fields match `deriveMemoryStar`. */
  const validProposal = (): MemoryStar => ({
    id: "u-1",
    text: "the blue door",
    mood: "wistful",
    color: MOODS.wistful.color,
    r: 0.5,
    angle: 1.9,
    brightness: 0.7,
    createdAt: 1748100000000,
    group: "wistful",
    trigger: "action",
    placement: { tier: "galaxy", parentId: "triangulum", r: 0.5, angle: 1.9 },
  });

  it("inserts a valid confirmed star exactly once and returns the saved row", async () => {
    const star = validProposal();
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(star, { insert });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Re-derived server-side from the re-validated emotion, not the client payload.
      expect(result.star.text).toBe("the blue door");
      expect(result.star.mood).toBe("wistful");
      expect(result.star.color).toBe(MOODS.wistful.color);
      expect(result.star.group).toBe("wistful");
      expect(result.star.placement?.parentId).toBe(hostGalaxyFor("wistful"));
      expect(result.star.trigger).toBe("action");
    }
  });

  it("SECURITY: re-runs moderation — a flagged direct commit is REJECTED, never inserted", async () => {
    const forged: MemoryStar = { ...validProposal(), text: "free viagra here" };
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(forged, { insert });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
    expect(insert).not.toHaveBeenCalled();
  });

  it("SECURITY: an empty / whitespace-only direct commit is REJECTED before insert", async () => {
    const forged: MemoryStar = { ...validProposal(), text: "   " };
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(forged, { insert });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
    expect(insert).not.toHaveBeenCalled();
  });

  it("SECURITY: a forged (out-of-enum) mood is REJECTED, never persisted as-is", async () => {
    const forged = { ...validProposal(), mood: "evil" as unknown as Mood };
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(forged, { insert });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("unclear");
    expect(insert).not.toHaveBeenCalled();
  });

  it("SECURITY: a forged placement/colour/egg is OVERWRITTEN by server re-derivation", async () => {
    // A caller forges a wrong host galaxy, a fake colour, and egg/deep flags.
    const forged = {
      ...validProposal(),
      color: "#000000",
      group: "joyful",
      egg: true,
      deep: true,
      placement: { tier: "galaxy" as const, parentId: "home", r: 9, angle: 9 },
    } as MemoryStar;
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(forged, { insert });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Re-derived from the (valid) emotion — the forged values are discarded.
      expect(result.star.color).toBe(MOODS.wistful.color);
      expect(result.star.group).toBe("wistful");
      expect(result.star.placement?.parentId).toBe(hostGalaxyFor("wistful"));
      expect("egg" in result.star).toBe(false);
      expect("deep" in result.star).toBe(false);
    }
  });

  it("SECURITY: a forged (out-of-enum) trigger is dropped — never persisted", async () => {
    const forged = {
      ...validProposal(),
      trigger: "malware" as unknown as Trigger,
    };
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(forged, { insert });
    expect(result.ok).toBe(true);
    if (result.ok) expect("trigger" in result.star).toBe(false);
  });
});

describe("commitMemory — anchor placement at write (append-only, #222)", () => {
  // A tiny fixture figure for `wistful` (the real ≥10 silhouettes are a design
  // deliverable; this exercises the write-path anchor binding only).
  const ANCHORS: readonly FigureAnchor[] = [
    { id: "n1", r: 0.2, angle: 0.5 },
    { id: "n2", r: 0.6, angle: 1.5 },
    { id: "n3", r: 0.9, angle: 2.5 },
  ];
  const FIG: ConstellationFigure = {
    group: "wistful",
    emotion: "wistful",
    hostGalaxyId: "triangulum",
    threshold: 3,
    anchors: ANCHORS,
    edges: [
      ["n1", "n2"],
      ["n2", "n3"],
    ],
  };

  const proposal = (over: Partial<MemoryStar> = {}): MemoryStar => ({
    id: "u-anchor",
    text: "the blue door",
    mood: "wistful",
    color: MOODS.wistful.color,
    r: 0.5,
    angle: 1.9,
    brightness: 0.7,
    createdAt: 1748100000000,
    group: "wistful",
    placement: { tier: "galaxy", parentId: "triangulum", r: 0.5, angle: 1.9 },
    ...over,
  });

  const member = (id: string, createdAt: number): MemoryStar => ({
    ...proposal({ id, createdAt }),
  });

  it("AC1: a figure exists for the group → the star binds to its next open anchor", async () => {
    // No prior members → the new star is the 1st → anchor n1's (r, angle).
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(proposal(), {
      insert,
      figureFor: () => FIG,
      groupMembers: async () => [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.star.r).toBe(ANCHORS[0].r);
      expect(result.star.angle).toBe(ANCHORS[0].angle);
      // `placement.{r,angle}` mirror the anchor too (single source).
      expect(result.star.placement?.r).toBe(ANCHORS[0].r);
      expect(result.star.placement?.angle).toBe(ANCHORS[0].angle);
      // The figure does NOT move the host galaxy routing.
      expect(result.star.placement?.parentId).toBe(hostGalaxyFor("wistful"));
    }
  });

  it("AC1: the Nth member binds to the Nth anchor (existing members fill 0..N-1)", async () => {
    const existing = [member("a", 1), member("b", 2)];
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    // New star (latest createdAt) is the 3rd → anchor n3.
    const result = await commitMemory(proposal({ createdAt: 3000 }), {
      insert,
      figureFor: () => FIG,
      groupMembers: async () => existing,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.star.r).toBe(ANCHORS[2].r);
      expect(result.star.angle).toBe(ANCHORS[2].angle);
    }
  });

  it("AC2: beyond completion densifies in-between (slotBeyondCompletion), never the wedge", async () => {
    const existing = [member("a", 1), member("b", 2), member("c", 3)];
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(proposal({ createdAt: 4000 }), {
      insert,
      figureFor: () => FIG,
      groupMembers: async () => existing,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // It is NOT the placeStar wedge — it sits within the silhouette envelope.
      const wedge = placeStar("u-anchor", "wistful");
      expect(result.star.r).not.toBe(wedge.r);
    }
  });

  it("AC3: NO figure for the group → the placeStar wedge fallback (unchanged behaviour)", async () => {
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(proposal(), {
      insert,
      figureFor: () => null, // CONSTELLATIONS empty in production
      groupMembers: async () => [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const wedge = placeStar("u-anchor", "wistful");
      expect(result.star.r).toBe(wedge.r);
      expect(result.star.angle).toBe(wedge.angle);
    }
  });

  it("AC3: no anchor deps at all → the placeStar wedge (the production default today)", async () => {
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(proposal(), { insert });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const wedge = placeStar("u-anchor", "wistful");
      expect(result.star.r).toBe(wedge.r);
      expect(result.star.angle).toBe(wedge.angle);
    }
  });

  it("AC2: append-only — re-deriving an earlier star yields the SAME anchor as before", async () => {
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    // `a` placed first into an empty group → anchor n1.
    const first = await commitMemory(member("a", 1), {
      insert,
      figureFor: () => FIG,
      groupMembers: async () => [],
    });
    // `b` arrives later with `a` present → anchor n2; `a` is never moved.
    const second = await commitMemory(member("b", 2), {
      insert,
      figureFor: () => FIG,
      groupMembers: async () => [member("a", 1)],
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.star.r).toBe(ANCHORS[0].r);
      expect(second.star.r).toBe(ANCHORS[1].r);
    }
  });

  it("AC4: a figure that wrongly lists a deep/cross-emotion star → placeStar wedge (never anchored)", async () => {
    // A `deep` star can reach commit only via a forged/seed path; it must NEVER
    // bind to an anchor even when a figure exists (placeOnFigure returns null →
    // the wedge stands). Note `deriveMemoryStar` drops the `deep` flag, so we
    // assert the placement is the wedge, not the anchor.
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    // A cross-emotion star whose group still points at the wistful figure: its
    // mood differs → placeOnFigure returns null → the wedge stands.
    const result = await commitMemory(
      proposal({ mood: "joyful", group: "wistful", color: MOODS.joyful.color }),
      {
        insert,
        figureFor: () => FIG,
        groupMembers: async () => [],
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Re-derived group is the (joyful) mood, so figureFor("joyful") in real code
      // would miss; here figureFor returns the wistful FIG but the emotion mismatch
      // makes placeOnFigure decline → the placeStar wedge for joyful stands.
      const wedge = placeStar("u-anchor", "joyful");
      expect(result.star.r).toBe(wedge.r);
      expect(result.star.angle).toBe(wedge.angle);
    }
  });
});
