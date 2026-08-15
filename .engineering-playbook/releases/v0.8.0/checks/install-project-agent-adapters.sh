#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 PROJECT_ROOT" >&2
  exit 2
fi

project_root="$(cd "$1" && pwd)"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_if_absent() {
  local source_file="$1"
  local destination="$2"
  local destination_parent

  if [[ -e "$destination" ]]; then
    echo "Preserved existing agent guidance: $destination"
    return
  fi

  destination_parent="$(dirname "$destination")"
  mkdir -p "$destination_parent"
  cp "$source_file" "$destination"
  echo "Installed agent discovery adapter: $destination"
}

install_if_absent "$repo_root/adapters/CLAUDE.example.md" "$project_root/CLAUDE.md"
install_if_absent "$repo_root/adapters/GEMINI.example.md" "$project_root/GEMINI.md"
install_if_absent "$repo_root/adapters/copilot-instructions.example.md" "$project_root/.github/copilot-instructions.md"

echo "Cursor and supporting GitHub Copilot surfaces read the repository-root AGENTS.md directly."
