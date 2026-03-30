#!/usr/bin/env python3
"""
Puzzle validator for lingua-grid-static.

Checks each puzzle file for:
  1. Structural integrity   — solution is a valid bijection, gridSize matches
  2. Clue/solution contradictions — explicit positives/negatives vs solution
  3. Numeric ordering clues — hour comparisons (B1) vs solution values
  4. Solution uniqueness    — PRE & A1/A2 only (structured clue types)

Usage:
  python3 scripts/validate_puzzles.py [file ...]

  With no arguments, validates all puzzle files in content/puzzle/.
"""

import json
import re
import sys
from itertools import permutations
from pathlib import Path

PUZZLE_DIR = Path(__file__).parent.parent / "content" / "puzzle"

# ─── Colours ──────────────────────────────────────────────────────────────────

GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):   return f"{GREEN}✅ {msg}{RESET}"
def err(msg):  return f"{RED}❌ {msg}{RESET}"
def warn(msg): return f"{YELLOW}⚠️  {msg}{RESET}"


# ─── Solution helpers ─────────────────────────────────────────────────────────

def parse_solution_triples(puzzle):
    """Return list of item-label tuples for YES entries (A1/A2/B1 format)."""
    return [
        tuple(s["itemLabels"])
        for s in puzzle["solution"]
        if s["value"] == "YES"
    ]

def parse_solution_matrix(puzzle):
    """Return dict {(row, col): bool} for PRE format."""
    return {
        (s["rowItemLabel"], s["colItemLabel"]): s["value"] == "YES"
        for s in puzzle["solution"]
    }

def is_pre_format(puzzle):
    return "rowItemLabel" in puzzle["solution"][0]


# ─── 1. Structural checks ─────────────────────────────────────────────────────

def check_structure(puzzle):
    issues = []
    cats = {c["order"]: c["label"] for c in puzzle["categories"]}
    n_cats = len(cats)
    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    # gridSize vs items per category
    for ci, items in items_by_cat.items():
        if len(items) != puzzle["gridSize"]:
            issues.append(err(
                f"Category {ci} ({cats.get(ci,'?')}) has {len(items)} items "
                f"but gridSize={puzzle['gridSize']}"
            ))

    all_labels = {item["label"] for item in puzzle["items"]}

    if is_pre_format(puzzle):
        matrix = parse_solution_matrix(puzzle)
        row_labels = items_by_cat.get(0, [])
        col_labels = items_by_cat.get(1, [])
        # Each row has exactly one YES
        for row in row_labels:
            yes_count = sum(1 for (r, c), v in matrix.items() if r == row and v)
            if yes_count != 1:
                issues.append(err(f"Row '{row}' has {yes_count} YES entries (expected 1)"))
        # Each col has exactly one YES
        for col in col_labels:
            yes_count = sum(1 for (r, c), v in matrix.items() if c == col and v)
            if yes_count != 1:
                issues.append(err(f"Col '{col}' has {yes_count} YES entries (expected 1)"))
        # All labels valid
        for (r, c) in matrix:
            if r not in all_labels:
                issues.append(err(f"Solution references unknown item '{r}'"))
            if c not in all_labels:
                issues.append(err(f"Solution references unknown item '{c}'"))
    else:
        triples = parse_solution_triples(puzzle)
        if len(triples) != puzzle["gridSize"]:
            issues.append(err(
                f"Expected {puzzle['gridSize']} YES triples, found {len(triples)}"
            ))
        # Each item appears exactly once
        for ci, items in items_by_cat.items():
            in_solution = [t[ci] for t in triples if ci < len(t)]
            for label in items:
                count = in_solution.count(label)
                if count != 1:
                    issues.append(err(
                        f"Item '{label}' (cat {ci}) appears {count}× in solution"
                    ))
        # All labels valid
        for triple in triples:
            for label in triple:
                if label not in all_labels:
                    issues.append(err(f"Solution references unknown item '{label}'"))

    return issues


# ─── 2. Clue/solution contradiction checks ───────────────────────────────────

# Patterns: (regex, direction)
# direction "pos" = label MUST be in same triple as subject
# direction "neg" = label MUST NOT be in same triple as subject

