---
title: Code-style & conventions guide
updated: 2026-06-14
last_learned: "#257 (2026-06-24)"  # watermark — guide is a tracked/public file for the CI auto-reviewer (PR #203). #217: codified the code-comments rule. #232/#234: code-comments rule re-scoped from length → content (it was mass-false-flagging WHY-comments by line count); rescued the stranded #232 dev/ops-script i18n exemption. #254: 0 threads. #255: CI bot flagged listener-self-teardown pattern; no human reply — no new rule codified yet. #257: 0 human review threads; no new rules distilled.
maintained_by: reviewer (md-review-pr)
---

# Code-style & conventions guide

The living standard `md-review-pr` enforces. Two kinds of rules live here:

- **Hand-written** — curated by the human; authoritative.
- **Learned** — auto-distilled by the reviewer from PR inline comments.

The reviewer **auto-appends** learned rules and never silently overwrites a
hand-written one. A learned signal that contradicts a hand-written rule lands in
*Conflicts to resolve* for the human to settle.

> The core rules below are mirrored into `AGENTS.md` § Conventions. This file is tracked
> (the only published file under the otherwise-local `docs/`) so the CI auto-reviewer
> (`.github/workflows/claude-review.yml`) can read the living guide. Keep the two in sync
> when you edit a core rule.

## Hand-written conventions

### DRY · KISS · YAGNI
- **Rule:** Don't repeat yourself; keep it simple; don't build what isn't needed yet.
  Extract a shared helper on the *second* duplication, not in anticipation. Prefer the
  plainest solution that works; delete speculative abstraction and unused options.
- **Why:** Less code to read, test, and break. The repo is a solo-dev playground —
  premature generality is pure cost.
- **Flag in review:** copy-pasted blocks, config/flags with no current caller, a layer of
  indirection wrapping a single call site.

### Arrow functions over `function` declarations
- **Rule:** Define functions as `const f = (…) => …`, not `function f(…) {}`. Applies to
  components, handlers, helpers, and callbacks.
