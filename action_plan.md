# LinguaGrid — Action Plan
> Finish each step before moving to the next. Fix problems as they appear, then resume.

---

## ✅ Phase 1 — Initial scaffold (Prompts 1–13, complete)

All 13 prompts done. App working with: Next.js 14 App Router, TypeScript, Tailwind CSS (fCC design system), Prisma + Supabase, puzzle JSON pipeline, interactive 2-category grid, dashboard, placeholder auth, landing page, Web Speech API audio, UserProgress tracking.

Git initialized, pushed to github.com/nieldakarla/lingua-grid (private). Working branch: `redesign`.

---

## 🔄 Phase 2 — Refactor 01 (branch: redesign)

Reference document: `project_refactoring_01.md`

### Step 1 — Prisma schema update ✅
- `Story` model and `storyId` on `Puzzle` were already in the schema
- `SolutionCell` uses many-to-many with `Item[]` — functionally equivalent to `itemIds String[]`, no change needed
- Seed ran successfully with 11 A1 puzzles + 9 A2 puzzles (3-category format)

### Step 2 — Seed scripts update ⬜
- Update `scripts/seed-puzzles.ts` for new JSON format:
  - `solution` uses `itemLabels[]` instead of `rowItemLabel/colItemLabel`
  - N categories supported (not hardcoded to 2)
  - Only YES cells in JSON — script infers all NO cells
- Update `scripts/validate-puzzle.ts` for new format
- **Waiting on:** new `en-a1.json` and `en-a2.json` from user (3-category format)

### Step 3 — PuzzleGrid rewrite ⬜
- Support N categories
- Classic logic grid layout:
  - Columns: first N-1 categories
  - Rows: last N-1 categories
  - Blocked cells: where a category meets itself (bottom-right area)
- Auto-fill on YES: mark other cells in same row/col of sub-grid as NO (auto)
- Auto-filled NO visually distinct from manual NO (lower opacity)
- Auto-filled cells not clickable
- Horizontal scroll on mobile

### Step 4 — New main page layout ⬜
- Delete: `/[lang]/dashboard`, `/[lang]/[level]` pages
- Delete: `middleware.ts` (no forced auth)
- `app/page.tsx` → server redirect to first en/A1 puzzle
- New route: `/[lang]/puzzle/[id]/page.tsx`
- Layout:
  - Header: fCC · LinguaGrid + "Log in to save progress" button
  - Filter bar: Language ▼ · Level ▼ · Category ▼ · X/Y
  - Puzzle title + timer
  - PuzzleGrid
  - ClueList (with "play all" button)
  - Grammar note (shown after completion)
  - Footer: dot progress indicators + Check answer + Next puzzle
- Filter cascade logic: Language → Level → Category → first incomplete puzzle

### Step 5 — Progress: localStorage fallback ⬜
- No session cookie → save `lg_completed` to localStorage (array of puzzleId)
- Session cookie present → POST /api/progress as before
- PuzzlePlayer unifies both paths
- Dot indicators in footer read from same unified source

### Step 6 — Assets ✅
- SVG icons added to `public/icons/`: play_circle, timer, arrow_forward, arrow_right, check, chevron_right, keyboard_arrow_down, lock_24dp, lamp, arrow_drop_down

### Step 7 — Full flow test ✅
- JSON files (en-a1.json, en-a2.json) updated to 3-category format (Animals/Colors/Habitats)
- Full flow tested during redesign: land → filter → solve → modal → confetti → next puzzle
- localStorage fallback working
- TypeScript errors resolved

---

## After Phase 2 — Before going live

- [ ] Replace placeholder auth with freeCodeCamp OAuth
- [ ] Run `scripts/validate-puzzle.ts` on all puzzles
- [ ] Deploy to Vercel (or fCC infrastructure)