NEGATIVE_PATTERNS = [
    r"(\w[\w\s]*?) (?:didn't|does not|is not|never|not) (?:use|have|do|go|take|attend|like|drink|wear|focus on|work as|pick up|conclude|build|research|design|target|track|report|get advice from|work in|take up|listen to) (?:a |an |the )?(.+?)(?:\.|,|$)",
    r"(\w[\w\s]*?)'s? (?:pet|toy|color|colour|favourite color|favorite color|item) (?:is not|isn't) (?:a |an |the )?(.+?)(?:\.|,|$)",
    r"(\w+) is not (?:working as |a |an )?(.+?)(?:\.|,|$)",
    r"(\w+) (?:never|not) (?:\w+ )+?(?:a |an |the )?(.+?)(?:\.|,|$)",
]

POSITIVE_PATTERNS = [
    r"(\w[\w\s]*?) (?:has|have|is wearing|likes?|drinks?|uses?) (?:a |an |the )?(.+?)(?:\.|,|$)",
    r"(\w[\w\s]*?)'s? (?:pet|toy) is (?:a |an |the )?(.+?)(?:\.|,|$)",
]

def normalize(s):
    return s.strip().lower().rstrip(".")

def items_in_same_triple(label_a, label_b, triples):
    for triple in triples:
        labels = [l.lower() for l in triple]
        if label_a.lower() in labels and label_b.lower() in labels:
            return True
    return False

def check_clue_contradictions(puzzle):
    issues = []
    if is_pre_format(puzzle):
        return issues  # PRE format uses only positive/negative clue types; handled in uniqueness

    triples = parse_solution_triples(puzzle)
    all_labels = {item["label"].lower() for item in puzzle["items"]}

    for clue in puzzle["clues"]:
        text = clue["text"]
        ctype = clue.get("clueType", "")

        # Strip leading emoji
        text_clean = re.sub(r'^[\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF]\s*', '', text).strip()

        if ctype == "negative" or ctype == "relational":
            for pattern in NEGATIVE_PATTERNS:
                m = re.search(pattern, text_clean, re.IGNORECASE)
                if m:
                    subject = normalize(m.group(1))
                    obj     = normalize(m.group(2))
                    if subject in all_labels and obj in all_labels:
                        if items_in_same_triple(subject, obj, triples):
                            issues.append(err(
                                f"Negative clue violated: '{text_clean}' "
                                f"— but solution pairs '{subject}' with '{obj}'"
                            ))
                    break

        if ctype == "positive":
            for pattern in POSITIVE_PATTERNS:
                m = re.search(pattern, text_clean, re.IGNORECASE)
                if m:
                    subject = normalize(m.group(1))
                    obj     = normalize(m.group(2))
                    if subject in all_labels and obj in all_labels:
                        if not items_in_same_triple(subject, obj, triples):
                            issues.append(err(
                                f"Positive clue violated: '{text_clean}' "
                                f"— but solution does NOT pair '{subject}' with '{obj}'"
                            ))
                    break

    return issues


# ─── 3. Numeric ordering checks (B1 hours) ───────────────────────────────────

def parse_hours(label):
    """Extract integer from '35 hours' → 35."""
    m = re.match(r"(\d+)", label)
    return int(m.group(1)) if m else None

