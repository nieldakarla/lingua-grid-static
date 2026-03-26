"use client";

import { useState, useCallback } from "react";
import confetti from "canvas-confetti";
import PuzzleGrid from "./PuzzleGrid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TUTORIAL_COMPLETED_KEY = "linguagrid_tutorial_completed";

// ---------------------------------------------------------------------------
// Hardcoded puzzle data — Tutorial 1
// ---------------------------------------------------------------------------

const T1_CATEGORIES = [
  { id: "t1-a", label: "Animals", emoji: null },
  { id: "t1-c", label: "Colors",  emoji: null },
];

const T1_ITEMS = [
  { id: "t1-a-cat",   categoryId: "t1-a", label: "cat",   emoji: "🐱" },
  { id: "t1-a-dog",   categoryId: "t1-a", label: "dog",   emoji: "🐶" },
  { id: "t1-a-bird",  categoryId: "t1-a", label: "bird",  emoji: "🐦" },
  { id: "t1-c-red",   categoryId: "t1-c", label: "red",   emoji: "🔴" },
  { id: "t1-c-blue",  categoryId: "t1-c", label: "blue",  emoji: "🔵" },
  { id: "t1-c-green", categoryId: "t1-c", label: "green", emoji: "🟢" },
];

const T1_CLUES = [
  "🐱 The cat is red.",
  "🐶 The dog is not green.",
];

// ---------------------------------------------------------------------------
// Hardcoded puzzle data — Tutorial 2
// ---------------------------------------------------------------------------

const T2_CATEGORIES = [
  { id: "t2-a", label: "Animals",  emoji: null },
  { id: "t2-c", label: "Colors",   emoji: null },
  { id: "t2-h", label: "Habitats", emoji: null },
];

const T2_ITEMS = [
  { id: "t2-a-cat",   categoryId: "t2-a", label: "cat",   emoji: "🐱" },
  { id: "t2-a-dog",   categoryId: "t2-a", label: "dog",   emoji: "🐶" },
  { id: "t2-a-bird",  categoryId: "t2-a", label: "bird",  emoji: "🐦" },
  { id: "t2-c-red",   categoryId: "t2-c", label: "red",   emoji: "🔴" },
  { id: "t2-c-blue",  categoryId: "t2-c", label: "blue",  emoji: "🔵" },
  { id: "t2-c-green", categoryId: "t2-c", label: "green", emoji: "🟢" },
  { id: "t2-h-house", categoryId: "t2-h", label: "house", emoji: "🏠" },
  { id: "t2-h-tree",  categoryId: "t2-h", label: "tree",  emoji: "🌳" },
  { id: "t2-h-water", categoryId: "t2-h", label: "water", emoji: "💧" },
];

const T2_CLUES = [
  "🐶 The dog is red.",
  "🔵 The blue animal lives in the water.",
  "🐦 The bird lives in the tree.",
];

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepAction = "ok" | "interact" | "freeSolve";

interface TutorialStep {
  text: string;
  action: StepAction;
  targetA?: string;
  targetB?: string;
  requiredState?: "YES" | "NO_manual";
  activeClue?: number;
}

const T1_STEPS: TutorialStep[] = [
  {
    text: "LinguaGrid is a logic puzzle game that helps you practice a new language. Read the clues and fill in the grid.",
    action: "ok",
  },
  {
    text: "The goal is to find the unique match between all categories. Each item belongs to exactly one item in every other category.",
    action: "ok",
  },
  {
    text: "The first clue says 🐱 The cat is red. Click the cell where cat meets red to mark it as YES. (Hint: first click = ✗, second click = ✓)",
    action: "interact",
    targetA: "t1-a-cat",
    targetB: "t1-c-red",
    requiredState: "YES",
    activeClue: 0,
  },
  {
    text: "Notice how the other cells filled in automatically. When you find a match, the rest are eliminated.",
    action: "ok",
  },
  {
    text: "The second clue says 🐶 The dog is not green. Click dog × green to mark it as NO.",
    action: "interact",
    targetA: "t1-a-dog",
    targetB: "t1-c-green",
    requiredState: "NO_manual",
    activeClue: 1,
  },
  {
    text: "Now use what you know. The dog is not green — so which color is left for the dog? Finish the puzzle!",
    action: "freeSolve",
    activeClue: 1,
  },
];

