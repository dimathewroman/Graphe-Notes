#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version_file="$repo_root/VERSION"
playbook_file="$repo_root/PLAYBOOK.md"
changelog_file="$repo_root/CHANGELOG.md"
release_registry="$repo_root/RELEASES.md"

version="$(tr -d '[:space:]' < "$version_file")"
playbook_version="$(awk -F '|' '/^\| Version \|/ { value=$3; gsub(/^[[:space:]]+|[[:space:]]+$/, "", value); print value; exit }' "$playbook_file")"

if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Playbook VERSION must be a stable Semantic Version without a leading v: $version" >&2
  exit 1
fi

if [[ -z "$version" || "$version" != "$playbook_version" ]]; then
  echo "VERSION ($version) does not match PLAYBOOK.md ($playbook_version)." >&2
  exit 1
fi

if ! grep -Fq "### $version —" "$playbook_file"; then
  echo "PLAYBOOK.md has no change-log entry for $version." >&2
  exit 1
fi

if ! grep -Fq "## $version —" "$changelog_file"; then
  echo "CHANGELOG.md has no release entry for $version." >&2
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  playbook_checksum="$(shasum -a 256 "$playbook_file" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  playbook_checksum="$(sha256sum "$playbook_file" | awk '{print $1}')"
else
  echo "Neither shasum nor sha256sum is available." >&2
  exit 1
fi

registered_checksum="$(awk -F '|' -v wanted="$version" '
  /^\|/ {
    release_version=$2
    checksum=$4
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", release_version)
    gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", checksum)
    if (release_version == wanted) {
      print tolower(checksum)
      exit
    }
  }
' "$release_registry")"

if [[ -z "$registered_checksum" || "$registered_checksum" != "$playbook_checksum" ]]; then
  echo "RELEASES.md checksum for v$version does not match PLAYBOOK.md ($playbook_checksum)." >&2
  exit 1
fi

while IFS= read -r uses_reference; do
  action_reference="${uses_reference##*@}"
  if [[ ! "$action_reference" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "GitHub Actions must be pinned to full commit SHAs, with an optional version comment: $uses_reference" >&2
    exit 1
  fi
done < <(grep -RhoE 'uses:[[:space:]]+[^#[:space:]]+@[^#[:space:]]+' "$repo_root/.github/workflows" || true)

if grep -Fq 'REPLACE_AFTER_PLAYBOOK_UPDATE' "$release_registry"; then
  echo "RELEASES.md still contains an unreplaced release checksum placeholder." >&2
  exit 1
fi

for check_script in "$repo_root"/checks/*.sh; do
  bash -n "$check_script"
  if [[ ! -x "$check_script" ]]; then
    echo "Check script is not executable: $check_script" >&2
    exit 1
  fi
done
bash "$repo_root/checks/validate-local-links.sh"
bash "$repo_root/checks/test-adoption-workflows.sh"
bash "$repo_root/checks/validate-orchestrated-coding-workflow.sh"

for required_routing_text in \
  'check-latest-guidance.sh' \
  'Pinned playbook path:' \
  'Repository release identity and version policy:' \
  'Conditional specialist guides:' \
  'Not Applicable guides and rationales:'; do
  if ! grep -Fq "$required_routing_text" "$repo_root/adapters/AGENTS.example.md"; then
    echo "Project adapter is missing latest-aware routing text: $required_routing_text" >&2
    exit 1
  fi
done

if ! grep -Fq 'bootstrap-project.sh' "$repo_root/adapters/CODEX-GLOBAL-AGENTS.example.md"; then
  echo "Codex global adapter does not route new projects through bootstrap-project.sh." >&2
  exit 1
fi

for required_check in \
  checks/adopt-release.sh \
  checks/release-status.sh \
  checks/install-project-agent-adapters.sh; do
  if [[ ! -x "$repo_root/$required_check" ]]; then
    echo "Required adoption command is missing or not executable: $required_check" >&2
    exit 1
  fi
done

for required_adapter in \
  adapters/CLAUDE.example.md \
  adapters/GEMINI.example.md \
  adapters/copilot-instructions.example.md; do
  if [[ ! -f "$repo_root/$required_adapter" ]]; then
    echo "Required cross-agent adapter is missing: $required_adapter" >&2
    exit 1
  fi
done

while IFS= read -r guide_file; do
  guide_name="$(basename "$guide_file")"
  if [[ "$guide_name" == "README.md" ]]; then
    continue
  fi
  if ! grep -Fq "($guide_name)" "$repo_root/guides/README.md"; then
    echo "Guide is not linked from guides/README.md: $guide_name" >&2
    exit 1
  fi
done < <(find "$repo_root/guides" -maxdepth 1 -type f -name '*.md' -print | sort)

echo "Repository validation passed for playbook v$version."
