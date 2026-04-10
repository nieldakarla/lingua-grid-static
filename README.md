# LinguaGrid

Language learning through logic grid puzzles. Players read clues in the target language, reason about relationships, and fill in a grid — learning vocabulary and grammar through deduction.

---

## Stack

- **Next.js 14** (App Router, static export) + TypeScript
- **Tailwind CSS**
- Puzzle data loaded from **JSON files** at build time — no database required

---

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:4321](http://localhost:4321).

| URL | What you'll find |
|---|---|
| `http://localhost:4321` | Redirects to first available puzzle |
| `http://localhost:4321/en/puzzle/<id>` | English puzzle player |
| `http://localhost:4321/pt/puzzle/<id>` | Portuguese puzzle player |

---

## Languages and levels

| Language | Levels available |
|---|---|
| English (`en`) | PRE, A1, A2, B1 |
| Portuguese (`pt`) | PRE, A1, A2 |

Switching languages in the filter bar preserves your position in the puzzle list.

---

## Adding new puzzle content

### 1. Create or edit a JSON file

Puzzle files live in `content/puzzle/` following the naming convention:

```
<language-code>-<level-code>.json          # e.g. pt-a2.json
<language-code>-<level-code>-<theme>.json  # e.g. en-a1-pre.json
```

The filename is not significant — all `*.json` files in the folder are loaded. The `levelCode` and `languageCode` fields inside each puzzle determine where they appear in the app.

### 2. JSON format

Each file contains a `puzzles` array. Key fields per puzzle:

```json
{
  "title": "Short Title (1)",
  "themeSlug": "Theme-Name",
  "levelCode": "A1",
  "languageCode": "pt",
  "gridSize": 3,
  "categories": [{ "label": "Pessoas", "emoji": "👥", "order": 0 }],
  "items": [{ "categoryIndex": 0, "label": "Ana", "emoji": "👩" }],
  "clues": [{ "text": "Ana tem o gato.", "clueType": "positive" }],
  "solution": [{ "itemLabels": ["Ana", "gato", "azul"], "value": "YES" }],
  "grammarNote": "Optional grammar note shown after solving."
}
```

**`clueType`** valid values: `positive`, `negative`, `relational`

**`solution`** format:
- **A1/A2** (3 categories): array of `{ "itemLabels": [...], "value": "YES" }` — one YES triple per row
- **PRE** (2 categories): explicit `{ "rowItemLabel": "...", "colItemLabel": "...", "value": "YES|NO" }` for every cell

### 3. Validate before committing

```bash
python3 scripts/validate_puzzles.py              # validate all files
python3 scripts/validate_puzzles.py pt-a2.json  # validate a single file
```

The validator checks:

- **Structural errors** — gridSize mismatch, duplicate items in solution, unknown item labels
- **Category count** — must match level config (PRE: 2, A1/A2: 3)
- **Clue contradictions** — negative or positive clue that contradicts the solution
- **Ordering errors** — reversed hour comparisons (B1)
- **Uniqueness** — puzzles with 0 or 2+ valid solutions (English puzzles only — see note below)

#### Pre-commit hook

If you cloned the repo fresh, install the hook once:

```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

The hook runs the validator automatically on every `git commit` that touches a `content/puzzle/*.json` file. Bypass with `git commit --no-verify`.

### 4. Adding a new language

1. Add the language name in `lib/puzzles-static.ts` → `LANGUAGE_NAMES`
2. Add UI translations in `lib/translations.ts`
3. Drop your JSON files in `content/puzzle/`

No other code changes needed.

---

## Puzzle uniqueness

For **English** puzzles, the validator parses clue text with regex patterns to extract constraints, then counts valid solutions via brute force. Any puzzle with 2+ solutions fails the check.

For **other languages**, clue text parsing is not yet supported. Verify uniqueness manually before committing — the brute-force approach used in previous sessions enumerates all permutations and confirms exactly one satisfies the solution structure.

---

## Project structure

```
app/
  [lang]/
    puzzle/[id]/
      page.tsx          # Puzzle player page
    layout.tsx          # Per-language layout (sets html lang)
    page.tsx            # Redirects /[lang] to first puzzle
  page.tsx              # Root redirect to first English puzzle
components/
  PuzzleGrid.tsx        # Interactive logic grid
  PuzzlePlayer.tsx      # Full puzzle UI (filters, timer, modals)
  TutorialOverlay.tsx   # Onboarding tutorial
  ClueList.tsx          # Clue renderer with audio playback
  ClueWord.tsx          # Clickable word → Web Speech API
  EmojiHeader.tsx       # Grid header with emoji + label
  LangSync.tsx          # Sets document.documentElement.lang on the client
content/
  puzzle/               # Puzzle JSON files (source of truth)
hooks/
  useAudio.ts           # Web Speech API hook (supports pt-BR, en-US)
lib/
  puzzles-static.ts     # Loads and indexes all puzzle JSON at build time
  translations.ts       # UI string translations (en, pt)
scripts/
  validate_puzzles.py   # Puzzle validator (structure, logic, uniqueness)
  pre-commit-hook.sh    # Git pre-commit hook script
```
