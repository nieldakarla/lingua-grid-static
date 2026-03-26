"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridCategory {
  id: string;
  label: string;
  emoji?: string | null;
}

export interface GridItem {
  id: string;
  categoryId: string;
  label: string;
  emoji?: string | null;
}

/** Manual states set by the user */
export type CellState = "empty" | "YES" | "NO";

/** Derived state for rendering — auto-filled NO is visually distinct */
type DisplayState = "empty" | "YES" | "NO_manual" | "NO_auto" | "blocked";

/**
 * Grid state: key is `${itemAId}__${itemBId}` (always sorted so itemAId < itemBId
 * by index to avoid duplicates). Value is only "YES" or "NO_manual" — auto fills
 * are derived, not stored.
 */
export type GridState = Record<string, "YES" | "NO_manual">;

export interface PuzzleGridProps {
  categories: GridCategory[];
  items: GridItem[];
  onChange?: (state: GridState) => void;
  onAllFilled?: (finalState: GridState) => void;
  disabled?: boolean;
  wave?: boolean;
  /** Tutorial: only this cell is interactive (pulsing ring). */
  tutorialTarget?: { itemAId: string; itemBId: string } | null;
  /** Tutorial: all cells are interactive (free-solve step). */
  tutorialFreeSolve?: boolean;
  /** Tutorial: fires after any cell state change. */
  onCellChange?: (key: string, newState: "YES" | "NO_manual" | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable key for a cell — always sorted by the two item IDs so (a,b) === (b,a) */
function cellKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`;
}

// ---------------------------------------------------------------------------
// Auto-fill logic
// ---------------------------------------------------------------------------

function deriveAutoFills(
  state: GridState,
  itemsByCategory: Record<string, GridItem[]>
): Set<string> {
  const autoFilled = new Set<string>();
  const categoryIds = Object.keys(itemsByCategory);

  for (let ai = 0; ai < categoryIds.length; ai++) {
    for (let bi = ai + 1; bi < categoryIds.length; bi++) {
      const catAItems = itemsByCategory[categoryIds[ai]];
      const catBItems = itemsByCategory[categoryIds[bi]];

      for (const itemA of catAItems) {
        for (const itemB of catBItems) {
          const key = cellKey(itemA.id, itemB.id);
          if (state[key] === "YES") {
            for (const otherB of catBItems) {
              if (otherB.id === itemB.id) continue;
              const k = cellKey(itemA.id, otherB.id);
              if (!state[k]) autoFilled.add(k);
            }
            for (const otherA of catAItems) {
              if (otherA.id === itemA.id) continue;
              const k = cellKey(otherA.id, itemB.id);
              if (!state[k]) autoFilled.add(k);
            }
          }
        }
      }
    }
  }

  return autoFilled;
}

// ---------------------------------------------------------------------------
// Cell component
// ---------------------------------------------------------------------------

interface CellProps {
  display: DisplayState;
  onClick: () => void;
  ariaLabel: string;
  bandAlt?: boolean;
  waveDelay?: number;
  wave?: boolean;
  highlighted?: boolean;
  tutorialDimmed?: boolean;
}

function Cell({ display, onClick, ariaLabel, bandAlt = false, waveDelay = 0, wave = false, highlighted = false, tutorialDimmed = false }: CellProps) {
  const base =
    "block w-full min-h-[52px] flex items-center justify-center font-bold text-base select-none transition-colors";

  const emptyStyle = bandAlt
    ? "bg-fcc-bg-primary hover:bg-fcc-bg-secondary cursor-pointer"
    : "bg-fcc-bg-tertiary hover:bg-fcc-bg-quaternary cursor-pointer";

  const styles: Record<DisplayState, string> = {
    empty:     emptyStyle,
    YES:       "bg-cell-yes text-cell-yes-text cursor-pointer",
    NO_manual: "bg-cell-no text-cell-no-text cursor-pointer",
    NO_auto:   "bg-cell-no text-cell-no-text opacity-40 cursor-default",
    blocked:   "bg-fcc-bg-secondary cursor-default",
  };

  const labels: Record<DisplayState, string> = {
    empty:     "—",
    YES:       "✓",
    NO_manual: "✗",
    NO_auto:   "✗",
    blocked:   "",
  };

  const isInteractive = !tutorialDimmed && (display === "empty" || display === "YES" || display === "NO_manual");
  const isAnimatable = display !== "empty" && display !== "blocked";

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={`${base} ${styles[display]}${tutorialDimmed ? " opacity-30" : ""}`}
      style={
        highlighted
          ? { animation: "tutorial-pulse 1.5s ease-in-out infinite" }
          : wave && isAnimatable
          ? { animation: `cell-wave 0.5s ease-out ${waveDelay}ms both` }
          : undefined
      }
      aria-label={ariaLabel}
      aria-pressed={display === "YES"}
    >
      {labels[display]}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Header cell with emoji + label
// ---------------------------------------------------------------------------

function HeaderLabel({ item }: { item: GridItem }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-sm font-mono text-fcc-fg-primary">
      {item.emoji && <span className="text-base leading-none">{item.emoji}</span>}
      <span className="whitespace-nowrap text-center leading-tight">{item.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PuzzleGrid — N-category classic logic grid
// ---------------------------------------------------------------------------

export default function PuzzleGrid({
  categories,
  items,
  onChange,
  onAllFilled,
  disabled = false,
  wave = false,
  tutorialTarget = null,
  tutorialFreeSolve = false,
  onCellChange,
}: PuzzleGridProps) {
  const [grid, setGrid] = useState<GridState>({});
  const [colWidth, setColWidth] = useState<number | null>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  // After render, find the widest column header and apply that width to all
  useEffect(() => {
    if (!headerRowRef.current) return;
    const ths = Array.from(headerRowRef.current.querySelectorAll("th[data-col-header]"));
    if (ths.length === 0) return;
    const max = Math.max(...ths.map((th) => (th as HTMLElement).offsetWidth));
    if (max > 0) setColWidth(max);
  }, [categories, items]);

  // Build lookup: categoryId → items[]
  const itemsByCategory: Record<string, GridItem[]> = {};
  for (const cat of categories) {
    itemsByCategory[cat.id] = items.filter((i) => i.categoryId === cat.id);
  }

  const autoFilled = deriveAutoFills(grid, itemsByCategory);

  // Expected YES count: gridSize × C(N, 2)
  // gridSize = items per category; C(N,2) = N*(N-1)/2
  const expectedYes = useMemo(() => {
    const gridSize = itemsByCategory[categories[0]?.id]?.length ?? 0;
    const n = categories.length;
    return gridSize * (n * (n - 1)) / 2;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, items]);

  // Column categories: all except last
  const colCategories = categories.slice(0, categories.length - 1);
  // Row categories: all except first, reversed so the overlapping category is last (bottom-right blocked)
  const rowCategories = [...categories.slice(1)].reverse();

  const handleClick = useCallback(
    (itemA: GridItem, itemB: GridItem) => {
      if (disabled) return;
      const key = cellKey(itemA.id, itemB.id);

      // Tutorial restriction: only the target cell is interactive
      if (tutorialTarget && !tutorialFreeSolve) {
        const targetKey = cellKey(tutorialTarget.itemAId, tutorialTarget.itemBId);
        if (key !== targetKey) return;
      }

      setGrid((prev) => {
        const current = prev[key];
        let next: GridState;
        let newCellState: "YES" | "NO_manual" | null;

        if (!current) {
          next = { ...prev, [key]: "NO_manual" };
          newCellState = "NO_manual";
        } else if (current === "NO_manual") {
          next = { ...prev, [key]: "YES" };
          newCellState = "YES";
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _removed, ...rest } = prev;
          next = rest;
          newCellState = null;
        }

        onChange?.(next);
        onCellChange?.(key, newCellState);

        if (onAllFilled) {
          const yesCount = Object.values(next).filter(v => v === "YES").length;
          if (yesCount === expectedYes) {
            onAllFilled(next);
          }
        }

        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, onChange, onAllFilled, onCellChange, expectedYes, tutorialTarget, tutorialFreeSolve]
  );

  function getDisplay(itemA: GridItem, itemB: GridItem): DisplayState {
    const key = cellKey(itemA.id, itemB.id);
    const manual = grid[key];
    if (manual === "YES") return "YES";
    if (manual === "NO_manual") return "NO_manual";
    if (autoFilled.has(key)) return "NO_auto";
    return "empty";
  }

  if (categories.length < 2) {
    return <p className="text-fcc-fg-muted italic text-sm">Invalid puzzle data.</p>;
  }

  // Pre-compute tutorial target key for cell highlighting
  const tutorialTargetKey = tutorialTarget
    ? cellKey(tutorialTarget.itemAId, tutorialTarget.itemBId)
    : null;

  // Pre-compute flat row/col indices for wave delay
  const flatColOffset: Record<string, number> = {};
  let colOffset = 0;
  for (const colCat of colCategories) {
    for (const colItem of itemsByCategory[colCat.id] ?? []) {
      flatColOffset[colItem.id] = colOffset++;
    }
  }

  let globalRowIdx = 0;

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table
        className="border-collapse"
        role="grid"
        aria-label="Logic grid puzzle"
      >
        <thead>
          {/* Row 1: category group headers for columns */}
          <tr>
            <th colSpan={2} className="border-0" />
            {colCategories.map((colCat) => (
              <th
                key={colCat.id}
                colSpan={itemsByCategory[colCat.id]?.length ?? 0}
                className="px-2 py-1.5 text-center font-mono text-base font-bold text-fcc-fg-secondary border-b border-fcc-bg-quaternary"
              >
                {colCat.emoji ? `${colCat.emoji} ${colCat.label}` : colCat.label}
              </th>
            ))}
          </tr>

          {/* Row 2: individual item headers for columns */}
          <tr ref={headerRowRef}>
            <th className="border-0 w-6" />
            <th className="border-0" />
            {colCategories.flatMap((colCat, colCatIdx) =>
              (itemsByCategory[colCat.id] ?? []).map((colItem) => (
                <th
                  key={colItem.id}
                  data-col-header
                  className={`px-2 py-3 align-bottom border border-fcc-bg-quaternary ${colCatIdx % 2 === 0 ? "bg-fcc-bg-primary" : "bg-fcc-bg-tertiary"}`}
                  style={colWidth ? { width: colWidth } : undefined}
                  scope="col"
                >
                  <HeaderLabel item={colItem} />
                </th>
              ))
            )}
          </tr>
        </thead>

        <tbody>
          {rowCategories.map((rowCat, rowCatIdx) => {
            const rowItems = itemsByCategory[rowCat.id] ?? [];

            return rowItems.map((rowItem, rowItemIdx) => {
              const currentRowIdx = globalRowIdx + rowItemIdx;
              if (rowItemIdx === rowItems.length - 1) globalRowIdx += rowItems.length;

              return (
                <tr key={rowItem.id}>
                  {/* Row category label — vertical text, only on first item */}
                  {rowItemIdx === 0 && (
                    <td
                      rowSpan={rowItems.length}
                      className="w-6 text-center align-middle border-r border-fcc-bg-quaternary"
                    >
                      <span
                        className="font-mono text-base font-bold text-fcc-fg-secondary px-1 whitespace-nowrap"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        {rowCat.emoji ? `${rowCat.emoji} ${rowCat.label}` : rowCat.label}
                      </span>
                    </td>
                  )}

                  {/* Row item label */}
                  <th
                    scope="row"
                    className={`p-1 pr-2 text-right border border-fcc-bg-quaternary min-w-[60px] ${rowCatIdx % 2 === 0 ? "bg-fcc-bg-primary" : "bg-fcc-bg-tertiary"}`}
                  >
                    <HeaderLabel item={rowItem} />
                  </th>

                  {/* Cells for each column category */}
                  {colCategories.map((colCat) => {
                    const colItems = itemsByCategory[colCat.id] ?? [];
                    const colCatIdx = categories.findIndex((c) => c.id === colCat.id);
                    const rowCatGlobalIdx = categories.findIndex((c) => c.id === rowCat.id);
                    const shouldBlock = colCatIdx >= rowCatGlobalIdx;
                    const bandAlt = (colCatIdx + rowCatGlobalIdx) % 2 === 1;

                    if (shouldBlock) {
                      return colItems.map((colItem) => (
                        <td key={colItem.id} className="p-0 border border-transparent">
                          <Cell
                            display="blocked"
                            onClick={() => {}}
                            ariaLabel={`${rowItem.label} / ${colItem.label}: blocked`}
                          />
                        </td>
                      ));
                    }

                    return colItems.map((colItem) => {
                      const display = getDisplay(rowItem, colItem);
                      const waveDelay = (currentRowIdx + flatColOffset[colItem.id]) * 50;
                      const key = cellKey(rowItem.id, colItem.id);
                      const highlighted = tutorialTargetKey !== null && key === tutorialTargetKey;
                      const tutorialDimmed = tutorialTargetKey !== null && !tutorialFreeSolve && !highlighted;

                      return (
                        <td key={colItem.id} className="p-0 border border-fcc-bg-quaternary">
                          <Cell
                            display={display}
                            onClick={() => handleClick(rowItem, colItem)}
                            ariaLabel={`${rowItem.label} / ${colItem.label}: ${display}`}
                            bandAlt={bandAlt}
                            wave={wave}
                            waveDelay={waveDelay}
                            highlighted={highlighted}
                            tutorialDimmed={tutorialDimmed}
                          />
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            });
          })}
          {/* Legend row — sits inside tbody so columns auto-align */}
          <tr>
            <td className="w-6" />
            <td />
            <td colSpan={999} className="pt-3 pb-1">
              <div className="flex gap-4 text-xs text-fcc-fg-muted font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 flex items-center justify-center bg-cell-yes text-cell-yes-text font-bold rounded text-xs">✓</span>
                  Yes
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 flex items-center justify-center bg-cell-no text-cell-no-text font-bold rounded text-xs">✗</span>
                  No
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 flex items-center justify-center bg-cell-no text-cell-no-text font-bold rounded text-xs opacity-40">✗</span>
                  Auto
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
