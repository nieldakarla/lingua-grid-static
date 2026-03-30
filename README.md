# LinguaGrid

Language learning through logic grid puzzles. Players read clues in the target language, reason about relationships, and fill in a grid — learning vocabulary and grammar through deduction.

---

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Prisma ORM** + PostgreSQL (Supabase)

---

## Getting started

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in your Supabase connection string:

```bash
cp .env.example .env
```

Apply the schema and seed base data (languages, levels, themes):

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

Seed puzzles from the JSON content files:

```bash
pnpm db:seed-puzzles
```

Start the dev server:

```bash
pnpm dev
```

---

## Using the app

After running `pnpm dev`, open [http://localhost:4321](http://localhost:4321).

| URL | What you'll find |
|---|---|
| `http://localhost:4321` | Landing page |
| `http://localhost:4321/en/dashboard` | English learner dashboard — level selector |
| `http://localhost:4321/en/a1` | A1 puzzle list |
| `http://localhost:4321/en/a1/puzzle/<id>` | Puzzle player |

### Browsing the database

```bash
pnpm db:studio
```

Opens Prisma Studio at `http://localhost:5555` — a GUI to browse and edit all tables directly.

### Generating new puzzles

Puzzles are generated using the **LinguaGrid — Puzzle Factory** project in Claude.ai. That project contains the prompt templates and generation pipeline. Once generated, save the output to the appropriate file in `content/puzzle/` and run:

```bash
python3 scripts/validate_puzzles.py              # validate all files
python3 scripts/validate_puzzles.py en-a1.json  # validate a single file
pnpm db:seed-puzzles                              # import after validation passes
```

### Puzzle validator

`scripts/validate_puzzles.py` checks every puzzle in a file before it reaches the database. It catches:

- **Structural errors** — duplicate items in solution, gridSize mismatch
- **Clue contradictions** — a negative clue that matches the solution, or a positive clue that doesn't
- **Ordering errors** — hour comparisons in B1 puzzles that are reversed
- **Uniqueness failures** — puzzles with 0 or 2+ valid solutions (PRE / A1 / A2 levels)

#### Pre-commit hook

To run the validator automatically on every `git commit` that touches a puzzle file, install the hook once after cloning:

```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

> **Bypassing the hook:** `git commit --no-verify`

---

## Database scripts

| Command | Description |
|---|---|
| `pnpm db:push` | Apply schema changes to the database (no migration files) |
| `pnpm db:seed` | Seed languages, levels, and themes |
| `pnpm db:seed-puzzles` | Import puzzles from `content/puzzle/*.json` (skips existing) |
| `pnpm db:reseed-file en-b1.json` | Replace all puzzles from a file (delete + re-insert) |
| `pnpm db:reseed-puzzle "Title"` | Replace one or more puzzles by title |
| `pnpm db:studio` | Open Prisma Studio (database GUI) |

---

## Adding new puzzle content

### 1. Create or edit a JSON file

Puzzle files live in `content/puzzle/` and follow the naming convention:

```
<language-code>-<level-code>.json
```

Examples: `en-a1.json`, `en-b1.json`, `es-a1.json`, `en-b1-clothing.json`

The filename is not significant — the script reads **all** `*.json` files in the folder. You can split content across multiple files per level (e.g. one file per theme). The `levelCode` and `languageCode` fields inside each puzzle determine where they appear in the app.

### 2. JSON format

Each file contains a `puzzles` array. See `content/puzzle_example.json` for a full annotated example.

Key rules:
- **`themeSlug`** must be unique across all files. Format: `<theme-name>-<N>` (e.g. `clothing-1`, `animals-and-colors-3`). The script derives the theme name from it by stripping the trailing number.
- **`clueType`** valid values: `positive`, `negative`, `relational`, `conditional`, `implicit`
- **`solution`** must include a cell for every row/col item combination (`YES` or `NO`)

### 3. Run the seed script

```bash
pnpm db:seed-puzzles
```

The script is **idempotent** — puzzles that already exist (matched by title + theme) are skipped. Only new entries are inserted.

Output example:
```
Processing en-b1.json...
  ✦ Created theme: "jobs and professions" (en B1)
  ✓ Inserted: "Jobs and routines (1)" (jobs-1)
  · Skipped:  "Clothing (1)" (already exists)

Done. 1 inserted, 1 skipped.
```

### 4. Adding a new language or level

No code changes needed. Just:

1. Run `pnpm db:seed` — it already seeds all languages (`en`, `es`) and levels (`A1`→`C2`)
2. Drop your JSON file in `content/puzzle/` (e.g. `es-a1.json`)
3. Run `pnpm db:seed-puzzles`

Themes are auto-created if they don't exist yet.

---

## Project structure

```
app/
  [lang]/
    [level]/
      page.tsx          # Puzzle list for a level
    puzzle/[id]/
      page.tsx          # Puzzle player
    layout.tsx
  api/progress/         # Progress save endpoint
  login/                # Login page
  page.tsx              # Root redirect
components/
  PuzzleGrid.tsx        # Interactive logic grid
  PuzzlePlayer.tsx      # Full puzzle UI (filters, timer, modals)
  TutorialOverlay.tsx   # Onboarding tutorial
  ClueList.tsx          # Clue renderer with audio chips
  ClueWord.tsx          # Clickable word → Web Speech API
  EmojiHeader.tsx       # Grid header with emoji + label
  LevelBadge.tsx        # A1/B2/etc. badge
content/
  puzzle/               # Puzzle JSON files
  puzzle_example_json.json  # Annotated example for content generation
hooks/
  useAudio.ts           # Web Speech API hook
lib/
  prisma.ts             # Prisma client singleton
  auth.ts               # Auth placeholder (freeCodeCamp OAuth)
  filters.ts            # Filter context helpers
  puzzle.ts             # Puzzle data fetching
prisma/
  schema.prisma         # Full database schema
  seed.ts               # Base seed (languages, levels, themes)
scripts/
  seed-puzzles.ts          # Puzzle importer (skips existing)
  reseed.ts                # Puzzle replacer (reseed-file / reseed-puzzle)
  validate_puzzles.py      # Puzzle structure, clue logic and uniqueness validator
  pre-commit-hook.sh       # Git pre-commit hook installer
```

---

## Auth

Auth is not yet implemented. `lib/auth.ts` contains a placeholder for freeCodeCamp OAuth. Pages that require a user currently use a hardcoded `placeholder-user` ID.

See `project_scope.md §9` for open questions to resolve with the fCC team before implementing.
