# LinguaGrid — Project Scope Document
> Language learning through logic grid puzzles | A freeCodeCamp constelation project

---

## 1. Project Overview

LinguaGrid is a web application that teaches foreign languages through logic grid puzzles. Players read clues written in the target language, reason about relationships between categories, and fill in a grid — learning vocabulary, grammar, and cultural context through deduction rather than rote memorization.

**Key differentiator:** The puzzle format forces active reading comprehension. The learner cannot guess randomly — they must understand the clues to solve the puzzle.

---

## 2. MVP Scope

### 2.1 Languages
- **English** — launch language
- **Spanish** — first expansion post-launch (Phase 2)
- **Portuguese, Japanese, Chinese, Korean** — future phases

The puzzle engine is language-agnostic — grid logic, interaction, validation, and progress tracking are identical regardless of language. Adding a new language is a content task, not a code change.

Puzzle content is authored independently per language, not translated. Each language has its own puzzles designed around its specific grammar challenges. Themes (e.g. "family", "food") can be shared across languages, but clues, items, and grammar focus are written from scratch for each language.

### 2.2 Levels for launch
- A1 and A2 fully populated with puzzles
- Architecture supports B1 → C2 (added in future iterations)

### 2.3 Users
- **Independent learner** (full UI — MVP target)
  - Registers / logs in via freeCodeCamp OAuth
  - Chooses language and level
  - Solves puzzles
  - Tracks personal progress
- **Teacher** (no UI in MVP — architecture only)
  - Data model supports teacher accounts, classrooms, puzzle assignment
  - No frontend built until Phase 2

---

## 3. Puzzle Design Specification

### 3.1 Grid format
A logic grid puzzle presents N categories, each with N items. The player marks YES/NO in the intersection cells to find the unique one-to-one mapping.

| Level | Grid size | Clue language | Visual aids | Avg. solve time |
|-------|-----------|---------------|-------------|-----------------|
| A1 | 3×3 | Single words + emoji | Emoji + color | 2–4 min |
| A2 | 3×3 or 4×4 | Short phrases | Emoji optional | 3–6 min |
| B1 | 4×4 | Full sentences, narrative intro | None | 5–10 min |
| B2 | 4×4 or 5×5 | Complex sentences, implicit clues | None | 10–15 min |
| C1 | 5×5 | Rich text, cultural nuance | None | 15–25 min |
| C2 | 5×5+ | Idiomatic, ironic, literary | None | 20–40 min |

### 3.2 A1 puzzle structure (visual-first)
- Categories use emoji + target-language word (e.g. 🐱 cat / 🐱 gato)
- Clues use pattern: `[emoji] The [noun] is [adjective].` or `[emoji] The [noun] is not [adjective].`
- Grid headers show emoji + word
- No native language shown — comprehension scaffolded by visuals
- Max 3 unknown words per puzzle

