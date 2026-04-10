# Puzzle Authoring Guide

Everything you need to create and validate LinguaGrid puzzles.

---

## Level specs

| Level | Grid size | Categories | Items per cat | Solution format |
|---|---|---|---|---|
| PRE | 5 | 2 | 5 | explicit YES/NO pairs |
| A1 | 3 | 3 | 3 | YES triples |
| A2 | 4 | 3 | 4 | YES triples |
| B1 | 5 | 3 | 5 | YES triples |

---

## JSON structure

```json
{
  "puzzles": [
    {
      "title": "Short Title (N)",
      "themeSlug": "Theme-Name",
      "levelCode": "A1",
      "languageCode": "pt",
      "gridSize": 3,
      "narrativeIntro": null,
      "grammarFocus": ["label1", "label2"],
      "categories": [
        { "label": "Pessoas", "emoji": "👥", "order": 0 },
        { "label": "Animais", "emoji": "🐾", "order": 1 },
        { "label": "Cores",   "emoji": "🎨", "order": 2 }
      ],
      "items": [
        { "categoryIndex": 0, "label": "Ana",  "emoji": "👩" },
        { "categoryIndex": 1, "label": "gato", "emoji": "🐱" },
        { "categoryIndex": 2, "label": "azul", "emoji": "🔵" }
      ],
      "clues": [
        { "text": "Ana tem o gato.", "clueType": "positive" }
      ],
      "solution": [
        { "itemLabels": ["Ana", "gato", "azul"], "value": "YES" }
      ],
      "grammarNote": "One short paragraph. Use \"quoted forms\" to highlight the target structure."
    }
  ]
}
```

### Solution formats

**A1/A2/B1** — one YES triple per row, NOs inferred automatically:
```json
{ "itemLabels": ["Ana", "gato", "azul"], "value": "YES" }
```

**PRE** — every cell explicit:
```json
{ "rowItemLabel": "Ana", "colItemLabel": "gato", "value": "YES" }
{ "rowItemLabel": "Ana", "colItemLabel": "peixe", "value": "NO" }
```

---

## Clue types

| Type | Meaning | Example |
|---|---|---|
| `positive` | A and B are in the same row | "Ana tem o gato." |
| `negative` | A and B are NOT in the same row | "Ana não tem o gato." |
| `relational` | Connects two items indirectly | "Quem tem o gato mora no Rio." |

---

## Clue quality rules

### Pair coverage
Every pair of categories must be touched by at least one clue. With 3 categories A, B, C:
- At least one clue must mention items from A and B
- At least one clue must mention items from B and C
- At least one clue must mention items from A and C

The validator warns when a pair has zero clue coverage.

### Uniqueness
The puzzle must have **exactly one valid solution**. The validator checks this automatically for English puzzles. For other languages, verify manually using brute force before committing.

### No fixed clue count
Use as many clues as needed to make the puzzle unique and engaging — the goal is language practice, not minimalism. Redundant clues are fine.

### Avoid redundant negatives
A negative clue is redundant if the solution is already forced by other clues. The validator warns on detected redundancies.

---

## Grammar note rules

- One paragraph only, no bullet lists
- Highlight the target grammar structure using `"quoted forms"`
- Show a concrete example from the puzzle's own clues
- Keep it short — 1–3 sentences

**Good:**
> Use "a matéria de terça é história" para ligar dia e disciplina. Positivas diretas fixam a pessoa: "Léo estuda na quarta".

**Avoid:**
> - Use subject + verb
> - Negatives use "não"
> - ...

---

## Portuguese-specific notes

### Verb forms in clues
Item labels should be **infinitives** (correr, ler, dormir). Clue text may use conjugated forms — this is intentional for language learning, but be aware the validator's pair-coverage check uses label matching and may miss these pairs (known limitation).

### Gender neutrality
Avoid combinations where gender agreement telegraphs the answer. For example, pairing female names with feminine professions (médica, engenheira) makes the answer obvious without reading the clues. Prefer:
- Gender-neutral categories (lugares, objetos, horários)
- Mixed-gender item sets where gender doesn't map 1:1 to the solution

### Clue phrasing
- Use complete sentences — learners are practicing reading, not just decoding
- Prefer "A consulta de João é com o médico" over "João é com o médico"
- For exams/activities: "Rui faz exame de urina" not "Rui faz urina"

---

## Naming conventions

### Filenames
```
<lang>-<level>.json            # pt-a2.json
<lang>-<level>-<theme>.json    # en-a1-pre.json
```

### `themeSlug`
Title Case, no numbers unless disambiguating: `Trabalho`, `Saúde`, `Animais`

### `title`
Short description + sequential number: `Rotina Diária (1)`, `Amigo Secreto (2)`

---

## Validator

```bash
# Validate all files
python3 scripts/validate_puzzles.py

# Validate a single file
python3 scripts/validate_puzzles.py content/puzzle/pt-a2.json
```

Errors (❌) block the pre-commit hook. Warnings (⚠️) are informational only.

| Check | Severity | Notes |
|---|---|---|
| Structure (gridSize, categoryCount, solution) | ❌ error | |
| Clue contradictions | ❌ error | English only (regex-based) |
| Numeric ordering (B1 hours) | ❌ error | |
| Uniqueness | ❌ error | English only — verify non-English manually |
| Pair coverage | ⚠️ warning | Works for any language |