def check_numeric_ordering(puzzle):
    issues = []
    if is_pre_format(puzzle):
        return issues

    # Only applies when one category contains hour values
    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    hour_cat = None
    for ci, items in items_by_cat.items():
        if all(parse_hours(i) is not None for i in items):
            hour_cat = ci
            break
    if hour_cat is None:
        return issues

    triples = parse_solution_triples(puzzle)

    # Build lookup: label → hours value, job → hours value, person → hours value
    def hours_for(label):
        for triple in triples:
            if label.lower() in [t.lower() for t in triple]:
                return parse_hours(triple[hour_cat])
        return None

    ordering_patterns = [
        # "X worked more/fewer hours than the Y"   (person vs job)
        (r"(\w+) worked (more|fewer) hours than the (\w+)", "person_vs_job"),
        # "The X worked more/fewer/longer hours than the Y"  (job vs job)
        (r"[Tt]he (\w+) worked (more|fewer|longer|less) hours than the (\w+)", "job_vs_job"),
        # "X worked more/fewer hours than Y"   (person vs person)
        (r"(\w+) worked (more|fewer) hours than (\w+)", "person_vs_person"),
        # "X worked the most/fewest hours"
        (r"(\w+) worked the (most|fewest) hours", "extremes"),
        (r"(\w+) (?:spent|worked) more (?:time|hours) .+? than anyone else", "extremes_more"),
    ]

    all_labels_lower = {item["label"].lower() for item in puzzle["items"]}

    for clue in puzzle["clues"]:
        text = re.sub(r'^[\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF]\s*', '', clue["text"]).strip()

        for pattern, kind in ordering_patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if not m:
                continue

            if kind == "person_vs_job":
                name, direction, ref_job = m.group(1), m.group(2), m.group(3)
                h_name = hours_for(name)
                h_ref  = hours_for(ref_job)
                if h_name is not None and h_ref is not None:
                    expected = h_name > h_ref if direction == "more" else h_name < h_ref
                    if not expected:
                        issues.append(err(
                            f"Ordering violated: '{text}' "
                            f"— {name}={h_name}h, {ref_job}={h_ref}h"
                        ))

            elif kind == "job_vs_job":
                j1, direction, j2 = m.group(1).lower(), m.group(2), m.group(3).lower()
                h1 = hours_for(j1)
                h2 = hours_for(j2)
                if h1 is not None and h2 is not None:
                    expected = h1 > h2 if direction in ("more", "longer") else h1 < h2
                    if not expected:
                        issues.append(err(
                            f"Ordering violated: '{text}' "
                            f"— {j1}={h1}h, {j2}={h2}h"
                        ))

            elif kind == "person_vs_person":
                n1, direction, n2 = m.group(1), m.group(2), m.group(3)
                h1 = hours_for(n1)
                h2 = hours_for(n2)
                if h1 is not None and h2 is not None:
                    expected = h1 > h2 if direction == "more" else h1 < h2
                    if not expected:
                        issues.append(err(
                            f"Ordering violated: '{text}' "
                            f"— {n1}={h1}h, {n2}={h2}h"
                        ))

            elif kind in ("extremes", "extremes_more"):
                name = m.group(1)
                direction = m.group(2) if kind == "extremes" else "most"
                h_name = hours_for(name)
                all_hours = [parse_hours(triple[hour_cat]) for triple in triples]
                if h_name is not None and all_hours:
                    if direction in ("most", "more"):
                        expected = h_name == max(all_hours)
                    else:
                        expected = h_name == min(all_hours)
                    if not expected:
                        issues.append(err(
                            f"Ordering violated: '{text}' "
                            f"— {name}={h_name}h, all={sorted(all_hours)}"
                        ))
            break

    return issues


# ─── 4. Uniqueness check (PRE and A1/A2) ─────────────────────────────────────

LABEL_ALIASES = {
    # Clue idiom → canonical item label
    "home": "house",
}

PRONOUNS = {"he", "she", "his", "her", "him"}


def normalize_clue_text(text, all_labels):
    """
    Apply alias substitutions so that natural language variants in clue text
    resolve to actual item labels.

    Each alias is only applied when the alias source word is NOT itself a label
    in this puzzle (to avoid collisions like "home" being both an alias and a label).
    """
    labels_lower = {l.lower() for l in all_labels}
    for alias, canonical in LABEL_ALIASES.items():
        if alias.lower() not in labels_lower:
            text = re.sub(r'\b' + re.escape(alias) + r'\b', canonical, text, flags=re.IGNORECASE)
    return text