### 3.3 A2 puzzle structure
- Short sentences: "She has a cat." / "He doesn't like coffee."
- Introduces pronouns, basic verb conjugation (has/have, is/are, likes/doesn't like)
- Emoji used only for category headers, not in clues
- Max 5 unknown words per puzzle

### 3.4 Clue types (all levels)
1. **Positive direct** — "The cat is green."
2. **Negative direct** — "The cat is not blue."
3. **Relational** — "The doctor lives next to the baker." (B1+)
4. **Conditional** — "If the engineer likes cooking, then Ben is not the engineer." (B2+)
5. **Implicit/cultural** — clue requires cultural knowledge to interpret (C1+)

### 3.5 Themes by level
**A1:** colors & shapes, numbers 1–10, animals, family members, basic food, body parts, places in town, basic weather, vehicles, furniture
**A2:** clothing, days & months, rooms in a house, classroom objects, telling the time, shopping & prices, eating out, feeling ill, sports & exercise, pets & care, celebrations & holidays, countries & flags
**B1:** jobs & professions, daily routines, hobbies & interests, transport & travel, nationalities & languages, neighbourhood, movies & genres, cooking & recipes, nature & seasons, school & university, fashion & style, social media & apps
**B2:** travel & tourism, health & medicine, environment & climate, relationships & emotions, news & media, money & finance, sports & competition, science & discovery, city life vs countryside, technology & gadgets, theatre & performing arts, art & design
**C1:** psychology & behaviour, urban planning & architecture, law & justice, music & composers, climate & sustainability, food culture & gastronomy, gaming & virtual worlds, literature & storytelling, ancient civilisations, innovation & startups, festivals & cultural events
**C2:** regional dialects & slang, mythology & folklore, historical turning points, satire & irony, rhetoric & persuasion, comedy & stand-up culture, globalisation & identity, media & propaganda, cultural heritage & preservation, ethics in science

### 3.6 Grammar focus per level

Each puzzle is tagged with its primary grammar target. Targets are language-specific — not every language has the same challenges at the same level.

| Level | English | Spanish |
|-------|---------|---------|
| A1 | Nouns, adjectives, "to be" | Nouns + gender (el/la), ser vs estar, adjective agreement |
| A2 | "To have", simple present, negation, pronouns | Tener, present tense conjugation, gender in sentences |
| B1 | Simple past, present continuous, comparatives | Preterite vs imperfect, reflexive verbs, por vs para |
| B2 | Conditionals (1st & 2nd), passive voice | Subjunctive (present), conditional tense |
| C1 | Perfect tenses, reported speech, conditionals (3rd) | Subjunctive (past), complex reported speech |
| C2 | Nuance, register, idiomatic usage | Regional variation, idiomatic expressions, register |

> **Design principle:** when a grammar feature is unique to a language (e.g. ser/estar in Spanish, grammatical gender), at least one puzzle per level should foreground that feature — it cannot be replicated by translating an English puzzle.

---

## 4. Technical Architecture

### 4.1 Recommended stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** freeCodeCamp OAuth (JWT)
- **Hosting:** Vercel (or self-hosted)
- **Fonts:** Noto Sans (covers Latin, CJK, Arabic for future languages)
- **Audio:** Web Speech API (MVP) → ElevenLabs API (Phase 2)

### 4.2 Database schema (simplified)

```
User
  id, fccUserId, email, createdAt
  → has many UserProgress
  → has many (future) ClassroomMembership

Language
  id, code (en/es/zh/ja/ko), name, rtl (bool)

Level
  id, code (A1/A2/B1...), order

Theme
  id, name, languageId, levelId, tags[]

Puzzle
  id, themeId, languageId, levelId
  gridSize, title, narrativeIntro (nullable)
  grammarFocus[], culturalNote (nullable)
  createdBy (userId, nullable for system puzzles)

Category         ← a dimension of the grid (e.g. "animals")
  id, puzzleId, label, emoji (nullable), order

Item             ← one value in a category (e.g. "cat")
  id, categoryId, label, emoji (nullable), audioUrl (nullable)

Clue
  id, puzzleId, text, clueType, difficulty
  hintsTo[] (itemIds — for hint system, Phase 2)

Solution
  id, puzzleId
  → has many SolutionCell

SolutionCell
  id, solutionId, rowItemId, colItemId, value (YES/NO)

UserProgress
  id, userId, puzzleId, completedAt (nullable)
  attempts, timeSpentSeconds, hintsUsed

(Phase 2 — teacher layer)
Teacher
  id, userId

Classroom
  id, teacherId, name, languageId

ClassroomMembership
  id, classroomId, userId

Assignment
  id, classroomId, puzzleId, dueDate
```

### 4.3 Key frontend components

```
/app
  /[lang]                    ← language context (en, es, ...)
    /[level]                 ← level context (a1, a2, ...)
      /puzzle/[id]           ← puzzle player page
    /dashboard               ← user progress overview

/components
  PuzzleGrid                 ← main grid component (click YES/NO/empty)
  ClueList                   ← renders clues with word highlighting
  ClueWord                   ← individual word chip (click to hear audio)
  EmojiHeader                ← grid header with emoji + word
  LevelBadge                 ← A1/B2/etc. badge
  ProgressTracker            ← shows completion across puzzles
  LanguageSwitcher           ← changes active language
```

### 4.4 Pronunciation / audio
- Every `Item` and key `ClueWord` has an optional `audioUrl`
- MVP: use Web Speech API (`speechSynthesis`) — works for English and Spanish natively, zero cost
- Click any highlighted word in a clue → hear pronunciation
- Phase 2: pre-generate audio files via ElevenLabs for consistent quality

---

## 5. User Experience Flow

```
Landing page
  → "Start learning" CTA
  → Login with freeCodeCamp

Dashboard
  → Choose language (EN / ES)
  → Choose level (A1 / A2)
  → See puzzle themes available
  → See personal progress (X of Y completed)

Puzzle page
  → Narrative intro (B1+)
  → Clue list (words clickable for audio)
  → Interactive grid
  → "Check answer" button
  → Result: ✓ Correct (show grammar note) or ✗ Try again
  → "Next puzzle" CTA
```

---

## 6. Content Plan (MVP launch)

Minimum viable content to launch:

| Language | Level | Themes | Puzzles each | Total |
|----------|-------|--------|--------------|-------|
| English | A1 | colors+animals, family, food | 3 | 9 |
| English | A2 | clothing, weather, house | 3 | 9 |
| **Total** | | | | **18 puzzles** |

18 puzzles is enough to validate engagement and publish quickly. Themes and puzzle count expand in subsequent updates — the database structure supports unlimited themes per level with no code changes required.

### 6.1 AI-assisted content generation

All puzzles are generated by AI (Claude) and reviewed before publishing. This reduces authoring time from ~30 min/puzzle to ~5 min/puzzle (generation + human review).

**Generation pipeline:**

```
1. Define puzzle parameters
   → language, level, theme, grid size, grammar focus

2. Prompt Claude to generate
   → categories + items
   → solution grid (unique mapping)
   → clues (one per logical deduction step)
   → grammar note for post-solve screen
   → cultural note if applicable

3. Automated validation
   → verify solution is logically unique (no ambiguity)
   → verify each clue is necessary (no redundant clues)
   → check vocabulary is within CEFR level wordlist

4. Human review
   → native speaker checks naturalness of clues
   → approve / edit / reject

5. Seed into database
```

**Prompt template (to be stored in /content/prompts/):**

```
Generate a logic grid puzzle with the following parameters:
- Language: {language}
- CEFR level: {level}
- Theme: {theme}
- Grid size: {N}x{N}
- Grammar focus: {grammar_target}

Requirements:
- All vocabulary must be within {level} CEFR wordlist
- Clues must be written entirely in {language}
- Solution must be logically unique (only one valid answer)
- Include exactly {N*(N-1)} clues (minimum needed to solve)
- For A1/A2: use simple subject-verb-object structure only
- Return as JSON: { categories, items, solution, clues, grammarNote }
```

**Validation script** (`/scripts/validate-puzzle.ts`) should be built alongside the app to catch logical ambiguity before puzzles reach the database.

---

## 7. Phase Roadmap

### Phase 1 — MVP (this document)
- Next.js app, English only, A1 + A2
- freeCodeCamp login
- 18 puzzles (expandable without code changes)
- Web Speech API audio
- User progress tracking

### Phase 2 — Spanish + content expansion
- Spanish A1 + A2 (content only, no code changes needed)
- Additional themes per level in English
- B1 level for English
- Teacher dashboard
- Classroom management
- Puzzle assignment + due dates
- Student progress view
- Teacher can pick from puzzle pool by theme/level

### Phase 3 — Content expansion
- B1 and B2 levels
- Portuguese, French
- ElevenLabs audio (higher quality)
- Hint system

### Phase 4 — CJK languages
- Japanese (Hiragana + Romaji scaffolding)
- Chinese Simplified (Hanzi + Pinyin scaffolding)
- Korean (Hangul + Romanization scaffolding)
- Noto Sans CJK already in stack from day 1

### Phase 5 — Open source
- Public GitHub repository
- Contribution guide
- Community puzzle authoring tool
- Puzzle review/moderation workflow

---

## 8. Out of Scope (MVP)

- Character input / writing practice
- Spaced repetition system
- Leaderboards / gamification
- Mobile app (PWA-friendly but no native app)
- Community features
- Puzzle editor UI for teachers (Phase 2)
- Languages beyond English and Spanish

---

## 9. Open Questions (to resolve before build)

1. **freeCodeCamp OAuth** — confirm exact OAuth endpoint and token format with fCC team
2. **Content authoring** — who writes the 48 MVP puzzles? Internal team or AI-assisted generation?
3. **Hosting** — Vercel free tier or fCC infrastructure?
4. **Analytics** — which events to track? (puzzle started, completed, abandoned, time spent)
5. **Accessibility** — keyboard navigation for grid required from day 1?

---

*Document version: 0.1 — for planning purposes*
*To be used as Claude Code project brief*