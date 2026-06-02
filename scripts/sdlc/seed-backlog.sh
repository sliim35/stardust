#!/usr/bin/env bash
#
# Seed the GitHub backlog for the AI SDLC:
#   1. create the label taxonomy (see .github/labels.yml)
#   2. open the "Memory Galaxy" epic
#   3. open the initial stories and link them to the epic
#
# Safe to re-run: labels use --force. Issues are NOT deduped — run this once after the
# repo exists. Until an 'origin' remote is configured this script is INERT (prints how to
# create the repo and exits 0), so bootstrap never touches GitHub.
#
# Usage:
#   gh repo create sliim35/stardust --source=. --remote=origin   # (already created)
#   git push -u origin main
#   bash scripts/sdlc/seed-backlog.sh
#
set -euo pipefail

# --- guard: require a remote (keeps bootstrap inert) -------------------------
if ! git remote get-url origin >/dev/null 2>&1; then
  cat <<'EOF'
No 'origin' remote configured — nothing was created.

Create the repo first, then re-run this script:

  gh repo create sliim35/stardust --source=. --remote=origin
  git push -u origin main
  bash scripts/sdlc/seed-backlog.sh
EOF
  exit 0
fi

# --- guard: require gh auth --------------------------------------------------
if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# --- 1. labels ---------------------------------------------------------------
echo "==> Creating labels (idempotent)…"
# Non-fatal: a transient API hiccup on one label must not abort before the dedup guard.
lbl() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null 2>&1 || echo "    (label $1: skipped — already exists or transient error)"; }
lbl "type:epic"          "5319e7" "A body of work grouping stories"
lbl "type:story"         "1d76db" "A self-contained, shippable unit of work"
lbl "type:bug"           "d73a4a" "Something doesn't work as expected"
lbl "type:spike"         "0e8a16" "A time-boxed research question"
lbl "priority:P0"        "b60205" "Drop everything"
lbl "priority:P1"        "d93f0b" "High"
lbl "priority:P2"        "fbca04" "Normal"
lbl "priority:P3"        "c2e0c6" "Low / someday"
lbl "status:todo"        "ededed" "Not started"
lbl "status:in-progress" "0052cc" "Being implemented"
lbl "status:in-review"   "fef2c0" "Awaiting QA"
lbl "status:blocked"     "000000" "Blocked on something"
lbl "role:research"      "bfd4f2" "researcher"
lbl "role:architecture"  "d4c5f9" "architect"
lbl "role:design"        "f9d0c4" "ui-designer"
lbl "role:dev"           "c5def5" "developer"
lbl "role:qa"            "bfdadc" "qa"
lbl "role:devops"        "c2e0c6" "devops"

# --- guard: never duplicate the seed -----------------------------------------
# Labels above are idempotent; issues are NOT. If the epic already exists, stop here.
EPIC_TITLE="[epic] Set up the real Memory Galaxy project"
if gh issue list --state all --search "$EPIC_TITLE in:title" --json title -q ".[].title" 2>/dev/null \
     | grep -qxF "$EPIC_TITLE"; then
  echo "==> Epic already present; labels ensured. Skipping issue creation to avoid duplicates."
  exit 0
fi

# --- 2. epic -----------------------------------------------------------------
echo "==> Creating the epic…"
EPIC_BODY=$(cat <<'EOF'
## Goal
Turn the demo into the real Memory Galaxy product: a shared pixel-art sky where each star is
a real memory texted to a Telegram bot, placed by an AI agent.

## PRD
Local: docs/product/2026-06-02-memory-galaxy.md · Stack: docs/architecture/adr/0002-memory-galaxy-stack.md
(docs/ is gitignored; this issue is the durable record.)

## Success metrics
A visitor sees a gorgeous sky with >=3 real memory stars, can click one to read it, a freshly
added star appears live without reshuffling the rest, and ?star=<id> focuses the right star.
EOF
)
EPIC_URL=$(gh issue create \
  --title "[epic] Set up the real Memory Galaxy project" \
  --label "type:epic,priority:P1,status:todo" \
  --body "$EPIC_BODY")
EPIC_NUM="${EPIC_URL##*/}"
echo "    epic = #$EPIC_NUM  ($EPIC_URL)"

# --- 3. stories --------------------------------------------------------------
echo "==> Creating stories…"
STORY_LIST=""

