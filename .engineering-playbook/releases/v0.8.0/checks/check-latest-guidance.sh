#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 PATH_TO_PROJECT_AGENTS.md" >&2
  exit 2
fi

adoption_file="$1"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_status="$($repo_root/checks/release-status.sh --machine)"
publication_status="$(awk -F= '$1 == "publication_status" {print $2}' <<< "$release_status")"
latest_published_version="$(awk -F= '$1 == "latest_published_version" {print $2}' <<< "$release_status")"
latest_published_checksum="$(awk -F= '$1 == "latest_published_checksum" {print $2}' <<< "$release_status")"
latest_local_version="$(awk -F= '$1 == "latest_local_version" {print $2}' <<< "$release_status")"
latest_local_checksum="$(awk -F= '$1 == "latest_local_checksum" {print $2}' <<< "$release_status")"
latest_version="$(awk -F= '$1 == "latest_guidance_version" {print $2}' <<< "$release_status")"
latest_checksum="$(awk -F= '$1 == "latest_guidance_checksum" {print $2}' <<< "$release_status")"
latest_basis="$(awk -F= '$1 == "latest_guidance_basis" {print $2}' <<< "$release_status")"

if [[ ! -f "$adoption_file" ]]; then
  echo "Missing adoption file: $adoption_file" >&2
  exit 1
fi

adoption_values="$(awk -F '`' '
  /Playbook:/ { capture=6 }
  capture > 0 {
    for (i=2; i<=NF; i+=2) {
      candidate=$i
      if (version == "" && candidate ~ /^[0-9]+\.[0-9]+\.[0-9]+$/) {
        version=candidate
      }
      if (checksum == "" && length(candidate) == 64 && candidate ~ /^[0-9a-fA-F]+$/) {
        checksum=tolower(candidate)
      }
    }
    capture--
  }
  version != "" && checksum != "" { print version "|" checksum; exit }
' "$adoption_file")"

adopted_version="${adoption_values%%|*}"
adopted_checksum="${adoption_values#*|}"

if [[ -z "$adoption_values" || -z "$adopted_version" || -z "$adopted_checksum" || "$adopted_version" == "$adopted_checksum" ]]; then
  echo "$adoption_file does not contain a parseable pinned playbook version and SHA-256." >&2
  exit 1
fi

adopted_revision="refs/tags/v$adopted_version"
if git -C "$repo_root" rev-parse --verify --quiet "refs/engineering-playbook/published/v$adopted_version^{commit}" >/dev/null; then
  adopted_revision="refs/engineering-playbook/published/v$adopted_version"
fi

registered_checksum="$({ git -C "$repo_root" show "$adopted_revision:RELEASES.md" 2>/dev/null | awk -F '|' -v wanted="$adopted_version" '
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

if [[ -z "$registered_checksum" || "$registered_checksum" != "$adopted_checksum" ]]; then
  echo "The adopted playbook pin is not a valid registered release." >&2
  exit 1
fi

project_root="$(cd "$(dirname "$adoption_file")" && pwd)"
pinned_bundle="$project_root/.engineering-playbook/releases/v$adopted_version/PLAYBOOK.md"
pinned_cache="$repo_root/local/releases/v$adopted_version"
latest_cache="$repo_root/local/releases/v$latest_version"
runtime_cache_root="${TMPDIR:-/tmp}/engineering-playbook-release-cache"
runtime_pinned_cache="$runtime_cache_root/v$adopted_version-$adopted_checksum"
runtime_latest_cache="$runtime_cache_root/v$latest_version-$latest_checksum"

if [[ ! -f "$pinned_bundle" && ! -f "$pinned_cache/PLAYBOOK.md" ]]; then
  if [[ ! -f "$runtime_pinned_cache/PLAYBOOK.md" ]]; then
    "$repo_root/checks/export-release.sh" "$adopted_version" "$runtime_pinned_cache" >/dev/null
  fi
fi

if [[ "$adopted_version" == "$latest_version" && -f "$pinned_bundle" ]]; then
  latest_bundle="$(dirname "$pinned_bundle")"