const T2_STEPS: TutorialStep[] = [
  {
    text: "Solving puzzles is easy when you use logical thinking. Let's learn how!",
    action: "ok",
  },
  {
    text: "The first clue says 🐶 The dog is red. Mark dog × red as YES.",
    action: "interact",
    targetA: "t2-a-dog",
    targetB: "t2-c-red",
    requiredState: "YES",
    activeClue: 0,
  },
  {
    text: "The second clue: 🔵 The blue animal lives in the water. Mark blue × water!",
    action: "interact",
    targetA: "t2-c-blue",
    targetB: "t2-h-water",
    requiredState: "YES",
    activeClue: 1,
  },
  {
    text: "The third clue: 🐦 The bird lives in the tree. Mark bird × tree!",
    action: "interact",
    targetA: "t2-a-bird",
    targetB: "t2-h-tree",
    requiredState: "YES",
    activeClue: 2,
  },
  {
    text: "Bird lives in the tree — not in the water. Blue lives in water. So bird is NOT blue. Mark bird × blue as NO.",
    action: "interact",
    targetA: "t2-a-bird",
    targetB: "t2-c-blue",
    requiredState: "NO_manual",
    activeClue: 2,
  },
  {
    text: "Dog is red — so dog is not blue either. The only animal left for blue is cat! Mark cat × blue as YES.",
    action: "interact",
    targetA: "t2-a-cat",
    targetB: "t2-c-blue",
    requiredState: "YES",
    activeClue: 0,
  },
  {
    text: "Cat is blue. Blue lives in water. So cat lives in water! Mark cat × water.",
    action: "interact",
    targetA: "t2-a-cat",
    targetB: "t2-h-water",
    requiredState: "YES",
    activeClue: 1,
  },
  {
    text: "This is the exclusion method — conclusions in one sub-grid unlock answers in another. Try to finish the rest!",
    action: "freeSolve",
  },
];

// ---------------------------------------------------------------------------
// Utility — same sort as PuzzleGrid's cellKey
// ---------------------------------------------------------------------------

