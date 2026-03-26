import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPuzzleById, getNextPuzzle, getFilterContext, getAllPuzzles } from "@/lib/puzzles-static";
import PuzzlePlayer from "@/components/PuzzlePlayer";

interface PuzzlePageProps {
  params: { lang: string; id: string };
}

export function generateStaticParams() {
  return getAllPuzzles().map((p) => ({
    lang: p.languageCode,
    id: p.id,
  }));
}

export function generateMetadata({ params }: PuzzlePageProps): Metadata {
  const puzzle = getPuzzleById(params.id);
  if (!puzzle) return { title: "Puzzle not found — LinguaGrid" };
  return {
    title: `${puzzle.title} — LinguaGrid`,
    description: `Solve this ${puzzle.levelCode} ${puzzle.languageName} logic grid puzzle.`,
  };
}

export default function PuzzlePage({ params }: PuzzlePageProps) {
  const puzzle = getPuzzleById(params.id);
  if (!puzzle) notFound();

  const nextPuzzle = getNextPuzzle(puzzle.id, puzzle.themeId, puzzle.levelId, puzzle.languageId);
  const filterContext = getFilterContext(puzzle.languageCode, puzzle.levelCode, puzzle.themeId);

  return (
    <PuzzlePlayer
      puzzleId={puzzle.id}
      puzzleTitle={puzzle.title}
      categories={puzzle.categories}
      items={puzzle.items}
      clues={puzzle.clues}
      solutionMap={puzzle.solutionMap}
      grammarNote={puzzle.grammarNote}
      lang={puzzle.languageCode}
      nextPuzzlePath={nextPuzzle ? `/${params.lang}/puzzle/${nextPuzzle.id}` : null}
      filterContext={filterContext}
      currentThemeId={puzzle.themeId}
      languageCode={puzzle.languageCode}
      levelCode={puzzle.levelCode}
    />
  );
}
