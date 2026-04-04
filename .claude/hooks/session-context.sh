#!/bin/bash
# Injects current git branch and status into Claude's context on every prompt.
# This ensures Claude always knows which branch it is on before responding.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git -C "$CLAUDE_PROJECT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

if [[ "$BRANCH" == feature/* || "$BRANCH" == fix/* ]]; then
  BRANCH_STATUS="OK"
else
  BRANCH_STATUS="WARNING — not a feature/* or fix/* branch"
fi

echo "[git] branch: $BRANCH ($BRANCH_STATUS) | uncommitted files: $DIRTY"
