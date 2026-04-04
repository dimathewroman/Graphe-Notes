#!/bin/bash
# Blocks file edits when not on a feature/* or fix/* branch.
# This enforces the rule: always create a feature/fix branch from master before editing.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)

if [[ -z "$BRANCH" ]]; then
  echo "Cannot determine current git branch. Make sure you are in the repo." >&2
  exit 2
fi

if [[ "$BRANCH" == feature/* || "$BRANCH" == fix/* ]]; then
  exit 0
fi

echo "BLOCKED: Current branch is '$BRANCH' — not a feature/* or fix/* branch." >&2
echo "You must start from master before editing any files:" >&2
echo "  git checkout master && git pull origin master && git checkout -b feature/<name>" >&2
exit 2
