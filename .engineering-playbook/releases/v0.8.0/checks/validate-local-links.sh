#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

while IFS= read -r markdown_file; do
  while IFS= read -r raw_link; do
    link="${raw_link#](}"
    link="${link%)}"
    link="${link%%#*}"

    case "$link" in
      ""|http://*|https://*|mailto:*|tel:*|data:*) continue ;;
    esac

    target="$(dirname "$markdown_file")/$link"
    if [[ ! -e "$target" ]]; then
      echo "Broken local Markdown link in ${markdown_file#"$repo_root"/}: $raw_link" >&2
      status=1
    fi
  done < <(grep -Eo '\]\([^)]*\)' "$markdown_file" || true)
done < <(find "$repo_root" -type f -name '*.md' -not -path "$repo_root/.git/*" -print | sort)

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

echo "Local Markdown link validation passed."
