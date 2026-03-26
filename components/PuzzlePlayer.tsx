"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PuzzleGrid, { GridState } from "./PuzzleGrid";
import ClueList from "./ClueList";
import TutorialOverlay, { TUTORIAL_COMPLETED_KEY } from "./TutorialOverlay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterContext {
  languages: { id: string; code: string; name: string }[];
  levels: { id: string; code: string; order: number }[];
  themes: {
    id: string;
    name: string;
    puzzles: { id: string }[];
  }[];
  puzzlesInTheme: { id: string; title: string }[];
}

interface PuzzlePlayerProps {
  puzzleId: string;
  puzzleTitle: string;
  categories: { id: string; label: string; emoji?: string | null }[];
  items: { id: string; categoryId: string; label: string; emoji?: string | null }[];
  clues: { id: string; text: string; clueType: string }[];
  solutionMap: Record<string, "YES" | "NO">;
  grammarNote: string | null;
  lang: string;
  nextPuzzlePath: string | null;
  filterContext: FilterContext;
  currentThemeId: string;
  languageCode: string;
  levelCode: string;
}

type ModalState = "idle" | "wave" | "correct" | "incorrect";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const COMPLETED_KEY = "lg_completed";

function getLocalCompleted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addLocalCompleted(puzzleId: string) {
  const existing = getLocalCompleted();
  if (!existing.includes(puzzleId)) {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...existing, puzzleId]));
  }
}

// ---------------------------------------------------------------------------
// Filter dropdown
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-base text-fcc-fg-secondary uppercase tracking-wider">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          font-mono text-base text-fcc-fg-primary
          bg-fcc-bg-tertiary border border-fcc-bg-quaternary rounded
          px-2 py-1 pr-6 appearance-none cursor-pointer
          hover:border-fcc-fg-muted transition-colors
          focus:outline-none focus:ring-1 focus:ring-fcc-focus
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%23858591'%3E%3Cpath d='M480-360 280-560h400L480-360Z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
          backgroundSize: "16px 16px",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PuzzlePlayer
// ---------------------------------------------------------------------------

