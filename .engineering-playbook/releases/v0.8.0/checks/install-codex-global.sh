#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--replace]" >&2
}

replace_existing=0
if [[ "$#" -gt 1 ]]; then
  usage
  exit 2
fi
if [[ "$#" -eq 1 ]]; then
  if [[ "$1" != "--replace" ]]; then
    usage
    exit 2
  fi
  replace_existing=1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="$repo_root/adapters/CODEX-GLOBAL-AGENTS.example.md"
codex_root="${CODEX_HOME:-$HOME/.codex}"
destination="$codex_root/AGENTS.md"

if [[ -f "$destination" ]] && cmp -s "$source_file" "$destination"; then
  echo "Codex global Engineering Playbook discovery is already current: $destination"
  exit 0
fi

if [[ -s "$destination" && "$replace_existing" -ne 1 ]]; then
  echo "Refusing to replace non-empty global Codex guidance: $destination" >&2
  echo "Review it, preserve unrelated instructions, or rerun with --replace after approval." >&2
  exit 1
fi

mkdir -p "$codex_root"
temporary_file="$(mktemp "$codex_root/.engineering-playbook-global.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT
cp "$source_file" "$temporary_file"
chmod 0644 "$temporary_file"
mv "$temporary_file" "$destination"
trap - EXIT

echo "Installed Codex global Engineering Playbook discovery: $destination"
echo "Start a new Codex task or session to load the updated global instructions."
