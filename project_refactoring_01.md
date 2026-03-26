# LinguaGrid — Refactor Brief

We are refactoring the existing LinguaGrid app on a new branch. The app is already working with 2-category grids, clues, progress tracking, dashboard, and placeholder auth. This document describes exactly what needs to change and why.

---

## What stays the same

- Auth placeholder system
- User progress tracking logic (save/read completions)
- Seed script structure
- Next.js routing
- Supabase/Prisma setup
- Web Speech API audio hook

---

## What changes

### 1. Database schema — `SolutionCell` redesign

The current `SolutionCell` model crosses `rowItemId × colItemId` (2 categories only). We need to support N categories.

**Replace `SolutionCell` with:**

```prisma
model SolutionCell {
  id         String  @id @default(cuid())
  solutionId String
  solution   Solution @relation(fields: [solutionId], references: [id])
  itemIds    String[] // array of item IDs, one per category pair being crossed
  value      CellValue // YES or NO
}
```

Also add to `Puzzle`:
```prisma
storyId    String?   // optional, for future story mode
story      Story?    @relation(fields: [storyId], references: [id])
```

And add:
```prisma
model Story {
  id       String   @id @default(cuid())
  title    String
  puzzles  Puzzle[]
}
```

After schema changes: `npx prisma migrate reset` — we are resetting because there are no real users yet, only seed data.

---

### 2. PuzzleGrid component — full rewrite

The current component only handles 2 categories. Rewrite to support N categories using the classic logic grid layout:

- Column headers grouped by category (with category label spanning above)
- Row headers grouped by category (with category label on the side)
- Sub-grids for each pair of categories that are not the same
- Diagonal/self-referential cells are blocked (grayed out, not clickable)
- Each cell cycles: empty → YES (✓ green) → NO (✗ red) → empty on click
- **Auto-fill on YES:** when a cell is marked YES, all other cells in the same row AND same column within that sub-grid are automatically marked NO (dimmer red, visually distinct from manual NO). This is standard logic grid behavior — if cat=blue, then cat≠red and cat≠green are auto-filled, and dog≠blue and frog≠blue are also auto-filled
- Auto-filled NO cells are visually distinct from manually marked NO: use lower opacity (e.g. 40% vs 100%) so the user can tell what they deduced vs what was auto-filled
- Clicking an auto-filled cell does nothing — only manual YES cells can be cleared
- **Grid orientation — important:** the blocked area must be in the BOTTOM-RIGHT corner. Layout is:
  - Column headers (top): first N-1 categories left to right (e.g. Animals | Colors)
  - Row headers (left): last N-1 categories top to bottom (e.g. Colors | Habitats)
  - Top-left corner: empty
  - Top-right blocked: where a category's rows meet its own columns (e.g. Colors rows × Colors columns)
  - Bottom-right blocked: where the last row category meets the last column category already covered above (e.g. Habitats rows × Colors columns)
  - Bottom-left: fully interactive (e.g. Habitats rows × Animals columns)
  - See attached mockup screenshot and reference game screenshot for exact layout
- Responsive: horizontal scroll on small screens

See the attached mockup screenshot for the target layout. The grid shows Animals × Colors × Habitats as an example — 3 categories, each with 3 items.

---

### 3. Page layout — full redesign

Replace the current multi-page flow (landing → login → dashboard → category → puzzle) with a single-page experience. The user lands directly on a puzzle.

**New layout (top to bottom):**

```
┌─────────────────────────────────────────────┐
│ freeCodeCamp · LinguaGrid    [Log in to save]│  ← header
├─────────────────────────────────────────────┤
│ [Language ▼]  [Level ▼]  [Category ▼]  3/9  │  ← filter bar
├─────────────────────────────────────────────┤
│                                             │
│  Puzzle title                    ⏱ timer   │
│                                             │
│  [Multi-category grid]                      │  ← grid
│                                             │
│  Clues                    [▶ play all]      │  ← clues
│  1. 🐱 The cat is not red.                  │
│  2. 🐸 The frog is blue.                    │
│  (clickable words → pronounce word)         │
│                                             │
│  [Grammar note — shown after completion]    │
│                                             │
├─────────────────────────────────────────────┤
│ ● ● ○ ○ ○  3/9 · A1 English  [Check] [Next]│  ← footer
└─────────────────────────────────────────────┘
```

