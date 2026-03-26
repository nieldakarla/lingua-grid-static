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
  solution: { itemLabels: string[]; value: "YES" }[];
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
  pt: "Portuguese",
};

const LEVEL_ORDER: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
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

      // YES pairs
      for (const row of p.solution) {
        const resolvedItems = row.itemLabels.map((lbl) => itemByLabel[lbl]);
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
  const en = puzzles
    .filter((p) => p.languageCode === "en" && p.levelCode === "A1")
    .sort((a, b) => a.title.localeCompare(b.title));
  return en[0]?.id ?? puzzles[0]?.id ?? null;
}

export function getNextPuzzle(
  currentId: string,
  themeId: string,
  levelId: string,
  languageId: string
): { id: string } | null {
  const puzzles = getAllPuzzles();
  const inTheme = puzzles.filter((p) => p.themeId === themeId && p.id !== currentId);
  if (inTheme.length > 0) return { id: inTheme[0].id };

  const inLevel = puzzles.filter(
    (p) => p.levelId === levelId && p.languageId === languageId && p.id !== currentId
  );
  return inLevel.length > 0 ? { id: inLevel[0].id } : null;
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
