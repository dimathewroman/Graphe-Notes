#!/bin/bash
# Blocks file edits when not on a feature/* or fix/* branch.
# This enforces the rule: always create a feature/fix branch from master before editing.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)

if [[ -z "$BRANCH" ]]; then
  echo "Cannot determine current git branch. Make sure you are in the repo." >&2
  exit 2
fi

if [[ "$BRANCH" == feature/* || "$BRANCH" == fix/* || "$BRANCH" == chore/* || "$BRANCH" == refactor/* || "$BRANCH" == test/* ]]; then
  exit 0
fi

echo "BLOCKED: You are on branch '$BRANCH' — not a feature/*, fix/*, chore/*, refactor/*, or test/* branch." >&2
echo "Switch to an allowed branch first." >&2
echo "  To start fresh:    git fetch origin && git checkout master && git pull origin master && git checkout -b feature/<name>" >&2
echo "  To resume a branch: git checkout feature/<name>" >&2
exit 2