# create_story <title> <labels> <slug> <body-var-name>
create_story() {
  local title="$1" labels="$2" slug="$3" body="$4" url num
  body="$body"$'\n\n'"Part of #$EPIC_NUM · Story doc: docs/stories/<#>-$slug.md (rename draft-$slug.md → <#>-$slug.md)."
  url=$(gh issue create --title "$title" --label "$labels" --body "$body")
  num="${url##*/}"
  STORY_LIST="$STORY_LIST"$'\n'"- [ ] #$num — $slug"
  echo "    #$num  $slug    →  mv docs/stories/draft-$slug.md docs/stories/$num-$slug.md"
}

BODY_DATA_MODEL=$(cat <<'EOF'
## Goal
Establish the typed contract (GalaxyBackdrop / MemoryStar / GalaxySky) the renderer and agent
share, plus a transport-agnostic store seam (getSky / addStar).

## Acceptance criteria
- [ ] Types match docs/pixel-galaxy-ui.md section 1.
- [ ] GalaxyStore interface with getSky() and addStar().
- [ ] In-memory impl seeds a backdrop + >=3 sample stars.
- [ ] Adding a star never moves existing stars (unit-tested).
- [ ] pnpm check and pnpm test pass.
EOF
)
BODY_SCAFFOLD=$(cat <<'EOF'
## Goal
Stand up a /galaxy route + app shell hosting the canvas, retiring demo content incrementally
without breaking the kept infra (LLMO helpers, /api/mcp).

## Acceptance criteria
- [ ] /galaxy route renders an app shell with a canvas container.
- [ ] Route head() keeps LLMO/structured-data conventions.
- [ ] pnpm build has no regression; pnpm check and pnpm test pass.
EOF
)
BODY_RENDERER=$(cat <<'EOF'
## Goal
Port the stardust pixel-art renderer to React/TS canvas: seeded backdrop + bright memory stars,
addStar(), eased camera, bloom/twinkle. Recreate the output, not the prototype internals.
Blocked on a ui-designer design spec.

## Acceptance criteria
- [ ] Seeded procedural backdrop (reproducible from seed).
- [ ] Memory stars render with each star color exactly as given.
- [ ] addStar() fades/twinkles a star in without moving the others.
- [ ] Crisp pixel scaling; bloom + twinkle present.
- [ ] pnpm check and pnpm test pass.
EOF
)
BODY_PANEL=$(cat <<'EOF'
## Goal
Click a memory star to read its text/mood in an in-spirit pixel-art panel; support
?star=<id> deep-links that focus a star on load; honor the quiet egg dedication star.

## Acceptance criteria
- [ ] Clicking a memory star opens a pixel-art panel with text + mood.
- [ ] ?star=<id> on load smoothly focuses that star.
- [ ] The egg star reveals its dedication only on click.
- [ ] Keyboard accessible (focusable stars, ESC closes).
- [ ] pnpm check and pnpm test pass.
EOF
)

create_story "[story] Define the Memory Galaxy data model + store seam" \
  "type:story,priority:P1,role:dev,status:todo" "memory-data-model" "$BODY_DATA_MODEL"
create_story "[story] Scaffold the /galaxy route and app shell" \
  "type:story,priority:P1,role:dev,status:todo" "scaffold-galaxy-route" "$BODY_SCAFFOLD"
create_story "[story] Pixel-art galaxy renderer — backdrop + memory stars" \
  "type:story,priority:P1,role:dev,status:todo" "galaxy-renderer" "$BODY_RENDERER"
create_story "[story] Click-to-read panel + deep-link" \
  "type:story,priority:P2,role:dev,status:todo" "star-read-panel-deeplink" "$BODY_PANEL"

# --- 4. link stories back into the epic --------------------------------------
echo "==> Updating the epic with the story checklist…"
gh issue edit "$EPIC_NUM" --body "$EPIC_BODY"$'\n\n'"## Stories$STORY_LIST" >/dev/null

cat <<EOF

==> Done. Created epic #$EPIC_NUM and 4 stories.
Next:
  - Rename each docs/stories/draft-<slug>.md to <issue#>-<slug>.md and set the issue and epic fields.
  - Or just run the backlog-analyzer (md-groom-backlog) to reconcile.
EOF
