#!/bin/bash
# pre-push: runs typecheck before every push to catch TS errors locally.
# Installed automatically by scripts/install-hooks.sh.
set -e

echo "→ Running typecheck before push..."
pnpm run typecheck
echo "✓ Typecheck passed."