**Filter dropdowns — cascade logic:**
- Language dropdown: shows only languages that have puzzles in the database
- Level dropdown: shows only levels available for the selected language
- Category dropdown: shows only categories available for selected language + level
- Changing any filter loads the first incomplete puzzle in that selection, or the first puzzle if all are complete

**Login:**
- Not required to play
- Button in header: "Log in to save progress"
- Without login: progress saved in localStorage
- With login: progress synced to database (placeholder for now)

**Puzzle navigation:**
- Footer shows dot indicators for puzzles in current category
- Completed puzzles show green dot
- "Next puzzle" suggests the next incomplete one
- User can also change category/level via dropdowns at any time

**Completed puzzle state:**
- Grid cells locked (no more clicking)
- Grammar note appears below clues
- "Next puzzle →" button becomes primary CTA

---

### 4. JSON puzzle format — update for N categories

The current format has 2 categories. Update to support N:

```json
{
  "title": "Animals — colors and habitats (1)",
  "themeSlug": "animals-colors-habitats-1",
  "levelCode": "A1",
  "languageCode": "en",
  "gridSize": 3,
  "narrativeIntro": null,
  "grammarFocus": ["nouns", "adjectives", "verb to be", "prepositions"],
  "categories": [
    { "label": "Animals",  "emoji": "🐾", "order": 0 },
    { "label": "Colors",   "emoji": "🎨", "order": 1 },
    { "label": "Habitats", "emoji": "🌍", "order": 2 }
  ],
  "items": [
    { "categoryIndex": 0, "label": "cat",   "emoji": "🐱" },
    { "categoryIndex": 0, "label": "dog",   "emoji": "🐶" },
    { "categoryIndex": 0, "label": "frog",  "emoji": "🐸" },
    { "categoryIndex": 1, "label": "red",   "emoji": "🔴" },
    { "categoryIndex": 1, "label": "green", "emoji": "🟢" },
    { "categoryIndex": 1, "label": "blue",  "emoji": "🔵" },
    { "categoryIndex": 2, "label": "house", "emoji": "🏠" },
    { "categoryIndex": 2, "label": "tree",  "emoji": "🌳" },
    { "categoryIndex": 2, "label": "water", "emoji": "💧" }
  ],
  "clues": [
    { "text": "🐱 The cat is not red.", "clueType": "negative" },
    { "text": "🐸 The frog is blue.",   "clueType": "positive" },
    { "text": "🔵 The blue animal lives in the water.", "clueType": "relational" },
    { "text": "🐶 The dog does not live in a house.",   "clueType": "negative" }
  ],
  "solution": [
    { "itemLabels": ["cat",  "blue",  "tree"],  "value": "YES" },
    { "itemLabels": ["dog",  "red",   "water"], "value": "YES" },
    { "itemLabels": ["frog", "green", "house"], "value": "YES" }
  ],
  "grammarNote": "Adjectives follow 'to be' directly: 'The frog is blue.' No article before the color."
}
```

Note: `solution` now uses `itemLabels` (array of one label per category) instead of `rowItemLabel / colItemLabel`. Only YES cells need to be listed — the seed script infers all NO cells.

---

### 5. Dashboard → removed as separate page

The dashboard page is removed. Navigation happens entirely through the filter dropdowns on the main page. No separate route needed.

---

## Order of work

1. Update Prisma schema + `migrate reset`
2. Update seed script to handle new JSON format + new `SolutionCell` structure
3. Rewrite `PuzzleGrid` component
4. Redesign main page layout with filter bar + new grid + clues + footer
5. Update localStorage progress logic to match new puzzle IDs
6. Test full flow: land on page → filter → solve → check → next puzzle

---

## Out of scope for this refactor

- Story mode (schema supports it via `storyId`, but no UI)
- Teacher dashboard
- Real auth (placeholder stays)
- New puzzle content (existing JSON files will be updated separately)