def label_matches(label, text):
    """
    Check whether a label appears in text, allowing for:
      - Exact whole-word match (case-insensitive)
      - Verb inflection: label 'reads' also matches 'read' in text
      - Plural/adverbial form in text: label 'Monday' matches 'Mondays' in text
    """
    if re.search(r'\b' + re.escape(label) + r'\b', text, re.IGNORECASE):
        return True
    # Label ends in 's': check stem (reads → read, runs → run)
    if label.endswith('s') and len(label) > 2:
        if re.search(r'\b' + re.escape(label[:-1]) + r'\b', text, re.IGNORECASE):
            return True
    # Text may have label+'s' (Monday → Mondays, Friday → Fridays, Sunday → Sundays)
    if re.search(r'\b' + re.escape(label) + r's\b', text, re.IGNORECASE):
        return True
    return False


def build_emoji_person_map(puzzle):
    """Map emoji character → item label for person-category items (category 0)."""
    emoji_map = {}
    for item in puzzle["items"]:
        if item["categoryIndex"] == 0 and "emoji" in item:
            emoji_map[item["emoji"]] = item["label"]
    return emoji_map


def resolve_pronouns(text, prev_person, emoji_person_map):
    """
    Replace He/She/His/Her/Him with a person label when one can be identified:
      - From an emoji at the start of the clue (A1 style)
      - From the last named person in the previous clue (A2 style)
    """
    if not re.search(r'\b(?:he|she|his|her|him)\b', text, re.IGNORECASE):
        return text

    resolved_name = None

    # Strategy 1: leading emoji maps to a person
    emoji_match = re.match(r'^([\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF])', text)
    if emoji_match and emoji_match.group(1) in emoji_person_map:
        resolved_name = emoji_person_map[emoji_match.group(1)]

    # Strategy 2: carry over from previous clue
    if resolved_name is None and prev_person:
        resolved_name = prev_person

    if resolved_name:
        text = re.sub(r'\b(he|she|his|her|him)\b', resolved_name, text, flags=re.IGNORECASE)

    return text


def build_constraints(puzzle):
    """
    Extract constraints by finding item labels mentioned in each clue.

    For each clue that mentions exactly 2 known item labels:
      positive / relational → the two labels must appear in the same triple
      negative              → they must NOT appear in the same triple

    Applies several normalisations to handle natural language variation:
      - Aliases  (home → house)
      - Verb inflection  (reads ↔ read)
      - Pronoun resolution  (He/She/His/Her → person name)
    """
    all_labels = [item["label"] for item in puzzle["items"]]
    emoji_person_map = build_emoji_person_map(puzzle)
    constraints = []
    prev_person = None   # tracks last explicitly-named person across clues

    for clue in puzzle["clues"]:
        raw_text = clue["text"]
        ctype    = clue.get("clueType", "")

        # Strip leading emoji for cleaner processing
        text = re.sub(r'^[\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF]\s*', '', raw_text).strip()

        # Alias normalisation
        text = normalize_clue_text(text, all_labels)

        # Pronoun resolution
        text = resolve_pronouns(raw_text + " " + text, prev_person, emoji_person_map)

        # Find which item labels appear in this clue text
        found = [label for label in all_labels if label_matches(label, text)]

        # Update prev_person: any person-category label explicitly mentioned
        person_labels = [item["label"] for item in puzzle["items"] if item["categoryIndex"] == 0]
        for pl in person_labels:
            if label_matches(pl, text):
                prev_person = pl
                break

        label_to_cat = {item["label"].lower(): item["categoryIndex"] for item in puzzle["items"]}

        if len(found) == 2:
            a, b = found[0].lower(), found[1].lower()
            if ctype in ("positive", "relational"):
                constraints.append(("pos", a, b))
            elif ctype == "negative":
                constraints.append(("neg", a, b))

        elif len(found) == 3:
            # Sort labels by category index so we know which is person/mid/highest
            sorted_labels = sorted(found, key=lambda l: label_to_cat.get(l.lower(), 99))
            a = sorted_labels[0].lower()  # lowest category (usually person)
            c = sorted_labels[2].lower()  # highest category (location/time/color)

            if ctype in ("positive", "relational"):
                # All three belong in the same triple → extract all pairwise pos constraints
                for i in range(3):
                    for j in range(i + 1, 3):
                        constraints.append(("pos", sorted_labels[i].lower(), sorted_labels[j].lower()))

            elif ctype == "negative":
                # "Person does not do Activity in Location" → person≠location
                # (the activity link is usually established by other clues)
                constraints.append(("neg", a, c))

    return constraints


