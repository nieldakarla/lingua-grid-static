#!/bin/sh
# Validate puzzle JSON files before committing.
# Skip with: git commit --no-verify

# Only run if puzzle files were changed
PUZZLE_FILES=$(git diff --cached --name-only | grep 'content/puzzle/.*\.json')

if [ -z "$PUZZLE_FILES" ]; then
  exit 0
fi

echo "Running puzzle validator..."
python3 scripts/validate_puzzles.py $PUZZLE_FILES

if [ $? -ne 0 ]; then
  echo ""
  echo "Puzzle validation failed. Fix the issues above or use --no-verify to skip."
  exit 1
fi
