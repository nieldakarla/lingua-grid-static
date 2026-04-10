#!/usr/bin/env python3
"""
Puzzle validator for lingua-grid-static.

Checks each puzzle file for:
  1. Structural integrity   — solution is a valid bijection, gridSize matches,
                              categoryCount and allowedClueTypes per config
  2. Clue/solution contradictions — explicit positives/negatives vs solution
  3. Numeric ordering clues — hour comparisons (B1) vs solution values
  4. Solution uniqueness    — levels where requireUniqueSolution: true in config
  5. Min relational clues   — A1 requires at least minRelationalClues per config

Severity (fail/warn) is driven by puzzle.config.json in the repo root.
Warnings are printed but do not cause a non-zero exit code.

Usage:
  python3 scripts/validate_puzzles.py [file ...]

  With no arguments, validates all puzzle files in content/puzzle/.
"""

import json
import re
import sys
from itertools import permutations
from pathlib import Path

PUZZLE_DIR  = Path(__file__).parent.parent / "content" / "puzzle"
CONFIG_PATH = Path(__file__).parent.parent / "puzzle.config.json"

# ─── Config ───────────────────────────────────────────────────────────────────

def _load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

CONFIG = _load_config()

def level_cfg(level_code: str) -> dict:
    return CONFIG.get("levels", {}).get(level_code, {})

def quality_severity(check_name: str) -> str:
    """Return 'fail' or 'warn' (default 'fail' if not configured)."""
    q = CONFIG.get("quality", {})
    val = q.get(check_name, "fail")
    if isinstance(val, dict):          # e.g. pairCoverage: {default: "warn", byTheme: {}}
        val = val.get("default", "fail")
    return val


# ─── Colours ──────────────────────────────────────────────────────────────────

GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):   return f"{GREEN}✅ {msg}{RESET}"
def err(msg):  return f"{RED}❌ {msg}{RESET}"
def warn(msg): return f"{YELLOW}⚠️  {msg}{RESET}"

def issue(severity: str, msg: str) -> str:
    """Format a message according to its severity string."""
    return warn(msg) if severity == "warn" else err(msg)


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
    errors = []
    warnings = []
    level = puzzle.get("levelCode", "")
    lcfg  = level_cfg(level)

    cats = {c["order"]: c["label"] for c in puzzle["categories"]}
    n_cats = len(cats)
    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    # Category count (config-driven)
    expected_cats = lcfg.get("categoryCount")
    if expected_cats is not None and n_cats != expected_cats:
        errors.append(err(
            f"Level {level} expects {expected_cats} categories, found {n_cats}"
        ))

    # gridSize vs items per category
    for ci, items in items_by_cat.items():
        if len(items) != puzzle["gridSize"]:
            errors.append(err(
                f"Category {ci} ({cats.get(ci,'?')}) has {len(items)} items "
                f"but gridSize={puzzle['gridSize']}"
            ))

    # Allowed clue types (config-driven)
    allowed = lcfg.get("allowedClueTypes")
    if allowed is not None:
        for clue in puzzle.get("clues", []):
            ctype = clue.get("clueType", "")
            if ctype not in allowed:
                errors.append(err(
                    f"Level {level} disallows clueType '{ctype}' "
                    f"(allowed: {allowed}) — clue: \"{clue['text'][:60]}\""
                ))

    all_labels = {item["label"] for item in puzzle["items"]}

    if is_pre_format(puzzle):
        matrix = parse_solution_matrix(puzzle)
        row_labels = items_by_cat.get(0, [])
        col_labels = items_by_cat.get(1, [])
        for row in row_labels:
            yes_count = sum(1 for (r, c), v in matrix.items() if r == row and v)
            if yes_count != 1:
                errors.append(err(f"Row '{row}' has {yes_count} YES entries (expected 1)"))
        for col in col_labels:
            yes_count = sum(1 for (r, c), v in matrix.items() if c == col and v)
            if yes_count != 1:
                errors.append(err(f"Col '{col}' has {yes_count} YES entries (expected 1)"))
        for (r, c) in matrix:
            if r not in all_labels:
                errors.append(err(f"Solution references unknown item '{r}'"))
            if c not in all_labels:
                errors.append(err(f"Solution references unknown item '{c}'"))
    else:
        triples = parse_solution_triples(puzzle)
        if len(triples) != puzzle["gridSize"]:
            errors.append(err(
                f"Expected {puzzle['gridSize']} YES triples, found {len(triples)}"
            ))
        for ci, items in items_by_cat.items():
            in_solution = [t[ci] for t in triples if ci < len(t)]
            for label in items:
                count = in_solution.count(label)
                if count != 1:
                    errors.append(err(
                        f"Item '{label}' (cat {ci}) appears {count}× in solution"
                    ))
        for triple in triples:
            for label in triple:
                if label not in all_labels:
                    errors.append(err(f"Solution references unknown item '{label}'"))

    return errors, warnings