export default function PuzzlePlayer({
  puzzleId,
  puzzleTitle,
  categories,
  items,
  clues,
  solutionMap,
  grammarNote,
  lang,
  nextPuzzlePath,
  filterContext,
  currentThemeId,
  languageCode,
  levelCode,
}: PuzzlePlayerProps) {
  const router = useRouter();
  const [, setGridState] = useState<GridState>({});
  const [modalState, setModalState] = useState<ModalState>("idle");
  const [mistakeCount, setMistakeCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Check tutorial status on mount
  useEffect(() => {
    if (!localStorage.getItem(TUTORIAL_COMPLETED_KEY)) {
      setShowTutorial(true);
    }
  }, []);

  // Timer — starts on first cell interaction, stops when solved
  useEffect(() => {
    if (!timerStarted) return;
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerStarted, gridKey]);

  useEffect(() => {
    if (modalState === "wave" || modalState === "correct") {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [modalState]);

  const handleGridChange = useCallback((state: GridState) => {
    setGridState(state);
    setTimerStarted(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Check answer — called automatically when all cells are filled
  // ---------------------------------------------------------------------------

  const handleAllFilled = useCallback((finalState: GridState) => {
    if (Object.keys(solutionMap).length === 0) return;

    // Only compare YES cells — auto-fills cover all NOs so we don't need to check them
    const solutionYes = new Set(
      Object.entries(solutionMap).filter(([, v]) => v === "YES").map(([k]) => k)
    );
    const gridYes = new Set(
      Object.entries(finalState).filter(([, v]) => v === "YES").map(([k]) => k)
    );

    const missing = [...solutionYes].filter(k => !gridYes.has(k)).length;
    const extra   = [...gridYes].filter(k => !solutionYes.has(k)).length;
    const mistakes = missing + extra;

    if (mistakes === 0) {
      setModalState("wave");
      saveProgress();
      // After wave animation completes, show correct modal + confetti
      setTimeout(() => {
        setModalState("correct");
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
            colors: ["#acd157", "#f1be32", "#99c9ff", "#dbb8ff"],
          });
        });
      }, 1800);
    } else {
      setMistakeCount(mistakes);
      setModalState("incorrect");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutionMap]);

  function saveProgress() {
    addLocalCompleted(puzzleId);
  }

  function handleRestart() {
    setModalState("idle");
    setMistakeCount(0);
    setElapsed(0);
    setTimerStarted(false);
    setGridState({});
    setGridKey((k) => k + 1); // forces PuzzleGrid to remount → clean state
  }

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------

  function handleLangChange(newLang: string) {
    router.push(`/${newLang}`);
  }

  function handleLevelChange(newLevel: string) {
    router.push(`/${languageCode}/${newLevel}`);
  }

  function handleThemeChange(newThemeId: string) {
    const theme = filterContext.themes.find((t) => t.id === newThemeId);
    if (!theme?.puzzles[0]) return;
    router.push(`/${languageCode}/puzzle/${theme.puzzles[0].id}`);
  }

  function handlePuzzleChange(newPuzzleId: string) {
    router.push(`/${languageCode}/puzzle/${newPuzzleId}`);
  }
  const solved = modalState === "correct";
  const showWave = modalState === "wave" || modalState === "correct";

  return (
    <div className="min-h-screen bg-fcc-bg-secondary flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-fcc-bg-tertiary bg-fcc-bg-primary">
        <div className="max-w-5xl mx-auto px-4 py-3 grid grid-cols-3 items-center gap-4">
          {/* Left: fCC logo */}
          <div>
            <Image
              src="/fcc_primary_large.svg"
              alt="freeCodeCamp"
              width={160}
              height={18}
              unoptimized
              priority
            />
          </div>
          {/* Center: LinguaGrid title */}
          <div className="flex justify-center">
            <span className="font-mono font-bold text-fcc-fg-primary text-2xl">LinguaGrid</span>
          </div>
          {/* Right: How to play */}
          <div className="flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="font-mono font-bold text-sm rounded px-4 py-2 bg-fcc-blue text-fcc-blue-dark hover:opacity-90 transition-opacity"
            >
              How to play
            </button>
          </div>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="border-b border-fcc-bg-tertiary bg-fcc-bg-tertiary">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <FilterDropdown
              label="Language"
              value={languageCode}
              options={filterContext.languages.map((l) => ({ value: l.code, label: l.name }))}
              onChange={handleLangChange}
            />
            <FilterDropdown
              label="Level"
              value={levelCode}
              options={filterContext.levels.map((l) => ({ value: l.code, label: l.code }))}
              onChange={handleLevelChange}
            />
            <FilterDropdown
              label="Category"
              value={currentThemeId}
              options={filterContext.themes.map((t) => ({ value: t.id, label: t.name }))}
              onChange={handleThemeChange}
            />
            <FilterDropdown
              label="Puzzle"
              value={puzzleId}
              options={filterContext.puzzlesInTheme.map((p) => ({
                value: p.id,
                label: p.title,
              }))}
              onChange={handlePuzzleChange}
            />
          </div>
        </div>
      </div>

      {/* ── Tutorial overlay ── */}
      {showTutorial && (
        <TutorialOverlay onClose={() => setShowTutorial(false)} />
      )}

      {/* ── Main content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Puzzle title + timer */}
        <div className="flex items-center gap-3">
          <h1 className="font-mono font-bold text-fcc-fg-primary text-xl leading-tight">
            {puzzleTitle}
          </h1>
          <div className="flex items-center gap-1.5 font-mono text-base text-fcc-fg-muted tabular-nums shrink-0 bg-fcc-bg-tertiary border border-fcc-bg-quaternary rounded px-3 py-1.5">
            <Image src="/icons/timer.svg" alt="" width={16} height={16} className="opacity-50" />
            {formatTime(elapsed)}
          </div>
        </div>

        {/* Grid */}
        <section aria-label="Logic grid">
          <PuzzleGrid
            key={gridKey}
            categories={categories}
            items={items}
            onChange={handleGridChange}
            onAllFilled={handleAllFilled}
            disabled={solved}
            wave={showWave}
          />
        </section>

        {/* Clues */}
        <section aria-label="Clues">
          <div className="w-fit p-4 rounded border border-fcc-bg-quaternary bg-fcc-bg-primary">
            <p className="font-mono text-xs font-bold text-fcc-fg-muted uppercase tracking-widest mb-2">
              Clues — click any sentence to hear it
            </p>
            <div className="bg-fcc-bg-tertiary rounded p-3 mt-2">
              <ClueList clues={clues} lang={lang} />
            </div>
          </div>
        </section>

        {/* Grammar note — shown after solve */}
        {grammarNote && (
          <section aria-label="Grammar note">
            <div className="w-fit p-4 rounded border border-fcc-bg-quaternary bg-fcc-bg-primary">
              <p className="font-mono text-xs font-bold text-fcc-fg-muted uppercase tracking-widest mb-2">
                Grammar note
              </p>
              <p className="text-fcc-fg-primary">{grammarNote}</p>
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-fcc-bg-quaternary bg-fcc-bg-tertiary sticky bottom-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {filterContext.puzzlesInTheme.map((p, i) => (
              <Link
                key={p.id}
                href={`/${languageCode}/puzzle/${p.id}`}
                aria-label={`Puzzle ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  p.id === puzzleId
                    ? "bg-fcc-yellow"
                    : "bg-fcc-bg-quaternary hover:bg-fcc-fg-muted"
                }`}
              />
            ))}
            <span className="font-mono text-xs text-fcc-fg-secondary ml-2">
              {levelCode} {filterContext.themes.find((t) => t.id === currentThemeId)?.name ?? ""}
            </span>
          </div>
        </div>
      </footer>

      {/* ── Incorrect modal ── */}
      {modalState === "incorrect" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-fcc-bg-secondary rounded-lg border border-fcc-bg-quaternary p-8 max-w-sm w-full flex flex-col items-center gap-6 text-center">
            <p className="text-4xl">🤔</p>
            <div>
              <p className="font-mono font-bold text-fcc-fg-primary text-lg mb-1">Not quite!</p>
              <p className="text-fcc-fg-muted text-base">
                You have{" "}
                <span className="text-cell-no font-bold">{mistakeCount}</span>{" "}
                {mistakeCount === 1 ? "mistake" : "mistakes"}. Review the clues and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestart}
              className="w-full px-5 py-2.5 font-mono font-bold text-base rounded bg-fcc-yellow text-fcc-yellow-dark hover:opacity-90 transition-opacity"
            >
              Restart puzzle
            </button>
          </div>
        </div>
      )}

      {/* ── Correct modal ── */}
      {modalState === "correct" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-fcc-bg-secondary rounded-lg border border-fcc-bg-quaternary p-8 max-w-sm w-full flex flex-col items-center gap-6 text-center relative">
            <button
              type="button"
              onClick={() => setModalState("idle")}
              className="absolute top-3 right-3 text-fcc-fg-muted hover:text-fcc-fg-primary transition-colors font-mono text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
            <p className="text-4xl">🎉</p>
            <div>
              <p className="font-mono font-bold text-cell-yes text-lg mb-1">Puzzle complete!</p>
              <p className="text-fcc-fg-muted text-base">Finished in {formatTime(elapsed)}</p>
            </div>

            {nextPuzzlePath ? (
              <Link
                href={nextPuzzlePath}
                className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 font-mono font-bold text-base rounded bg-fcc-green text-fcc-green-dark hover:opacity-90 transition-opacity"
              >
                Next puzzle
                <Image src="/icons/arrow_forward.svg" alt="" width={16} height={16} style={{ filter: "brightness(0)" }} />
              </Link>
            ) : (
              <p className="font-mono text-base text-cell-yes font-bold">✓ All done!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