- **Why:** One consistent form; lexical `this`; reads as values you compose and pass.
- **Example:** `function add(a, b) { return a + b }` → `const add = (a, b) => a + b`.
- **Exceptions:** generators, or a genuine need for hoisting/`this` rebinding — call it out.
- **Enforced by Biome** (#36): `useArrowFunction` (expressions/callbacks) + the GritQL plugin
  `biome-plugins/use-arrow-functions.grit` flags top-level `function` declarations. The whole
  `src/` tree was migrated to arrows (route components moved above their `Route` to avoid TDZ,
  since `const` isn't hoisted). Note: `export default function` is not caught by the plugin.

### Composition over inheritance
- **Rule:** Build behavior by composing small functions / values, not class hierarchies.
  Compose hooks and functions; pass dependencies in. No `extends` for sharing logic.
- **Why:** Flexible, testable units with explicit inputs — no fragile base-class coupling.
- **Flag in review:** `class … extends …` used to share code; deep prototype chains; mixins
  that could be plain function composition.

### Functional paradigm — Functional-Light-JS
- **Rule:** Favor pure functions, immutability, and explicit data flow per
  [Functional-Light-JS](https://github.com/getify/Functional-Light-JS). Avoid shared mutable
  state and side effects in the core; push effects to the edges. Prefer `map`/`filter`/
  `reduce` and small composed functions over imperative mutation. Treat data as immutable
  (return new values; don't mutate args/props/state in place).
- **Why:** Predictable, referentially-transparent code is easier to reason about and test —
  and it fits the seeded-deterministic galaxy (e.g. `src/lib/starfield.ts`).
- **Flag in review:** in-place mutation of inputs, hidden side effects in pure-looking
  helpers, reaching for a loop+accumulator where a `reduce`/`map` is clearer.

### `type` aliases over `interface`
- **Rule:** Declare object/contract shapes with `type X = { … }`, not `interface X { … }`.
- **Why:** One consistent declaration form; unions / intersections / mapped & conditional
  types compose uniformly; no surprise declaration-merging.
- **Example:** `interface MemoryStar { id: string }` → `type MemoryStar = { id: string };`.
- **Source:** owner review of PR #28 ("types over interfaces / remember!"), 2026-06-02.
- **Flag in review:** new `interface` declarations. (No Biome rule exists; reviewer-enforced.
  The data contract in `src/lib/galaxy/types.ts` was converted.)

### `as const` for constant literal data
- **Rule:** Suffix module-level constant literals (maps, config, tuples, fixed records) with
  `as const`. Pair with `satisfies T` to keep the type-shape / exhaustiveness check while
  gaining literal, readonly inference — `… } as const satisfies Record<Mood, …>`.
- **Why:** Literal types + readonly catch typos and accidental mutation; `satisfies` keeps the
  "all keys present / right shape" guarantee a bare annotation gave.
- **Example:** `const MOODS: Record<Mood, M> = {…}` → `const MOODS = {…} as const satisfies Record<Mood, M>`.
- **Source:** owner review of PR #28, 2026-06-02 (MOODS, SEED, DEFAULT_BACKDROP, the special stars).

### i18n — all user-facing text lives in the typed catalog
- **Rule:** Every string a user can see or a screen reader announces — visible copy, `aria-label`,
  `alt`, `<title>`/`meta`, button/sr-only labels — **must** be added to the typed i18n catalog
  (`src/lib/i18n/messages/{en,ru}.ts`, shaped by `Messages` in `src/lib/i18n/types.ts`) and read in
  components via `getMessages(useLocale())`. **Never hardcode a user-facing string inline** in a
  component or route. Fill **both** locales (`en` source + `ru`); ru parity is compile-enforced by
  `as const satisfies Messages`. Use `interpolate(...)` for `{token}` placeholders. Keep the
  active-locale / rotation rules **pure functions of the URL** (no `Accept-Language`/cookie/`Date`/
  random) so SSR and client agree (no hydration mismatch). Non-user-facing strings (class names,
  `data-*`, test fixtures, dev logs) are exempt.
- **Why:** A second locale only stays correct if there's exactly one place text can live; an inline
  literal silently ships English on `/ru` (this is how the loader's "thinking"/"gathering her stars"
  and ASTRO's narration slipped through the first pass). The typed catalog makes a missing/again
  drifted translation a compile or test failure, not a runtime surprise.
- **Example:** `<span>{m.chrome.subtitle}</span>` not `<span>A QUIET PLACE…</span>`; a loader sub-label
  → `label ?? m.loader.label`, not a `DEFAULT_LABEL = "…"` constant.
- **Flag in review:** any new user-facing string literal in `src/components/*`/`src/routes/*`; a copy
  constant in a `lib` module; a catalog key added to `en` but not `ru` (or vice-versa).
- **Source:** owner directive, 2026-06-04 ("all text agents want to write must be in i18n configs");
  ADR-0007, story #103.

## Learned conventions
<!-- md-review-pr appends here. One block per rule:
### <short rule title>
- **Rule:** <imperative statement>
- **Why:** <rationale, in the reviewer's / human's words>
- **Example:** `bad → good`, or a file:line pointer
- **Source:** PR #<n> comment(s) by <author>, learned YYYY-MM-DD
-->

### Prefer the `gh` CLI / maintained tooling over hand-rolled API & crypto plumbing
- **Rule:** When something can be done through the `gh` CLI, an official `gh` extension (e.g.
  `gh-token`), or a maintained action (e.g. `actions/create-github-app-token`), reach for that
  before hand-rolling the same HTTP/crypto flow. Keep a bespoke script only when no maintained
  tool fits — and say why (e.g. "zero-dependency is a recorded requirement").
- **Why:** Less security-sensitive code to own and audit — especially anything touching keys or
  tokens; the maintained tool tracks API/security changes for you. This is DRY/KISS applied to
  *tooling*, not just our own code.
- **Example:** mint a GitHub App installation token via `gh token generate` (gh-token ext) /
  `actions/create-github-app-token`, rather than a custom `node:crypto` JWT signer.
- **Source:** PR #39 comment by sliim35 ("gh cli is more preferable"), learned 2026-06-02.

### Secrets come from the secret store, never a resident local file
- **Rule:** Source private keys / tokens from the secret store **at use-time** — 1Password (`op`)
  per ADR-0004, or cloud **Agents secrets** — not a `.pem`/key file left on disk. `.gitignore` is
  necessary but **not sufficient**: don't design a flow (e.g. a `*_KEY_PATH` pointing at a
  persistent local key) whose happy path leaves a key at rest. If a key must touch disk, it's
  temporary and shredded in the same flow.
- **Why:** A resident key is exposure (backups, other processes, accidental share) independent of
  git history.
- **Example:** `op read 'op://<vault>/<item>/private key' | node mint.mjs` over
  `GH_APP_PRIVATE_KEY_PATH=~/Downloads/app.pem`.
- **Source:** PR #39 comment by sliim35 ("key is stored locally"), learned 2026-06-02; aligns with
  ADR-0004 (1Password).

### Security/tooling decisions need a research-backed, *recorded* rationale
- **Rule:** For tooling or security-sensitive choices (auth, secret handling, identity), do the
  best-practices pass **and record the decision** (research note → ADR / decision-log) before or
  with the implementation — don't ship the mechanism while the "is this the right approach?"
  question stays open.
- **Why:** A research note that lists options but defers the verdict isn't a decision; the crux
  (here: hand-rolled minter + local key vs. `gh-token` + 1Password) needs to be settled on the
  record, not in the diff.
- **Source:** PR #39 comment by sliim35 ("make research for best practices"), learned 2026-06-02.

### Accurate cross-references — don't point at what doesn't exist
- **Rule:** When a doc, skill, or comment names another artifact — a skill, file, path, symbol,
  agent, command, or a row in a keyed roster/table — make sure that target actually exists and
  resolves (and isn't duplicated). Don't write a `Delegates to:` / "see X" / roster entry that
  points at something not installed/present. Verify the name before shipping the pointer.
- **Why:** A dangling reference silently misleads the next reader/agent — it reads as "this exists"
  when it doesn't, and a duplicate key in an entity-keyed table is ambiguous. KISS: a pointer is
  only useful if it resolves to exactly one real thing.
- **Example:** `Delegates to: consolidate-memory` (not an installed skill) → point at `dream`, the
  one that exists (or use the resolvable fully-qualified name); collapse a duplicated `orchestrator`
  roster row into one.
- **Source:** PR #41 comments by sliim35 ("accurate cross-references … don't point at what doesn't
  exist"; "roster consistency — duplicate key"), learned 2026-06-03.

### Galaxy render math lives in `src/lib/galaxy/*`, not the component `draw()` loop
- **Rule:** Keep simulation / animation / geometry math — and the constants it depends on — in
  pure, unit-tested `src/lib/galaxy/*` modules. Components (`src/components/galaxy/*`) only step
  time and issue canvas draw calls; don't inline per-frame geometry or bare literals inside the
  `draw()` closure. Extract a `lib` helper (alongside `buildDeepMeteors` in `meteors.ts`) and
  have the component call it.
- **Why:** `lib` math is seeded-deterministic and testable in isolation (every
  `src/lib/galaxy/*.ts` has a `.test.ts`); math trapped in a `draw()` closure can't be tested and
  silently drifts from the tests asserting against its constants. Matches the existing
  `starfield.ts` / `meteors.ts` split.
- **Example:** the far-meteor stepping math inlined in `DeepStarfield.tsx`'s `draw()` (`prog`,
  `fade`, per-pixel `x` / alpha / slope) → a `stepMeteor(m, sec, w, h)` helper in
  `src/lib/galaxy/meteors.ts`; the `0.9` alpha cap baked in the draw loop → an exported
  `SHOOTER_ALPHA_CAP` the test imports.
- **Source:** PR #62 comment by sliim35 ("need to exclude to lib or something like that",
  `DeepStarfield.tsx:92`), corroborated by the reviewer's own magic-number nit on `meteors.ts:95`
  (same theme), learned 2026-06-03.

### Lib timing constants must pair with their CSS animation — cross-reference or test
- **Rule:** When a `lib` module exports a timing constant (cycle duration, delay, etc.) that names
  a CSS `animation` duration, either (a) add a test assertion that imports the constant and checks
  the expected ms value with a comment naming the CSS animation it governs, or (b) add a
  cross-reference comment in the CSS that cites the constant name and its source file. An exported
  constant that silently diverges from the CSS it describes is the same silent-coupling bug that
  caused `IGNITE_MS` to drift 100 ms from `@keyframes memIgnite` in PR #49.
- **Why:** The CSS-in-JS boundary creates an invisible coupling: a developer changing one
  number won't automatically know to update the other. An assertion or cross-reference creates
  the explicit link; the KISS rule says don't let two places own the same fact.
- **Example:** `BOB_CYCLE_MS = 4000` in `astro.ts` + `animation: astro-bob 4s …` in `styles.css`
  → add a test: `expect(BOB_CYCLE_MS).toBe(4000); // styles.css: astro-bob 4s` or a CSS comment:
  `/* astro-bob 4s = BOB_CYCLE_MS in src/lib/galaxy/astro.ts */`.
- **Source:** PR #81 nit by reviewer, `astro.ts:120` / `styles.css:172`; same theme as PR #49
  `IGNITE_MS` correction, learned 2026-06-03.

### Build/CLI-only Node deps go in `devDependencies`, not `dependencies`
- **Rule:** If a package is used only at build-time or in a CLI script — never imported by a route or a runtime module — it must live in `devDependencies`. Placing it in `dependencies` causes the Workers deploy tooling (Vite/wrangler) to treat it as a runtime dep and attempt to bundle it, including any native binaries. The bundle may happen to be clean through tree-shaking, but that is structural luck not structural safety. Put the package in `devDependencies`; if a bundler-level exclude is also needed, add it explicitly in `wrangler.jsonc`.
- **Why:** A CLI/Node library in `dependencies` pollutes the deploy artifact and can introduce native binaries (e.g. prebuilt Skia via `@napi-rs/canvas`) into a Workers-targeted bundle. DRY/KISS: the place a dependency is declared should truthfully reflect where it is consumed.
- **Example:** `@napi-rs/canvas` used only in `src/brand/composer/render-cli.ts` (a `pnpm tsx` CLI) → `devDependencies`, not `dependencies`.
- **Source:** PR #86 finding F1 by reviewer, 2026-06-04.

### DOM chrome wrappers in JSX — extract as named components, not inline divs
- **Rule:** When a `GalaxyStage` (or any orchestrating component) renders a multi-child
  wrapper div that owns a distinct layout concern (e.g. a viewport-pinned chrome overlay),
  extract it as a **named React component** (`<ChromeOverlay>`, `<SpaceLayer>`, etc.) rather
  than leaving it as an anonymous `<div className="galaxy-chrome-overlay">` inline in the
  parent's JSX.
- **Why:** A named component makes the tree readable at a glance and keeps the parent
  orchestrator at the right altitude — it declares *what* layers compose the scene, not
  *how* they're built. Consistent with the composition-over-inheritance rule. It also
  creates a natural boundary for future prop / a11y / style evolution without re-opening
  the parent every time.
- **Example:** `<div className="galaxy-chrome-overlay"><GalaxyChrome /><Astro />…</div>` inline in
  `GalaxyStage.tsx` → extract as `<ChromeOverlay>` (`src/components/galaxy/ChromeOverlay.tsx`).
- **Source:** PR #92 comment by sliim35 ("It must be a component",
  `GalaxyStage.tsx:120`), learned 2026-06-04.

### The #75 styling boundary covers decorative DOM too — defer with a tracked task, not silently
- **Rule:** The styling boundary (AGENTS.md §Conventions, story #75) — **Tailwind utilities for
  DOM chrome; `src/styles.css` only for the canvas stage + its keyframes** — applies to *all*
  DOM elements, including decorative/backdrop `<div>`s (e.g. a full-bleed tint host), not just
  interactive chrome. When such an element ends up with bespoke `styles.css` rules, don't
  silently leave it: if it genuinely can't be expressed as utilities yet (e.g. a multi-stop
  `radial-gradient` + `color-mix`), open a tracking task to migrate it, keeping the tokens in
  `@theme`/`--vars` meanwhile.
- **Why:** "It's only decorative" isn't an exemption from the boundary; an untracked raw-CSS
  block quietly erodes the convention until you can't tell stage/canvas rules from
  utility-reachable ones. KISS: one home for chrome style (utilities), one for canvas/keyframes;
  a task keeps the debt visible and owned.
- **Example:** `.galaxy-backdrop-tint` (the Layer A nebula tint, `BackdropTint.tsx`) — three
  stacked `radial-gradient`s + `color-mix` over the palette `--tint-*` vars — shipped as raw CSS
  in `styles.css` → tracked for Tailwind migration in #94.
- **Source:** PR #92 comment by sliim35 ("create a task to move it to Tailwind",
  `styles.css:191`), learned 2026-06-04.

### Raw `rgba()/rgb()` color literals fall under the #75 token boundary — use a `var` / `color-mix`
- **Rule:** a hardcoded `rgba(…)`/`rgb(…)` in a chrome rule violates the token boundary just like a
  raw `#hex`. Before writing one, check whether a `@theme` token already covers it: if so, use
  `var(--color-…)`; if you need a token color at a *different alpha*, use
  `color-mix(in srgb, var(--color-…) N%, transparent)` (or add a named `--color-…` token). Never
  repeat the same raw color across more than one rule.
- **Why:** the #75 boundary ("color/space/radius tokens live once in `@theme`, never hardcode a hex
  in chrome") is about *token colors*, not the `#hex` syntax specifically. A raw `rgba` duplicated
  across rules (e.g. a panel `background` + its tail `border-top-color` fill-match) silently diverges
  when one is updated, and hides the color from the palette inventory.
- **Example:** the ASTRO bubble shipped `background: rgba(8,8,14,.85)` + a matching tail
  `border-top-color` (PR #89 F4) → both → `var(--color-surface)`; the loader glow/rail shipped
  `rgba(245,214,160,.05/.16)` (PR #87 F4) → `color-mix(in srgb, var(--color-accent) N%, transparent)`.
- **Source:** PRs #89 F4 + #87 F4 (reviewer), learned 2026-06-04.

### Keep interactive controls outside `aria-live` regions
- **Rule:** don't nest focusable/interactive controls (`<button>`, `<a>`, `<input>`) inside a live
  region (`aria-live`, `role="status"`, `<output>`, `role="alert"`). Make the live region wrap only
  the changing text, and place controls as its siblings.
- **Why:** most AT reads only the changed text of a polite live region on update, but a minority of
  AT/browser combos traverse the whole subtree and announce the control's label alongside the
  message. The ARIA APG recommends controls outside the live region — the structure that works for
  all AT is the one to pick (KISS).
- **Example:** the ASTRO bubble had `<output aria-live="polite">{text}<button>×</button></output>`
  (PR #89 F2) → `<div class="bubble"><output aria-live="polite">{text}</output><button>×</button></div>`
  (dismiss button stays absolutely positioned within the panel, layout unchanged).
- **Source:** PR #89 F2 (reviewer), learned 2026-06-04.

### Plan-level CSS exceptions do not override the #75 Tailwind boundary
- **Rule:** An implementation plan cannot grant itself a "one CSS exception" carve-out for DOM chrome. If a plan explicitly marks a `.my-class` CSS rule as "the one exception" to the #75 Tailwind/styles.css boundary, the reviewer must still flag it — and the owner's correction takes precedence. The only valid exceptions are canvas-stage rules, keyframe animations, and CSS custom-property selectors that cascade from the stage (e.g. `.mem-star__*` reading `--bloom`/`--star-color` from the star's inline style) — and even those are scrutinised for Tailwind equivalents on each PR.
- **Why:** The owner has consistently corrected this in PRs #151, #152, and #157. A plan-authored exception silently erodes the boundary; the convention's intent is that DOM chrome stays in Tailwind so the styling inventory is visible and auditable. The fact that a CSS rule can read a CSS custom property is not sufficient justification for keeping it in `styles.css` when Tailwind arbitrary-value syntax can express the same thing.
- **Example:** The plan for slice E (#153) called `.mem-star__hit` "the one `.mem-star__hit` rule excepted per the plan." The owner left a "tailwind" comment — the hit-area button must use Tailwind utilities (`[width:max(var(--bloom),24px)]`, `focus-visible:[outline-color:var(--star-color)]`, etc.) instead.
- **Source:** PR #157 inline comments by sliim35 (`GalaxyStage.tsx:126`, `MemoryStarView.tsx:84`), 2026-06-05; consistent with PRs #151 + #152 corrections.

### Dead i18n catalog keys (YAGNI) — don't add keys that no component reads

- **Rule:** Only add catalog keys (`src/lib/i18n/messages/{en,ru}.ts` + `types.ts`) that
  are actually read by at least one component or route. A key added "for future use" or for
  a toggle/panel that doesn't exist yet is a YAGNI violation: it inflates the typed contract,
  makes it impossible to audit coverage, and may confuse translators. Remove or defer the
  key until its consumer lands in the same PR.
- **Why:** The typed `Messages` contract exists so coverage is provable — but only if every
  key in it is consumed. An unconsumed key breaks that invariant just as much as a missing
  key. DRY/YAGNI: one entry, one consumer; add the entry when you add the consumer.
- **Example:** `search.open` / `search.close` added in `types.ts` + `en.ts` + `ru.ts` for a
  toggle button that `StarSearch.tsx` doesn't render — those keys have no reader in this PR
  (feat/113-star-search) and should be removed until a collapse/toggle UI lands.
- **Source:** feat/113-star-search review finding (minor), 2026-06-14.

### Event-emitting lifecycle controllers must emit terminal events on kill/cancel
- **Rule:** When a lifecycle controller (camera hook, timeline, animation engine) emits a sequence
  of lifecycle events (`depart` → `threshold` → `arrive`), and the sequence can be interrupted
  mid-flight (kill, cancel, focus override), the kill path must also emit the terminal event
  (`arrive` / `cancel`) if the sequence has already emitted a side-effecting intermediate event
  (`threshold`). Consumers that act on `threshold` (scene swap, label relabel) will otherwise be
  left in a half-committed state — showing the destination scene while the camera is no longer
  heading there.
- **Why:** A `threshold` event commits visible state in the UI (scale net relabel, scene swap).
  If `arrive` never fires because the timeline was killed, the displayed state diverges from the
  actual camera state. The fix is cheap: track whether `threshold` has fired in the in-flight
  tracker, and emit `arrive`/`cancel` from the kill path if it has. The alternative — never
  committing side effects at `threshold` — trades correctness of the commit timing (spec: swap
  at threshold, not at request) for lifecycle cleanliness. Keep the threshold swap; fix the kill.
- **Example:** `killTransition()` in `useGalaxyCamera.ts` kills the GSAP timeline without
  emitting `arrive`. If `threshold` already fired, `displayedTier` in `GalaxyStage` is left at
  the LG tier while the camera is now on a star focus. The scale net reads "2.5 Mly" instead of
  "100k ly". Fix: check `transition.thresholdFired` in `killTransition` and emit
  `{ kind: 'arrive', tier: plan.from }` if true (PR #167 minor finding, 2026-06-06).
- **Source:** PR #167 reviewer finding (kill-without-arrive gap), 2026-06-06.

### Code comments — judge by WHY-vs-WHAT, never by length
- **Rule:** A comment earns its place by stating the non-obvious **WHY** — the rationale, the invariant it upholds (append-only, SSR-safety, purity, determinism), the edge case, the cross-reference a caller can't read off the code. Comments that do that are **good at any length**:
  - **Doc comments** — a `/** … */` JSDoc on an **exported** function / type / constant, or a **module header** — are *expected* to be multi-line and may be as long as their contract needs. This is the established convention across `src/lib/**` (e.g. `placeOnFigure`, `slotBeyondCompletion`, `figuresInSky`, `memberAnchorPoints`, the module headers).
  - **Inline comments** (between statements) — prefer concise, but a short multi-line WHY is fine when the rationale genuinely needs it.
- **Flag a comment ONLY when** it (a) restates WHAT the code trivially does (redundant → drifts), (b) has gone **stale / inaccurate**, or (c) just duplicates the PR description without adding contract. **Line count is NEVER the trigger** — do not flag "N-line docstring / block"; a long WHY-comment is not a defect.
- **Why:** The #217 lesson was real but mis-codified as a *length* rule ("one short line / no docstrings"), which contradicts this codebase's real convention — load-bearing JSDoc is a feature, not noise — and made the reviewer re-flag the same length nit on legitimate comments PR after PR. The signal is WHY-vs-WHAT, not characters.
- **Source:** PR #217 review (inline comment-nit thrash, 4 rounds) learned 2026-06-21; **re-scoped from length to content** after the reviewer re-flagged legitimate WHY-comments by line count on #232 / #234 / #235 (owner: "it happens over and over again — update the guide so it doesn't repeat"), 2026-06-22.

### i18n exemption — dev/ops scripts are out of scope for the catalog rule
- **Rule:** The typed i18n catalog rule (all user-facing strings in `src/lib/i18n/messages/{en,ru}.ts`) applies only to **app UI code** (`src/components/**`, `src/routes/**`). A dev/ops script under `scripts/` (or `tools/`) that emits SQL, JSON, or CLI output is exempt — its strings (fixture names, fake text, log messages) are not user-visible product copy and do not need catalog entries. Inline strings in scripts are fine.
- **Why:** The i18n rule targets the hydration-safe, locale-switching UI surface. A CLI/Node script has no locale, no hydration, and no SSR constraint; requiring catalog entries for fixture text would inflate the typed contract with dead keys (YAGNI) and violate the dead-i18n-keys rule.
- **Example:** `scripts/prefill-stars.ts` embeds English fixture memory text inline — that is correct and should NOT be moved to the catalog.
- **Source:** PR #232 review analysis, 2026-06-22 (stranded uncommitted in the #232 retro; rescued into #235).

## Conflicts to resolve (human)
<!-- A learned signal that contradicts a hand-written rule lands here, not above. -->

_None._