elif [[ -f "$latest_cache/PLAYBOOK.md" ]]; then
  latest_bundle="$latest_cache"
else
  latest_bundle="$runtime_latest_cache"
  if [[ ! -f "$latest_bundle/PLAYBOOK.md" ]]; then
    "$repo_root/checks/export-release.sh" "$latest_version" "$latest_bundle" >/dev/null
  fi
fi

echo "Adopted governance baseline: v$adopted_version"
echo "Adopted PLAYBOOK SHA-256: $adopted_checksum"
echo "Publication verification: $publication_status"
if [[ "$publication_status" == "verified" ]]; then
  echo "Latest verified-published playbook: v$latest_published_version"
  echo "Verified-published PLAYBOOK SHA-256: $latest_published_checksum"
else
  echo "Latest verified-published playbook: unavailable"
fi
echo "Latest locally validated tag: v$latest_local_version"
echo "Locally validated PLAYBOOK SHA-256: $latest_local_checksum"
echo "Latest guidance candidate: v$latest_version ($latest_basis)"

if [[ -f "$pinned_bundle" ]]; then
  echo "Pinned baseline path: $pinned_bundle"
else
  if [[ -f "$pinned_cache/PLAYBOOK.md" ]]; then
    resolved_pinned_cache="$pinned_cache"
  else
    resolved_pinned_cache="$runtime_pinned_cache"
  fi
  echo "Pinned baseline path: $resolved_pinned_cache/PLAYBOOK.md"
  echo "Portability notice: the project-local bundle is unavailable at $pinned_bundle"
  echo "Materialize it through a separate project governance change with: $repo_root/checks/export-release.sh $adopted_version $project_root/.engineering-playbook/releases/v$adopted_version"
fi

if [[ "$adopted_version" == "$latest_version" ]]; then
  if [[ "$publication_status" == "verified" ]]; then
    echo "Status: adopted baseline is the latest verified-published release."
  else
    echo "Status: adopted baseline matches the latest locally validated tag; published status is unavailable."
  fi
  if [[ "$publication_status" == "verified" && "$latest_local_version" != "$latest_published_version" ]]; then
    echo "Local-only notice: v$latest_local_version is locally validated but was not verified on the configured remote and is not treated as published."
  fi
  echo "Latest guidance playbook path: $latest_bundle/PLAYBOOK.md"
  echo "Latest guide index: $latest_bundle/guides/README.md"
  exit 0
fi

if [[ "$publication_status" == "verified" ]]; then
  echo "Status: newer verified-published guidance is available; the existing adoption pin remains unchanged."
else
  echo "Status: newer locally validated guidance is available, but published status could not be verified; the existing adoption pin remains unchanged."
fi

if [[ "$publication_status" == "verified" && "$latest_local_version" != "$latest_published_version" ]]; then
  echo "Local-only notice: v$latest_local_version is locally validated but was not verified on the configured remote and is not treated as published."
fi

latest_revision="refs/tags/v$latest_version"
if git -C "$repo_root" rev-parse --verify --quiet "refs/engineering-playbook/published/v$latest_version^{commit}" >/dev/null; then
  latest_revision="refs/engineering-playbook/published/v$latest_version"
fi

if git -C "$repo_root" rev-parse --verify --quiet "$adopted_revision^{commit}" >/dev/null \
  && git -C "$repo_root" rev-parse --verify --quiet "$latest_revision^{commit}" >/dev/null; then
  echo "Release changes to inspect:"
  git -C "$repo_root" log --format='- %s' "$adopted_revision..$latest_revision" -- PLAYBOOK.md guides templates
  echo "Changed guidance files:"
  git -C "$repo_root" diff --name-only "$adopted_revision..$latest_revision" -- PLAYBOOK.md guides templates
else
  echo "One or more release tags are unavailable locally; fetch tags before comparing exact release contents."
fi

echo "Latest guidance playbook path: $latest_bundle/PLAYBOOK.md"
echo "Latest guide index: $latest_bundle/guides/README.md"
echo "Review the latest trigger-matched guides and current authoritative sources. Record guidance used, deferred, or found incompatible."
