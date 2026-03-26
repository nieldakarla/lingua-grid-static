# LinguaGrid — Tutorial Brief

We need to build an interactive onboarding tutorial that teaches new users how to play LinguaGrid.

---

## Overview

Two sequential tutorials, each using a hardcoded puzzle. They appear automatically on first visit (localStorage flag `tutorial_completed`). A "Skip" button is always visible. After completing or skipping, both tutorials remain accessible via a "How to play" option in the menu.

---

## Behavior

- On first visit: Tutorial 1 starts automatically
- After Tutorial 1 completes: Tutorial 2 starts immediately
- After both complete: set `localStorage.setItem('tutorial_completed', 'true')`
- On subsequent visits: skip tutorials, go straight to the app
- "Skip" button: visible at all times during tutorial — skips both tutorials and sets the flag
- Menu item "How to play": resets tutorial state and replays from Tutorial 1

---

## UI Pattern

Each tutorial step shows:
- A **modal/tooltip at the top** of the screen with instructional text
- The **puzzle grid below**, partially dimmed except for the highlighted cell(s)
- The **clues below the grid**, with the active clue highlighted
- A **hand cursor animation** pointing to the target cell

The user must interact with the correct cell to advance — the tutorial does not auto-advance. If the user clicks the wrong cell, nothing happens.

---

## Tutorial 1 — Learning the mechanics

**Purpose:** teach the user how to click cells (empty → ✗ → ✓) and understand auto-fill.

**Hardcoded puzzle:**
```
Categories:
  - Animals:  cat 🐱, dog 🐶, bird 🐦
  - Colors:   red 🔴, blue 🔵, green 🟢
  - Numbers:  one 1️⃣, two 2️⃣, three 3️⃣

Clues:
  1. 🐱 The cat is red.
  2. 🐶 The dog is not green.
  3. 🔵 The blue animal has number two.

Solution:
  cat  = red  = one
  dog  = blue = two
  bird = green = three
```

**Steps:**

| Step | Modal text | Action required |
|------|-----------|-----------------|
| 1 | "LinguaGrid is a logic puzzle game that helps you practice a new language. Read the clues and fill in the grid." | Tap OK |
| 2 | "The goal is to find the unique match between all categories. Each item belongs to exactly one item in every other category." | Tap OK |
| 3 | "The first clue says 🐱 The cat is red. Click the cell where cat meets red to mark it as YES." | Click cat×red cell (2 clicks: first = ✗, second = ✓) |
| 4 | "Notice how the other cells filled in automatically. When you find a match, the rest are eliminated." | Tap OK |
| 5 | "The second clue says 🐶 The dog is not green. Click dog×green to mark it as NO." | Click dog×green once (= ✗) |
| 6 | "Now use what you know. The blue animal has number two. Can you find who is blue? Mark it!" | User solves remaining cells freely |
| 7 | Puzzle complete → confetti + "Well done! Tutorial 1 complete." | Tap Continue → Tutorial 2 starts |

---

## Tutorial 2 — Learning deduction across sub-grids

**Purpose:** teach the user how to use the exclusion method and make inferences across sub-grids.

**Hardcoded puzzle:**
```
Categories:
  - Animals:  cat 🐱, dog 🐶, bird 🐦
  - Colors:   red 🔴, blue 🔵, green 🟢
  - Habitats: house 🏠, tree 🌳, water 💧

Clues:
  1. 🐶 The dog is red.
  2. 🔵 The blue animal lives in the water.
  3. 🐦 The bird is not in the house.

Solution:
  cat  = blue  = water
  dog  = red   = house
  bird = green = tree
```

**Steps:**

| Step | Modal text | Action required |
|------|-----------|-----------------|
| 1 | "Solving puzzles is easy when you use logical thinking. Let's learn how!" | Tap OK |
| 2 | "The first clue says 🐶 The dog is red. Mark it!" | Click dog×red = ✓ |
| 3 | "Notice the auto-fill. Now the second clue: 🔵 The blue animal lives in the water. Mark blue×water in the colors-habitats sub-grid." | Click blue×water = ✓ |
| 4 | "Now make a logical connection. The cat is blue — we know this because dog is red and bird is green. And blue lives in water. So... the cat lives in water! Mark it." | Click cat×water = ✓ |
| 5 | "This is the exclusion method — conclusions in one sub-grid unlock answers in another. Try to finish the rest!" | User solves remaining cells freely |
| 6 | Puzzle complete → confetti + "You're ready to play! Good luck." | Tap Continue → enters the app |

---

## Technical notes

- Tutorial puzzles are **hardcoded in the component** — not fetched from the database
- The grid component used in the tutorial is the **same `PuzzleGrid` component** used in the app, with an added `tutorialStep` prop that controls which cell is highlighted and which cells are interactive
- `tutorialStep` prop: when set, all cells except the target cell are non-interactive and slightly dimmed
- The hand cursor animation is a simple CSS animation on an absolutely positioned element pointing to the target cell coordinates
- Confetti: use the one we already have.
- localStorage key: `linguagrid_tutorial_completed` = `'true'`

---

## Out of scope for this implementation

- Audio during tutorial (user discovers word click on their own)
- Tutorial for the filter dropdowns
- Tutorial localization (English only for now — same tutorial for all languages)