# ─── 2. Clue/solution contradiction checks ───────────────────────────────────

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
    errors = []
    warnings = []
    severity = quality_severity("contradiction")

    if is_pre_format(puzzle):
        return errors, warnings  # PRE uses only positive/negative clue types; handled in uniqueness

    triples = parse_solution_triples(puzzle)
    all_labels = {item["label"].lower() for item in puzzle["items"]}

    for clue in puzzle["clues"]:
        text  = clue["text"]
        ctype = clue.get("clueType", "")

        text_clean = re.sub(r'^[\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF]\s*', '', text).strip()

        if ctype in ("negative", "relational"):
            for pattern in NEGATIVE_PATTERNS:
                m = re.search(pattern, text_clean, re.IGNORECASE)
                if m:
                    subject = normalize(m.group(1))
                    obj     = normalize(m.group(2))
                    if subject in all_labels and obj in all_labels:
                        if items_in_same_triple(subject, obj, triples):
                            msg = (
                                f"Negative clue violated: '{text_clean}' "
                                f"— but solution pairs '{subject}' with '{obj}'"
                            )
                            (errors if severity == "fail" else warnings).append(
                                issue(severity, msg)
                            )
                    break

        if ctype == "positive":
            for pattern in POSITIVE_PATTERNS:
                m = re.search(pattern, text_clean, re.IGNORECASE)
                if m:
                    subject = normalize(m.group(1))
                    obj     = normalize(m.group(2))
                    if subject in all_labels and obj in all_labels:
                        if not items_in_same_triple(subject, obj, triples):
                            msg = (
                                f"Positive clue violated: '{text_clean}' "
                                f"— but solution does NOT pair '{subject}' with '{obj}'"
                            )
                            (errors if severity == "fail" else warnings).append(
                                issue(severity, msg)
                            )
                    break

    return errors, warnings


# ─── 3. Numeric ordering checks (B1 hours) ───────────────────────────────────

def parse_hours(label):
    m = re.match(r"(\d+)", label)
    return int(m.group(1)) if m else None

