/**
 * The Memory Galaxy data contract — shared by the canvas renderer (#4), the
 * store seam, and (later) the AI placement agent. Mirrors `docs/pixel-galaxy-ui.md`
 * §1, extended with the prototype's optional `name` / `who` / `deep` fields
 * (`stardust/project/memory-data.jsx`).
 *
 * The agent owns the stars; the UI owns the sky. Nothing in this layer recolors
 * or repositions a star — `color` and `(r, angle)` are passed through unchanged.
 * Render-only fields (twinkle, phase, camera) are NOT part of the contract; they
 * belong to the renderer (#4).
 */

export type Mood =
  | "joyful"
  | "tender"
  | "grieving"
  | "wistful"
  | "peaceful"
  | "nostalgic"
  | "wonder";

/** Backdrop sky tone. Default is `auroral` (design spec 2026-06-02). */
export type Palette = "ember" | "ice" | "auroral";

/** The dim, decorative procedural galaxy behind everything — reproducible from `seed`. */
export interface GalaxyBackdrop {
  seed: number;
  branches: number; // spiral arms (2–5)
  spin: number;
  randomnessPower: number; // ~2.2 core bias
  palette: Palette;
}

/** One real memory, placed as a star by the agent. */
export interface MemoryStar {
  id: string; // stable, deep-linkable (the bot's reply links to this)
  text: string; // the memory, already moderated + trimmed by the agent
  mood: Mood;
  color: string; // agent-chosen hex, derived from mood — never recolored in the UI
  r: number; // distance from center, 0..1
  angle: number; // radians — where on the sky
  brightness: number; // 0..1 — drives glow + size
  createdAt: number; // epoch ms; supplied by the caller at add-time (never Date.now() at module scope)
  name?: string; // short title shown on hover / in the panel
  who?: string | null; // opt-in attribution; null/absent = anonymous (brief §6)
  egg?: boolean; // the hidden dedication star (reveal on click)
  deep?: boolean; // the "fly-home" deep-story star (separate from the egg)
}

/** What the frontend reads to draw the sky. */
export interface GalaxySky {
  backdrop: GalaxyBackdrop;
  stars: MemoryStar[];
}

/**
 * Transport-agnostic store seam. In-memory now; a KV / Durable-Object impl can be
 * added later without touching callers (ADR-0003+). `getSky()` is synchronous for
 * the in-memory impl; the interface is intentionally small so an async transport
 * can wrap it.
 */
export interface GalaxyStore {
  getSky(): GalaxySky;
  addStar(star: MemoryStar): void; // append-only; never moves existing stars
  subscribe?(fn: (sky: GalaxySky) => void): () => void; // optional; live-growth later
}
