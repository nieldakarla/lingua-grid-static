/**
 * lib/puzzles-static.ts
 *
 * Replaces Prisma/Supabase data access for the static build.
 * Reads puzzle JSON files directly from content/puzzle/ at build time.
 *
 * IDs are derived deterministically from the JSON data so they are
 * stable across builds (no DB auto-generated cuid).
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// JSON types (mirrors seed-puzzles format)
// ---------------------------------------------------------------------------

type SolutionRowLogic = { itemLabels: string[]; value: "YES" };
type SolutionRowSimple = { rowItemLabel: string; colItemLabel: string; value: "YES" | "NO" };

interface PuzzleJSON {
  title: string;
  themeSlug: string;
  levelCode: string;
  languageCode: string;
  gridSize: number;
  narrativeIntro: string | null;
  grammarFocus: string[];
  culturalNote?: string | null;
  categories: { label: string; emoji: string | null; order: number }[];
  items: { categoryIndex: number; label: string; emoji: string | null }[];
  clues: { text: string; clueType: string }[];
  solution: SolutionRowLogic[] | SolutionRowSimple[];
  grammarNote: string | null;
}

interface PuzzleFile {
  puzzles: PuzzleJSON[];
}

// ---------------------------------------------------------------------------
// Derived types used by the app
// ---------------------------------------------------------------------------

export interface StaticCategory {
  id: string;
  label: string;
  emoji: string | null;
  order: number;
}

export interface StaticItem {
  id: string;
  categoryId: string;
  label: string;
  emoji: string | null;
}

export interface StaticClue {
  id: string;
  text: string;
  clueType: string;
}

export interface StaticPuzzle {
  id: string;
  title: string;
  themeId: string;
  themeName: string;
  languageId: string;
  languageCode: string;
  languageName: string;
  levelId: string;
  levelCode: string;
  levelOrder: number;
  gridSize: number;
  grammarNote: string | null;
  categories: StaticCategory[];
  items: StaticItem[];
  clues: StaticClue[];
  solutionMap: Record<string, "YES" | "NO">;
}

// ---------------------------------------------------------------------------
// Stable ID generation
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function puzzleId(languageCode: string, levelCode: string, title: string): string {
  return `${languageCode}-${levelCode.toLowerCase()}-${slugify(title)}`;
}

function categoryId(puzzleId: string, label: string): string {
  return `${puzzleId}__cat__${slugify(label)}`;
}

function itemId(catId: string, label: string): string {
  return `${catId}__${slugify(label)}`;
}

function clueId(puzzleId: string, index: number): string {
  return `${puzzleId}__clue__${index}`;
}

function themeId(languageCode: string, levelCode: string, themeSlug: string): string {
  return `${languageCode}-${levelCode.toLowerCase()}-${themeSlug}`;
}

function languageId(code: string): string {
  return `lang-${code}`;
}

function levelId(code: string): string {
  return `level-${code.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Language / level metadata
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Português",
};

const LEVEL_ORDER: Record<string, number> = {
  PRE: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

function themeNameFromSlug(slug: string): string {
  return slug.replace(/-/g, " ");
}

// ---------------------------------------------------------------------------
// Load all puzzles from JSON files (runs at build time / server side)
// ---------------------------------------------------------------------------

let _cache: StaticPuzzle[] | null = null;

export function getAllPuzzles(): StaticPuzzle[] {
  if (_cache) return _cache;

  const contentDir = path.join(process.cwd(), "content", "puzzle");
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".json"));

  const puzzles: StaticPuzzle[] = [];

  for (const file of files) {
    const data: PuzzleFile = JSON.parse(
      fs.readFileSync(path.join(contentDir, file), "utf-8")
    );

    for (const p of data.puzzles) {
      const pid = puzzleId(p.languageCode, p.levelCode, p.title);
      const tid = themeId(p.languageCode, p.levelCode, p.themeSlug);
      const lid = languageId(p.languageCode);
      const lvid = levelId(p.levelCode);

      // Categories
      const categories: StaticCategory[] = p.categories.map((c) => ({
        id: categoryId(pid, c.label),
        label: c.label,
        emoji: c.emoji,
        order: c.order,
      }));

      // Items
      const items: StaticItem[] = p.items.map((item) => {
        const cat = categories[item.categoryIndex];
        return {
          id: itemId(cat.id, item.label),
          categoryId: cat.id,
          label: item.label,
          emoji: item.emoji,
        };
      });

      // Clues
      const clues: StaticClue[] = p.clues.map((c, i) => ({
        id: clueId(pid, i),
        text: c.text,
        clueType: c.clueType,
      }));

      // Solution map
      const itemByLabel: Record<string, StaticItem> = Object.fromEntries(
        items.map((it) => [it.label, it])
      );

      const yesSet = new Set<string>();
      const solutionMap: Record<string, "YES" | "NO"> = {};

      const isSimpleFormat = p.solution.length > 0 && "rowItemLabel" in p.solution[0];

      if (isSimpleFormat) {
        // Simple format: every cell is explicit { rowItemLabel, colItemLabel, value }
        for (const row of p.solution as SolutionRowSimple[]) {
          const itemA = itemByLabel[row.rowItemLabel];
          const itemB = itemByLabel[row.colItemLabel];
          if (!itemA || !itemB) continue;
          const key = itemA.id < itemB.id ? `${itemA.id}__${itemB.id}` : `${itemB.id}__${itemA.id}`;
          solutionMap[key] = row.value;
          if (row.value === "YES") yesSet.add(key);
        }
      } else {
        // Logic format: only YES pairs listed; NOs are inferred
        for (const row of p.solution as SolutionRowLogic[]) {
          const resolvedItems = row.itemLabels.map((lbl: string) => itemByLabel[lbl]);
          for (let i = 0; i < resolvedItems.length; i++) {
            for (let j = i + 1; j < resolvedItems.length; j++) {
              const a = resolvedItems[i].id;
              const b = resolvedItems[j].id;
              const key = a < b ? `${a}__${b}` : `${b}__${a}`;
              solutionMap[key] = "YES";
              yesSet.add(key);
            }
          }
        }

        // NO pairs — all category pairs not in YES
        const categoryCount = p.categories.length;
        const itemsByCategory: StaticItem[][] = Array.from({ length: categoryCount }, () => []);
        for (const item of p.items) {
          itemsByCategory[item.categoryIndex].push(itemByLabel[item.label]);
        }

        for (let catA = 0; catA < categoryCount; catA++) {
          for (let catB = catA + 1; catB < categoryCount; catB++) {
            for (const itemA of itemsByCategory[catA]) {
              for (const itemB of itemsByCategory[catB]) {
                const key = itemA.id < itemB.id
                  ? `${itemA.id}__${itemB.id}`
                  : `${itemB.id}__${itemA.id}`;
                if (!yesSet.has(key)) solutionMap[key] = "NO";
              }
            }
          }
        }
      }

      puzzles.push({
        id: pid,
        title: p.title,
        themeId: tid,
        themeName: themeNameFromSlug(p.themeSlug),
        languageId: lid,
        languageCode: p.languageCode,
        languageName: LANGUAGE_NAMES[p.languageCode] ?? p.languageCode,
        levelId: lvid,
        levelCode: p.levelCode.toUpperCase(),
        levelOrder: LEVEL_ORDER[p.levelCode.toUpperCase()] ?? 99,
        gridSize: p.gridSize,
        grammarNote: p.grammarNote,
        categories,
        items,
        clues,
        solutionMap,
      });
    }
  }

  _cache = puzzles;
  return puzzles;
}

// ---------------------------------------------------------------------------
// Query helpers (mirror the Prisma functions they replace)
// ---------------------------------------------------------------------------

export function getPuzzleById(id: string): StaticPuzzle | null {
  return getAllPuzzles().find((p) => p.id === id) ?? null;
}

export function getFirstPuzzleId(): string | null {
  const puzzles = getAllPuzzles();
  for (const level of ["PRE", "A1"]) {
    const match = puzzles
      .filter((p) => p.languageCode === "en" && p.levelCode === level)
      .sort((a, b) => a.title.localeCompare(b.title));
    if (match[0]) return match[0].id;
  }
  return puzzles[0]?.id ?? null;
}

export function getNextPuzzle(
  currentId: string,
  themeId: string,
  levelId: string,
  languageId: string
): { id: string } | null {
  const puzzles = getAllPuzzles();
  const current = puzzles.find((p) => p.id === currentId);
  if (!current) return null;

  // Next puzzle within the same theme — only forward (title sorts after current)
  const afterInTheme = puzzles
    .filter((p) => p.themeId === themeId && p.title > current.title)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (afterInTheme.length > 0) return { id: afterInTheme[0].id };

  // First puzzle of the next theme (themes sorted alphabetically)
  const inLevel = puzzles.filter(
    (p) => p.levelId === levelId && p.languageId === languageId && p.themeId !== themeId
  );
  const themeIds = [...new Set(inLevel.map((p) => p.themeId))].sort();
  const nextThemeId = themeIds.find((t) => t > themeId) ?? themeIds[0];
  if (!nextThemeId) return null;

  const firstOfNextTheme = inLevel
    .filter((p) => p.themeId === nextThemeId)
    .sort((a, b) => a.title.localeCompare(b.title))[0];
  return firstOfNextTheme ? { id: firstOfNextTheme.id } : null;
}

export function getAvailableLanguages() {
  const puzzles = getAllPuzzles();
  const seen = new Map<string, { id: string; code: string; name: string }>();
  for (const p of puzzles) {
    if (!seen.has(p.languageCode)) {
      seen.set(p.languageCode, { id: p.languageId, code: p.languageCode, name: p.languageName });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableLevels(languageCode: string) {
  const puzzles = getAllPuzzles().filter((p) => p.languageCode === languageCode);
  const seen = new Map<string, { id: string; code: string; order: number }>();
  for (const p of puzzles) {
    if (!seen.has(p.levelCode)) {
      seen.set(p.levelCode, { id: p.levelId, code: p.levelCode, order: p.levelOrder });
    }
  }
  return [...seen.values()].sort((a, b) => a.order - b.order);
}

export function getAvailableThemes(languageCode: string, levelCode: string) {
  const puzzles = getAllPuzzles().filter(
    (p) => p.languageCode === languageCode && p.levelCode === levelCode.toUpperCase()
  );
  const seen = new Map<string, { id: string; name: string; puzzles: { id: string }[] }>();
  for (const p of puzzles) {
    if (!seen.has(p.themeId)) {
      seen.set(p.themeId, { id: p.themeId, name: p.themeName, puzzles: [] });
    }
    seen.get(p.themeId)!.puzzles.push({ id: p.id });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPuzzlesInTheme(themeId: string) {
  return getAllPuzzles()
    .filter((p) => p.themeId === themeId)
    .map((p) => ({ id: p.id, title: p.title }));
}

export function getFilterContext(languageCode: string, levelCode: string, themeId: string) {
  return {
    languages: getAvailableLanguages(),
    levels: getAvailableLevels(languageCode),
    themes: getAvailableThemes(languageCode, levelCode),
    puzzlesInTheme: getPuzzlesInTheme(themeId),
  };
}