def check_numeric_ordering(puzzle):
    errors = []
    warnings = []
    severity = quality_severity("numericOrdering")

    if is_pre_format(puzzle):
        return errors, warnings

    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    hour_cat = None
    for ci, items in items_by_cat.items():
        if all(parse_hours(i) is not None for i in items):
            hour_cat = ci
            break
    if hour_cat is None:
        return errors, warnings

    triples = parse_solution_triples(puzzle)

    def hours_for(label):
        for triple in triples:
            if label.lower() in [t.lower() for t in triple]:
                return parse_hours(triple[hour_cat])
        return None

    ordering_patterns = [
        (r"(\w+) worked (more|fewer) hours than the (\w+)", "person_vs_job"),
        (r"[Tt]he (\w+) worked (more|fewer|longer|less) hours than the (\w+)", "job_vs_job"),
        (r"(\w+) worked (more|fewer) hours than (\w+)", "person_vs_person"),
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

            violated = False
            detail   = ""

            if kind == "person_vs_job":
                name, direction, ref_job = m.group(1), m.group(2), m.group(3)
                h_name = hours_for(name)
                h_ref  = hours_for(ref_job)
                if h_name is not None and h_ref is not None:
                    expected = h_name > h_ref if direction == "more" else h_name < h_ref
                    if not expected:
                        violated = True
                        detail = f"{name}={h_name}h, {ref_job}={h_ref}h"

            elif kind == "job_vs_job":
                j1, direction, j2 = m.group(1).lower(), m.group(2), m.group(3).lower()
                h1 = hours_for(j1)
                h2 = hours_for(j2)
                if h1 is not None and h2 is not None:
                    expected = h1 > h2 if direction in ("more", "longer") else h1 < h2
                    if not expected:
                        violated = True
                        detail = f"{j1}={h1}h, {j2}={h2}h"

            elif kind == "person_vs_person":
                n1, direction, n2 = m.group(1), m.group(2), m.group(3)
                h1 = hours_for(n1)
                h2 = hours_for(n2)
                if h1 is not None and h2 is not None:
                    expected = h1 > h2 if direction == "more" else h1 < h2
                    if not expected:
                        violated = True
                        detail = f"{n1}={h1}h, {n2}={h2}h"

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
                        violated = True
                        detail = f"{name}={h_name}h, all={sorted(all_hours)}"

            if violated:
                msg = f"Ordering violated: '{text}' — {detail}"
                (errors if severity == "fail" else warnings).append(issue(severity, msg))
            break

    return errors, warnings


# ─── 4. Uniqueness check ──────────────────────────────────────────────────────

LABEL_ALIASES = {
    "home": "house",
}

PRONOUNS = {"he", "she", "his", "her", "him"}


def normalize_clue_text(text, all_labels):
    labels_lower = {l.lower() for l in all_labels}
    for alias, canonical in LABEL_ALIASES.items():
        if alias.lower() not in labels_lower:
            text = re.sub(r'\b' + re.escape(alias) + r'\b', canonical, text, flags=re.IGNORECASE)
    return text


def label_matches(label, text):
    if re.search(r'\b' + re.escape(label) + r'\b', text, re.IGNORECASE):
        return True
    if label.endswith('s') and len(label) > 2:
        if re.search(r'\b' + re.escape(label[:-1]) + r'\b', text, re.IGNORECASE):
            return True
    if re.search(r'\b' + re.escape(label) + r's\b', text, re.IGNORECASE):
        return True
    return False


def build_emoji_person_map(puzzle):
    emoji_map = {}
    for item in puzzle["items"]:
        if item["categoryIndex"] == 0 and "emoji" in item:
            emoji_map[item["emoji"]] = item["label"]
    return emoji_map


def resolve_pronouns(text, prev_person, emoji_person_map):
    if not re.search(r'\b(?:he|she|his|her|him)\b', text, re.IGNORECASE):
        return text

    resolved_name = None

    emoji_match = re.match(r'^([\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF])', text)
    if emoji_match and emoji_match.group(1) in emoji_person_map:
        resolved_name = emoji_person_map[emoji_match.group(1)]

    if resolved_name is None and prev_person:
        resolved_name = prev_person

    if resolved_name:
        text = re.sub(r'\b(he|she|his|her|him)\b', resolved_name, text, flags=re.IGNORECASE)

    return text


def build_constraints(puzzle):
    all_labels = [item["label"] for item in puzzle["items"]]
    emoji_person_map = build_emoji_person_map(puzzle)
    constraints = []
    prev_person = None

    for clue in puzzle["clues"]:
        raw_text = clue["text"]
        ctype    = clue.get("clueType", "")

        text = re.sub(r'^[\U00010000-\U0010ffff\u2600-\u27BF\U0001F300-\U0001FAFF]\s*', '', raw_text).strip()
        text = normalize_clue_text(text, all_labels)
        text = resolve_pronouns(raw_text + " " + text, prev_person, emoji_person_map)

        found = [label for label in all_labels if label_matches(label, text)]

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
            sorted_labels = sorted(found, key=lambda l: label_to_cat.get(l.lower(), 99))
            a = sorted_labels[0].lower()
            c = sorted_labels[2].lower()

            if ctype in ("positive", "relational"):
                for i in range(3):
                    for j in range(i + 1, 3):
                        constraints.append(("pos", sorted_labels[i].lower(), sorted_labels[j].lower()))
            elif ctype == "negative":
                constraints.append(("neg", a, c))

    return constraints


def check_uniqueness(puzzle):
    errors = []
    warnings = []
    level = puzzle.get("levelCode", "")
    lcfg  = level_cfg(level)
    severity = quality_severity("uniqueness")

    # Only run if this level requires unique solutions
    if not lcfg.get("requireUniqueSolution", False):
        return errors, warnings

    # Constraint extraction uses English regex patterns — skip for other languages
    lang = puzzle.get("languageCode", "en")
    if lang != "en":
        print(f"      {YELLOW}ℹ️  uniqueness check skipped (non-English clues — verify separately){RESET}")
        return errors, warnings

    items_by_cat = {}
    for item in puzzle["items"]:
        items_by_cat.setdefault(item["categoryIndex"], []).append(item["label"])

    cat_keys = sorted(items_by_cat.keys())
    if len(cat_keys) < 2:
        return errors, warnings

    constraints = build_constraints(puzzle)

    anchor_items = items_by_cat[cat_keys[0]]
    other_keys   = cat_keys[1:]
    other_items  = [items_by_cat[k] for k in other_keys]

    def triple_is_consistent(triples):
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

    from itertools import permutations as _perms
    perm_lists = [list(_perms(items)) for items in other_items]

    def iter_combinations(perm_idx, current_perms):
        nonlocal solutions_found
        if solutions_found >= MAX_SOLUTIONS:
            return
        if perm_idx == len(perm_lists):
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
        msg = "No valid solution found — clues may be over-constrained or contradictory"
        (errors if severity == "fail" else warnings).append(issue(severity, msg))
    elif solutions_found > 1:
        msg = (
            f"Under-constrained — {solutions_found}"
            f"{'+'if solutions_found >= MAX_SOLUTIONS else ''} "
            f"valid solutions exist (need more clues)"
        )
        (errors if severity == "fail" else warnings).append(issue(severity, msg))

    return errors, warnings


# ─── 5. Pair coverage check ──────────────────────────────────────────────────

def check_pair_coverage(puzzle):
    """
    For every pair of categories (A↔B, A↔C, B↔C, …), at least one clue should
    mention items from both categories.  Works for any number of categories and
    any language — uses item labels directly, not text patterns.
    Always emits warnings (never errors).
    """
    errors = []
    warnings = []

    if is_pre_format(puzzle):
        return errors, warnings  # PRE has only 2 categories — one pair by definition

    all_items  = puzzle.get("items", [])
    label_to_cat = {item["label"].lower(): item["categoryIndex"] for item in all_items}
    n_cats = len(puzzle.get("categories", []))

    if n_cats < 3:
        return errors, warnings

    # Count how many clues cover each category pair
    pair_counts = {}
    for a in range(n_cats):
        for b in range(a + 1, n_cats):
            pair_counts[(a, b)] = 0

    for clue in puzzle.get("clues", []):
        text = clue.get("text", "")
        cats_in_clue = set()
        for item in all_items:
            if re.search(r'\b' + re.escape(item["label"]) + r'\b', text, re.IGNORECASE):
                cats_in_clue.add(item["categoryIndex"])
        # Mark every pair of categories that both appear in this clue
        cats_list = sorted(cats_in_clue)
        for i in range(len(cats_list)):
            for j in range(i + 1, len(cats_list)):
                key = (cats_list[i], cats_list[j])
                if key in pair_counts:
                    pair_counts[key] += 1

    cat_labels = {c["order"]: c["label"] for c in puzzle.get("categories", [])}

    for (a, b), count in sorted(pair_counts.items()):
        if count == 0:
            warnings.append(warn(
                f"No clue covers the {cat_labels.get(a, a)}↔{cat_labels.get(b, b)} pair"
            ))

    return errors, warnings


# ─── Main runner ──────────────────────────────────────────────────────────────

def validate_file(path):
    with open(path) as f:
        data = json.load(f)

    puzzles = data.get("puzzles", [])
    file_errors = 0
    file_warnings = 0
    print(f"\n{BOLD}{path.name}{RESET}  ({len(puzzles)} puzzles)")

    for i, puzzle in enumerate(puzzles):
        title = puzzle.get("title", f"Puzzle {i+1}")
        label = f"  #{i+1} {title}"

        all_errors   = []
        all_warnings = []

        for check in (check_structure, check_clue_contradictions,
                      check_numeric_ordering, check_uniqueness,
                      check_pair_coverage):
            e, w = check(puzzle)
            all_errors   += e
            all_warnings += w

        if all_errors or all_warnings:
            print(label)
            for msg in all_errors:
                print(f"      {msg}")
            for msg in all_warnings:
                print(f"      {msg}")
        else:
            print(f"{label}  {GREEN}✅{RESET}")

        file_errors   += len(all_errors)
        file_warnings += len(all_warnings)

    return file_errors, file_warnings


def main():
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]
    else:
        paths = sorted(PUZZLE_DIR.glob("*.json"))

    if not paths:
        print(err("No puzzle files found."))
        sys.exit(1)

    total_errors   = 0
    total_warnings = 0
    for path in paths:
        e, w = validate_file(path)
        total_errors   += e
        total_warnings += w

    print()
    if total_errors == 0 and total_warnings == 0:
        print(ok("All puzzles passed validation."))
    else:
        if total_warnings:
            print(warn(f"{total_warnings} warning(s) — review recommended."))
        if total_errors:
            print(err(f"{total_errors} error(s) found across all files."))
            sys.exit(1)
        else:
            print(ok("All puzzles passed validation (with warnings above)."))


if __name__ == "__main__":
    main()
