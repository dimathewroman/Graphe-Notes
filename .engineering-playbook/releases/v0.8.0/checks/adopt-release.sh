#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 PROJECT_ROOT [VERSION]" >&2
  echo "VERSION defaults to the latest verified-published release, or the latest locally validated tag when publication cannot be verified." >&2
}

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  usage
  exit 2
fi

project_root="$(cd "$1" && pwd)"
requested_version="${2:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
adoption_file="$project_root/AGENTS.md"
profile_file="$project_root/docs/ENGINEERING-PROFILE.md"

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

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[|&\\]/\\&/g'
}

if [[ ! -f "$adoption_file" ]]; then
  echo "Missing existing project adoption file: $adoption_file" >&2
  echo "Use bootstrap-project.sh for a project that has no AGENTS.md." >&2
  exit 1
fi

if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  governance_status="$(git -C "$project_root" status --porcelain -- \
    AGENTS.md docs/ENGINEERING-PROFILE.md .engineering-playbook \
    CLAUDE.md GEMINI.md .github/copilot-instructions.md)"
  if [[ -n "$governance_status" ]]; then
    echo "Refusing to update while governance files have uncommitted changes:" >&2
    echo "$governance_status" >&2
    echo "Commit, stash, or otherwise reconcile those governance changes first." >&2
    exit 1
  fi
fi

release_status="$($repo_root/checks/release-status.sh --machine)"
publication_status="$(awk -F= '$1 == "publication_status" {print $2}' <<< "$release_status")"
latest_published_version="$(awk -F= '$1 == "latest_published_version" {print $2}' <<< "$release_status")"
latest_local_version="$(awk -F= '$1 == "latest_local_version" {print $2}' <<< "$release_status")"
latest_guidance_version="$(awk -F= '$1 == "latest_guidance_version" {print $2}' <<< "$release_status")"

if [[ -z "$requested_version" ]]; then
  requested_version="$latest_guidance_version"
fi
requested_version="${requested_version#v}"
release_tag="v$requested_version"
release_revision="refs/tags/$release_tag"
if git -C "$repo_root" rev-parse --verify --quiet "refs/engineering-playbook/published/$release_tag^{commit}" >/dev/null; then
  release_revision="refs/engineering-playbook/published/$release_tag"
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
  echo "Version $requested_version is not available as a valid local tagged release." >&2
  exit 1
fi

if [[ "$publication_status" == "verified" && "$requested_version" != "$latest_published_version" ]]; then
  echo "Notice: adopting explicit v$requested_version; latest verified-published release is v$latest_published_version."
elif [[ "$publication_status" != "verified" ]]; then
  echo "Notice: remote publication could not be verified; v$requested_version is a locally validated tag."
  echo "Latest locally validated tag: v$latest_local_version"
fi