function cellKeyFrom(idA: string, idB: string): string {
  return idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`;
}

// ---------------------------------------------------------------------------
// TutorialOverlay
// ---------------------------------------------------------------------------

interface TutorialOverlayProps {
  onClose: () => void;
}

type CompletionState = "none" | "t1-complete" | "t2-complete";

export default function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [stepIdx, setStepIdx] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [completion, setCompletion] = useState<CompletionState>("none");

  const steps = phase === 1 ? T1_STEPS : T2_STEPS;
  const categories = phase === 1 ? T1_CATEGORIES : T2_CATEGORIES;
  const items = phase === 1 ? T1_ITEMS : T2_ITEMS;
  const clues = phase === 1 ? T1_CLUES : T2_CLUES;
  const currentStep = steps[stepIdx];

  function handleSkip() {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
    onClose();
  }

  function handleOk() {
    setStepIdx(stepIdx + 1);
  }

  function handleBack() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  const handleCellChange = useCallback(
    (key: string, newState: "YES" | "NO_manual" | null) => {
      const step = (phase === 1 ? T1_STEPS : T2_STEPS)[stepIdx];
      if (step.action !== "interact") return;
      const targetKey = cellKeyFrom(step.targetA!, step.targetB!);
      if (key !== targetKey) return;
      if (newState === step.requiredState) {
        setStepIdx(stepIdx + 1);
      }
    },
    [phase, stepIdx]
  );

  const handleAllFilled = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#acd157", "#f1be32", "#99c9ff", "#dbb8ff"],
      zIndex: 10001,
    });
    setCompletion(phase === 1 ? "t1-complete" : "t2-complete");
  }, [phase]);

  function handleContinueAfterComplete() {
    if (completion === "t1-complete") {
      setPhase(2);
      setStepIdx(0);
      setGridKey((k) => k + 1);
      setCompletion("none");
    } else {
      localStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
      onClose();
    }
  }

  if (!currentStep) return null;

  const tutorialTarget =
    currentStep.action === "interact" && currentStep.targetA && currentStep.targetB
      ? { itemAId: currentStep.targetA, itemBId: currentStep.targetB }
      : null;

  const tutorialFreeSolve = currentStep.action === "freeSolve";

  return (
    <>
      {/* ── Full-screen dark overlay ── */}
      <div
        className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto py-8 px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      >
        {/* ── Page card ── */}
        <div className="w-full max-w-2xl bg-fcc-bg-secondary rounded-2xl shadow-2xl flex flex-col gap-6 p-8 my-auto">
          <div className="flex flex-col items-center gap-6">

            {/* Title */}
            <h2 className="font-mono font-bold text-fcc-fg-primary text-2xl text-center">
              LinguaGrid Tutorial
            </h2>

            {/* Tutorial puzzle grid */}
            <div className="w-full flex justify-center">
              <PuzzleGrid
                key={gridKey}
                categories={categories}
                items={items}
                tutorialTarget={tutorialTarget}
                tutorialFreeSolve={tutorialFreeSolve}
                onCellChange={handleCellChange}
                onAllFilled={handleAllFilled}
              />
            </div>

            {/* Clues */}
            <div className="w-full">
              <div className="p-4 rounded border border-fcc-bg-quaternary bg-fcc-bg-primary">
                <p className="font-mono text-xs font-bold text-fcc-fg-muted uppercase tracking-widest mb-3">
                  Clues
                </p>
                <ol className="space-y-2">
                  {clues.map((clue, i) => (
                    <li
                      key={i}
                      className={`font-mono text-sm ${
                        currentStep.activeClue === i
                          ? "text-fcc-fg-primary font-bold"
                          : "text-fcc-fg-muted"
                      }`}
                    >
                      {i + 1}. {clue}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Instruction card — bottom, distinct background */}
            <div className="w-full rounded-lg p-5 flex flex-col gap-3 bg-fcc-bg-quaternary border border-fcc-fg-muted/20">
              {/* Header row inside instruction card */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-fcc-fg-tertiary uppercase tracking-widest">
                  Tutorial {phase} of 2 — Step {stepIdx + 1} of {steps.length}
                </span>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="font-mono text-xs font-bold text-fcc-fg-tertiary hover:text-fcc-fg-primary transition-colors"
                >
                  Skip
                </button>
              </div>
              <p className="font-mono text-fcc-fg-primary text-base leading-relaxed">
                {currentStep.text}
              </p>
              {/* Navigation row */}
              <div className="flex items-center justify-between pt-1">
                {/* Back — hidden on first step */}
                {stepIdx > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 font-mono font-bold text-sm rounded border border-fcc-fg-muted/40 text-fcc-fg-secondary hover:border-fcc-fg-muted hover:text-fcc-fg-primary transition-colors"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}

                {currentStep.action === "ok" ? (
                  <button
                    type="button"
                    onClick={handleOk}
                    className="px-5 py-2 font-mono font-bold text-sm rounded bg-fcc-yellow text-fcc-yellow-dark hover:opacity-90 transition-opacity"
                  >
                    Next
                  </button>
                ) : (
                  <p className="font-mono text-xs text-fcc-fg-muted">
                    {tutorialFreeSolve ? "↑ Solve the puzzle above" : "↑ Click the highlighted cell above"}
                  </p>
                )}
              </div>
            </div>

            {/* Spacer for scroll breathing room */}
            <div className="w-full pb-2">
            </div>

          </div>
        </div>{/* end page card */}
      </div>

      {/* ── Completion modal — above the overlay ── */}
      {completion !== "none" && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div className="bg-fcc-bg-secondary rounded-lg border border-fcc-bg-quaternary p-8 max-w-sm w-full flex flex-col items-center gap-6 text-center">
            <p className="text-4xl">🎉</p>
            <p className="font-mono font-bold text-cell-yes text-lg">
              {completion === "t1-complete"
                ? "Well done! Tutorial 1 complete."
                : "You're ready to play! Good luck."}
            </p>
            <button
              type="button"
              onClick={handleContinueAfterComplete}
              className="w-full px-5 py-2.5 font-mono font-bold text-base rounded bg-fcc-yellow text-fcc-yellow-dark hover:opacity-90 transition-opacity"
            >
              {completion === "t1-complete" ? "Continue to Tutorial 2 →" : "Start playing!"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
