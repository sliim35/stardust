/**
 * Prefill the D1 `memory_stars` table with a curated demo set (owner 2026-06-22).
 *
 * The seed sky is now Mom-only (`buildSeedSky`) — every other star is a real memory in
 * D1. This script generates an idempotent `INSERT OR REPLACE` of demo memories so a fresh
 * local/remote DB shows a populated galaxy: a FORMING Joy smile in the Milky Way plus a
 * scatter of other emotions. Placement mirrors the live write-path (add-memory): each
 * memory binds to its emotion figure's Nth open anchor (createdAt order), and routes to
 * its host galaxy via `hostGalaxyFor`. Stable ids (`pf###`) make re-runs replace, not dup.
 *
 * Run (prints SQL to stdout — pipe it to wrangler):
 *   pnpm tsx scripts/prefill-stars.ts > scripts/prefill-stars.sql
 *   wrangler d1 execute STARS_DB --local  --file scripts/prefill-stars.sql   # local dev DB
 *   wrangler d1 execute STARS_DB --remote --file scripts/prefill-stars.sql   # deployed DB
 *
 * Pure + deterministic (no Date.now / Math.random) — same output every run.
 */
import { hashStr, mulberry32 } from "../src/lib/galaxy/rng";
import { CONSTELLATIONS, hostGalaxyFor, MOODS } from "../src/lib/galaxy/seed";
import type { Emotion } from "../src/lib/galaxy/types";

type Demo = { mood: Emotion; name: string; text: string; who?: string };

// Curated demo memories. Joy is deliberately the richest (8 of 10 → a clearly-forming
// smile in the home Milky Way); love/grief begin their figures; a handful of other
// emotions scatter across the neighbour galaxies. Each emotion's count stays ≤ 10.
const DEMO: Demo[] = [
  // joyful → home Milky Way (the forming smile)
  { mood: "joyful", name: "kitchen radio", text: "we danced in socks while the pasta water boiled over.", who: "marco" },
  { mood: "joyful", name: "all the green lights", text: "every light turned green and we pretended the city was ours." },
  { mood: "joyful", name: "first snow", text: "you caught the first flake on your tongue and declared winter open.", who: "noor" },
  { mood: "joyful", name: "the wrong train", text: "we took the wrong train and found the best bakery of our lives." },
  { mood: "joyful", name: "rooftop july", text: "warm tar under bare feet, a whole sky of someone else's fireworks." },
  { mood: "joyful", name: "the long laugh", text: "neither of us could remember the joke, only that we couldn't stop." },
  { mood: "joyful", name: "yellow umbrella", text: "one umbrella, two soaked shoulders, zero complaints.", who: "lena" },
  { mood: "joyful", name: "the good morning", text: "coffee, your terrible singing, sunlight deciding to stay." },
  // tender → home Milky Way (the heart begins)
  { mood: "tender", name: "his steady hands", text: "he taught me to tie the knot that never slips.", who: "marco" },
  { mood: "tender", name: "the borrowed coat", text: "you put your coat on my shoulders and walked the cold home." },
  { mood: "tender", name: "lullaby in the dark", text: "half a song, hummed, until the fear let go." },
  // grieving → home Milky Way (the teardrop begins)
  { mood: "grieving", name: "the old number", text: "i still know the number by heart. i don't call it." },
  { mood: "grieving", name: "the empty chair", text: "we set the table for one too many out of habit." },
  // a scatter across the neighbour galaxies
  { mood: "wonder", name: "the deep field", text: "a thousand galaxies in a patch of sky the size of a grain of sand.", who: "ken" },
  { mood: "hope", name: "the first seedling", text: "green, against all the odds of the frost." },
  { mood: "peaceful", name: "still water", text: "the lake held the mountains so calmly i forgot which was real.", who: "ana" },
  { mood: "courage", name: "the high board", text: "i climbed back up after the belly-flop and jumped again." },
  { mood: "longing", name: "the far porch light", text: "a light left on in a window i no longer have the key to." },
];

const EPOCH = 1748000000000; // fixed backdated epoch (clock-free)

type Row = {
  id: string;
  text: string;
  name: string;
  mood: Emotion;
  color: string;
  r: number;
  angle: number;
  brightness: number;
  grp: string;
  who: string | null;
  tier: string;
  parentId: string;
  createdAt: number;
};

const perGroup = new Map<string, number>();
const rows: Row[] = DEMO.map((d, i) => {
  const id = `pf${String(i + 1).padStart(3, "0")}`;
  const rng = mulberry32(hashStr(id) ^ 0x9e3779b9);
  // Bind to the emotion figure's Nth open anchor (the live placeOnFigure order). Every
  // emotion has an authored figure, so a demo memory always snaps onto its silhouette.
  const figure = CONSTELLATIONS[d.mood];
  const rank = perGroup.get(d.mood) ?? 0;
  perGroup.set(d.mood, rank + 1);
  const anchor = figure?.anchors[rank];
  if (!anchor) throw new Error(`${d.mood}: more than ${figure?.anchors.length} members — densification not handled in the demo prefill`);
  return {
    id,
    text: d.text,
    name: d.name,
    mood: d.mood,
    color: MOODS[d.mood].color,
    r: anchor.r,
    angle: anchor.angle,
    brightness: 0.55 + rng() * 0.4,
    grp: d.mood,
    who: d.who ?? null,
    tier: "galaxy",
    parentId: hostGalaxyFor(d.mood),
    createdAt: EPOCH + i * 3_600_000,
  };
});

const q = (v: string | null): string =>
  v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`;

const values = rows
  .map(
    (r) =>
      `  (${q(r.id)}, ${q(r.text)}, ${q(r.name)}, ${q(r.mood)}, ${q(r.color)}, ${r.r}, ${r.angle}, ${r.brightness.toFixed(4)}, ${q(r.grp)}, ${q(r.who)}, NULL, ${q(r.tier)}, ${q(r.parentId)}, ${r.r}, ${r.angle}, ${r.createdAt})`,
  )
  .join(",\n");

process.stdout.write(
  `-- Prefill ${rows.length} demo memory stars (scripts/prefill-stars.ts). Idempotent.\n` +
    "INSERT OR REPLACE INTO memory_stars\n" +
    "  (id, text, name, mood, color, r, angle, brightness, grp, who, trigger, tier, parent_id, placement_r, placement_angle, created_at)\n" +
    "VALUES\n" +
    values +
    ";\n",
);
