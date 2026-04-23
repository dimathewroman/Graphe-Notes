#!/bin/bash
# pre-push: typecheck before every push to catch TS errors locally.
# Installed automatically — copy to .git/hooks/pre-push and chmod +x.
set -e

echo "→ Running typecheck..."
pnpm run typecheck
echo "✓ Typecheck passed."