managed_agents_block="$(cat <<EOF
<!-- engineering-playbook-managed:start -->
- Playbook: version \`$requested_version\`, SHA-256 \`$registered_checksum\`.
- Pinned playbook path: \`.engineering-playbook/releases/v$requested_version/PLAYBOOK.md\`.
- Latest-awareness command: \`/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/check-latest-guidance.sh AGENTS.md\`.
- Latest-awareness policy: check the latest stable release at the start of every material task; never silently consume an untagged branch or silently change this pin.
<!-- engineering-playbook-managed:end -->
EOF
)"

managed_profile_block="$(cat <<EOF
<!-- engineering-playbook-managed:start -->
- Adopted playbook version and checksum: \`$requested_version\`, \`$registered_checksum\`
- Exact pinned playbook path: \`.engineering-playbook/releases/v$requested_version/PLAYBOOK.md\`
<!-- engineering-playbook-managed:end -->
EOF
)"

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/engineering-playbook-adopt.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT
candidate_agents="$temporary_root/AGENTS.md"
candidate_profile="$temporary_root/ENGINEERING-PROFILE.md"
agents_block_file="$temporary_root/agents-block.md"
profile_block_file="$temporary_root/profile-block.md"
printf '%s\n' "$managed_agents_block" > "$agents_block_file"
printf '%s\n' "$managed_profile_block" > "$profile_block_file"

validate_managed_markers() {
  local file="$1"
  local start_count end_count
  start_count="$(grep -Fc '<!-- engineering-playbook-managed:start -->' "$file" || true)"
  end_count="$(grep -Fc '<!-- engineering-playbook-managed:end -->' "$file" || true)"
  if [[ "$start_count" -gt 0 || "$end_count" -gt 0 ]]; then
    if [[ "$start_count" -ne 1 || "$end_count" -ne 1 ]]; then
      echo "Malformed or duplicate managed adoption markers in $file; no project file was changed." >&2
      exit 1
    fi
  fi
}

validate_managed_markers "$adoption_file"
if [[ -f "$profile_file" ]]; then
  validate_managed_markers "$profile_file"
fi

if grep -Fq '<!-- engineering-playbook-managed:start -->' "$adoption_file"; then
  awk -v block_file="$agents_block_file" '
    function print_block( line) {
      while ((getline line < block_file) > 0) print line
      close(block_file)
    }
    /<!-- engineering-playbook-managed:start -->/ { print_block(); replacing=1; next }
    /<!-- engineering-playbook-managed:end -->/ && replacing { replacing=0; next }
    !replacing { print }
  ' "$adoption_file" > "$candidate_agents"
else
  if ! awk -v block_file="$agents_block_file" '
    function print_block( line) {
      while ((getline line < block_file) > 0) print line
      close(block_file)
    }
    /^- Playbook:/ { print_block(); replacing=1; found=1; next }
    replacing && /^- Operating mode:/ { replacing=0; print; next }
    !replacing { print }
    END { if (replacing || !found) exit 42 }
  ' "$adoption_file" > "$candidate_agents"; then
    if ! awk -v block_file="$agents_block_file" '
      function print_block( line) {
        while ((getline line < block_file) > 0) print line
        close(block_file)
      }
      tolower($0) == "## adopted engineering standard" {
        print
        print ""
        print_block()
        replacing=1
        found=1
        next
      }
      replacing && /^## / {
        replacing=0
        print ""
        print
        next
      }
      !replacing { print }
      END { if (!found) exit 42 }
    ' "$adoption_file" > "$candidate_agents"; then
      echo "Could not identify the legacy adoption block in $adoption_file; no project file was changed." >&2
      exit 1
    fi
  fi
fi

if [[ -f "$profile_file" ]]; then
  if grep -Fq '<!-- engineering-playbook-managed:start -->' "$profile_file"; then
    awk -v block_file="$profile_block_file" '
      function print_block( line) {
        while ((getline line < block_file) > 0) print line
        close(block_file)
      }
      /<!-- engineering-playbook-managed:start -->/ { print_block(); replacing=1; next }
      /<!-- engineering-playbook-managed:end -->/ && replacing { replacing=0; next }
      !replacing { print }
    ' "$profile_file" > "$candidate_profile"
  else
    awk -v block_file="$profile_block_file" '
      function print_block( line) {
        while ((getline line < block_file) > 0) print line
        close(block_file)
      }
      /^- Adopted playbook version and checksum:/ { print_block(); replacing=1; found=1; next }
      replacing && /^- Latest stable playbook consulted:/ { replacing=0; print; next }
      !replacing { print }
      END { if (replacing || !found) exit 42 }
    ' "$profile_file" > "$candidate_profile" || {
      echo "Could not identify the legacy adoption block in $profile_file; no project file was changed." >&2
      exit 1
    }
  fi

  profile_guide_route_count="$({ grep -Eo '\.\./(\.engineering-playbook/releases/v[0-9]+\.[0-9]+\.[0-9]+/)?guides/README\.md' "$candidate_profile" || true; } | wc -l | tr -d '[:space:]')"
  if [[ "$profile_guide_route_count" -gt 1 ]]; then
    echo "Found multiple managed-looking guide-index routes in $profile_file; no project file was changed." >&2
    exit 1
  fi
  if [[ "$profile_guide_route_count" -eq 1 ]]; then
    routed_candidate_profile="$temporary_root/ENGINEERING-PROFILE.routed.md"
    awk -v replacement="../.engineering-playbook/releases/v$requested_version/guides/README.md" '
      {
        gsub(/\.\.\/(\.engineering-playbook\/releases\/v[0-9]+\.[0-9]+\.[0-9]+\/)?guides\/README\.md/, replacement)
        print
      }
    ' "$candidate_profile" > "$routed_candidate_profile"
    mv "$routed_candidate_profile" "$candidate_profile"
  fi
else
  project_name="$(project_display_name "$project_root")"
  escaped_project_name="$(escape_sed_replacement "$project_name")"
  escaped_version="$(escape_sed_replacement "$requested_version")"
  escaped_checksum="$(escape_sed_replacement "$registered_checksum")"
  escaped_guide_index_path="$(escape_sed_replacement "../.engineering-playbook/releases/v$requested_version/guides/README.md")"
  sed \
    -e "s|{{PROJECT_NAME}}|$escaped_project_name|g" \
    -e "s|{{PLAYBOOK_VERSION}}|$escaped_version|g" \
    -e "s|{{PLAYBOOK_SHA256}}|$escaped_checksum|g" \
    -e "s|../guides/README.md|$escaped_guide_index_path|g" \
    "$repo_root/templates/engineering-profile.md" > "$candidate_profile"
fi

candidate_validation_root="$temporary_root/validation"
candidate_bundle="$candidate_validation_root/.engineering-playbook/releases/v$requested_version"
mkdir -p "$candidate_bundle"
cp "$candidate_agents" "$candidate_validation_root/AGENTS.md"
git -C "$repo_root" show "$release_revision:PLAYBOOK.md" > "$candidate_bundle/PLAYBOOK.md"
"$repo_root/checks/validate-adoption.sh" "$candidate_validation_root/AGENTS.md" >/dev/null

bundle_root="$project_root/.engineering-playbook/releases/v$requested_version"
if [[ -d "$bundle_root" ]]; then
  if command -v shasum >/dev/null 2>&1; then
    bundle_checksum="$(shasum -a 256 "$bundle_root/PLAYBOOK.md" | awk '{print $1}')"
  else
    bundle_checksum="$(sha256sum "$bundle_root/PLAYBOOK.md" | awk '{print $1}')"
  fi
  if [[ "$bundle_checksum" != "$registered_checksum" ]]; then
    echo "Existing v$requested_version bundle has checksum $bundle_checksum; refusing to replace it." >&2
    exit 1
  fi
else
  "$repo_root/checks/export-release.sh" "$requested_version" "$bundle_root" >/dev/null
fi

mkdir -p "$project_root/docs"
mv "$candidate_agents" "$adoption_file"
mv "$candidate_profile" "$profile_file"
"$repo_root/checks/install-project-agent-adapters.sh" "$project_root"
"$repo_root/checks/validate-adoption.sh" "$adoption_file"

echo "Adopted Engineering Playbook v$requested_version in $(project_display_name "$project_root")."
echo "Only the managed adoption blocks, immutable release bundle, and absent agent-discovery adapters were changed."
echo "Review and commit this governance change separately from application code."
