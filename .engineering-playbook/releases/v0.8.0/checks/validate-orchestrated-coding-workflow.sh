#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
guide="$repo_root/guides/orchestrated-coding-delivery.md"
template="$repo_root/templates/orchestrated-coding-task-record.md"

for required_file in "$guide" "$template"; do
  [[ -f "$required_file" ]] || { echo "Missing orchestrated coding artifact: $required_file" >&2; exit 1; }
done

for required_text in \
  'smallest builder/reviewer topology' \
  'does **not** author product code' \
  'report-before-60-minutes checkpoint' \
  'GPT-5.6 Luna' \
  'GPT-5.6 Terra' \
  'GPT-5.6 Sol' \
  'silently replace an unavailable named tier' \
  'Every implementation receives an independent Sol review' \
  'PASS' \
  'BLOCK' \
  'dedicated integration worktree'; do
  grep -Fq "$required_text" "$guide" || { echo "Orchestrated coding guide missing: $required_text" >&2; exit 1; }
done

grep -Fq '(orchestrated-coding-delivery.md)' "$repo_root/guides/README.md" || { echo "Guide index does not link orchestrated coding delivery." >&2; exit 1; }
grep -Fq 'orchestrated-coding-task-record.md' "$repo_root/guides/README.md" || { echo "Guide index does not link task record template." >&2; exit 1; }

echo "Orchestrated coding workflow validation passed."