def check_uniqueness(puzzle):
    """
    Only run for PRE and A1/A2 (structured clue types).
    Enumerates all valid bijection assignments and counts solutions.
    """
    issues = []
    level = puzzle.get("levelCode", "")
    if level not in ("PRE", "A1", "A2"):
        return issues

    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    cat_keys = sorted(items_by_cat.keys())
    if len(cat_keys) < 2:
        return issues

    constraints = build_constraints(puzzle)

    # Represent each candidate solution as a list of triples (one per base item).
    # cat_keys[0] is the "anchor" category; we permute all other categories.
    anchor_items = items_by_cat[cat_keys[0]]
    other_keys   = cat_keys[1:]
    other_items  = [items_by_cat[k] for k in other_keys]

    def triple_is_consistent(triples):
        """triples: list of tuples, one per anchor item."""
        label_set_per_row = [
            frozenset(t.lower() for t in triple)
            for triple in triples
        ]
        for ctype, a, b in constraints:
            paired = any(a in row and b in row for row in label_set_per_row)
            if ctype == "pos" and not paired:
                return False
            if ctype == "neg" and paired:
                return False
        return True

    MAX_SOLUTIONS = 3
    solutions_found = 0

    # Generate all combinations of permutations for the non-anchor categories
    from itertools import permutations as _perms

    perm_lists = [list(_perms(items)) for items in other_items]

    def iter_combinations(perm_idx, current_perms):
        nonlocal solutions_found
        if solutions_found >= MAX_SOLUTIONS:
            return
        if perm_idx == len(perm_lists):
            # Build triples: anchor[i] + current_perms[cat][i]
            triples = [
                tuple([anchor_items[i]] + [current_perms[j][i] for j in range(len(other_keys))])
                for i in range(len(anchor_items))
            ]
            if triple_is_consistent(triples):
                solutions_found += 1
            return
        for perm in perm_lists[perm_idx]:
            if solutions_found >= MAX_SOLUTIONS:
                return
            current_perms.append(perm)
            iter_combinations(perm_idx + 1, current_perms)
            current_perms.pop()

    iter_combinations(0, [])

    if solutions_found == 0:
        issues.append(err(
            "No valid solution found — clues may be over-constrained or contradictory"
        ))
    elif solutions_found > 1:
        issues.append(err(
            f"Under-constrained — {solutions_found}"
            f"{'+'if solutions_found >= MAX_SOLUTIONS else ''} "
            f"valid solutions exist (need more clues)"
        ))

    return issues


# ─── Main runner ──────────────────────────────────────────────────────────────

def validate_file(path):
    with open(path) as f:
        data = json.load(f)

    puzzles = data.get("puzzles", [])
    file_issues = 0
    print(f"\n{BOLD}{path.name}{RESET}  ({len(puzzles)} puzzles)")

    for i, puzzle in enumerate(puzzles):
        title = puzzle.get("title", f"Puzzle {i+1}")
        label = f"  #{i+1} {title}"

        all_issues = []
        all_issues += check_structure(puzzle)
        all_issues += check_clue_contradictions(puzzle)
        all_issues += check_numeric_ordering(puzzle)
        all_issues += check_uniqueness(puzzle)

        if all_issues:
            print(f"{label}")
            for issue in all_issues:
                print(f"      {issue}")
            file_issues += len(all_issues)
        else:
            print(f"{label}  {GREEN}✅{RESET}")

    return file_issues


def main():
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]
    else:
        paths = sorted(PUZZLE_DIR.glob("*.json"))

    if not paths:
        print(err("No puzzle files found."))
        sys.exit(1)

    total_issues = 0
    for path in paths:
        total_issues += validate_file(path)

    print()
    if total_issues == 0:
        print(ok(f"All puzzles passed validation."))
    else:
        print(err(f"{total_issues} issue(s) found across all files."))
        sys.exit(1)


if __name__ == "__main__":
    main()
