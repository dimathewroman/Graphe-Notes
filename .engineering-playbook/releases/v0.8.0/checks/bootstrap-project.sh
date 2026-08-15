#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 PROJECT_ROOT [VERSION]" >&2
  echo "VERSION defaults to the latest registered stable release." >&2
}

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  usage
  exit 2
fi

project_root="$(cd "$1" && pwd)"
requested_version="${2:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

project_display_name() {
  local root="$1"
  local common_dir

  if git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    common_dir="$(git -C "$root" rev-parse --git-common-dir)"
    if [[ "$common_dir" != /* ]]; then
      common_dir="$(cd "$root/$common_dir" && pwd)"
    fi
    if [[ "$(basename "$common_dir")" == ".git" ]]; then
      basename "$(dirname "$common_dir")"
      return
    fi
  fi

  basename "$root"
}

if [[ -z "$requested_version" ]]; then
  release_status="$($repo_root/checks/release-status.sh --machine)"
  publication_status="$(awk -F= '$1 == "publication_status" {print $2}' <<< "$release_status")"
  requested_version="$(awk -F= '$1 == "latest_guidance_version" {print $2}' <<< "$release_status")"
  if [[ "$publication_status" == "verified" ]]; then
    echo "Bootstrapping latest verified-published playbook release v$requested_version."
  else
    echo "Publication verification is unavailable; bootstrapping locally validated tag v$requested_version."
  fi
fi
requested_version="${requested_version#v}"
release_revision="refs/tags/v$requested_version"
if git -C "$repo_root" rev-parse --verify --quiet "refs/engineering-playbook/published/v$requested_version^{commit}" >/dev/null; then
  release_revision="refs/engineering-playbook/published/v$requested_version"
fi

registered_checksum="$({ git -C "$repo_root" show "$release_revision:RELEASES.md" 2>/dev/null | awk -F '|' -v wanted="$requested_version" '
  /^\|/ {
    version=$2
    checksum=$4
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", version)
    gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", checksum)
    if (version == wanted) {
      print tolower(checksum)
      exit
    }
  }
'; } || true)"

if [[ -z "$registered_checksum" ]]; then
  echo "Version $requested_version is not available as a self-registered local tagged release." >&2
  exit 1
fi

bundle_root="$project_root/.engineering-playbook/releases/v$requested_version"
if [[ -e "$project_root/AGENTS.md" ]]; then
  echo "Existing AGENTS.md was not modified: $project_root/AGENTS.md" >&2
  echo "Install or update the adoption profile through a separate reviewed project change." >&2
  exit 1
fi

if [[ ! -d "$bundle_root" ]]; then
  "$repo_root/checks/export-release.sh" "$requested_version" "$bundle_root"
fi

if command -v shasum >/dev/null 2>&1; then
  bundle_checksum="$(shasum -a 256 "$bundle_root/PLAYBOOK.md" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  bundle_checksum="$(sha256sum "$bundle_root/PLAYBOOK.md" | awk '{print $1}')"
else
  echo "Neither shasum nor sha256sum is available." >&2
  exit 1
fi

if [[ "$bundle_checksum" != "$registered_checksum" ]]; then
  echo "Existing release bundle checksum $bundle_checksum does not match v$requested_version registry $registered_checksum." >&2
  exit 1
fi

project_name="$(project_display_name "$project_root")"
template="$repo_root/adapters/AGENTS.example.md"
temporary_agents="$(mktemp "${TMPDIR:-/tmp}/engineering-playbook-agents.XXXXXX")"
trap 'rm -f "$temporary_agents"' EXIT

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[|&\\]/\\&/g'
}

escaped_project_name="$(escape_sed_replacement "$project_name")"
escaped_version="$(escape_sed_replacement "$requested_version")"
escaped_checksum="$(escape_sed_replacement "$registered_checksum")"
escaped_playbook_path="$(escape_sed_replacement ".engineering-playbook/releases/v$requested_version/PLAYBOOK.md")"
escaped_guide_index_path="$(escape_sed_replacement "../.engineering-playbook/releases/v$requested_version/guides/README.md")"

sed \
  -e "s|{{PROJECT_NAME}}|$escaped_project_name|g" \
  -e "s|{{PLAYBOOK_VERSION}}|$escaped_version|g" \
  -e "s|{{PLAYBOOK_SHA256}}|$escaped_checksum|g" \
  -e "s|{{PINNED_PLAYBOOK_PATH}}|$escaped_playbook_path|g" \
  "$template" > "$temporary_agents"

mv "$temporary_agents" "$project_root/AGENTS.md"
trap - EXIT

if [[ ! -e "$project_root/docs/ENGINEERING-PROFILE.md" ]]; then
  mkdir -p "$project_root/docs"
  sed \
    -e "s|{{PROJECT_NAME}}|$escaped_project_name|g" \
    -e "s|{{PLAYBOOK_VERSION}}|$escaped_version|g" \
    -e "s|{{PLAYBOOK_SHA256}}|$escaped_checksum|g" \
    -e "s|../guides/README.md|$escaped_guide_index_path|g" \
    "$repo_root/templates/engineering-profile.md" > "$project_root/docs/ENGINEERING-PROFILE.md"
fi

release_policy_template="$bundle_root/templates/release-versioning-policy.md"
if [[ -f "$release_policy_template" && ! -e "$project_root/docs/RELEASE-POLICY.md" ]]; then
  sed \
    -e "s|{{PROJECT_NAME}}|$escaped_project_name|g" \
    "$release_policy_template" > "$project_root/docs/RELEASE-POLICY.md"
fi

"$repo_root/checks/validate-adoption.sh" "$project_root/AGENTS.md"
"$repo_root/checks/install-project-agent-adapters.sh" "$project_root"

echo "Bootstrapped $project_name with Engineering Playbook v$requested_version."
echo "Complete AGENTS.md and docs/ENGINEERING-PROFILE.md before material implementation."
if [[ -f "$project_root/docs/RELEASE-POLICY.md" ]]; then
  echo "Complete docs/RELEASE-POLICY.md before the first release."
fi
echo "The project pin will not change automatically; every material task should still inspect the latest stable guidance."
