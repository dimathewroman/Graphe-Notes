#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--machine]" >&2
}

machine=0
if [[ "$#" -gt 1 ]]; then
  usage
  exit 2
fi
if [[ "$#" -eq 1 ]]; then
  if [[ "$1" != "--machine" ]]; then
    usage
    exit 2
  fi
  machine=1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote="${ENGINEERING_PLAYBOOK_REMOTE:-origin}"

checksum_at_revision() {
  local revision="$1"
  local version="$2"
  local registered_checksum actual_checksum temporary_playbook

  registered_checksum="$({ git -C "$repo_root" show "$revision:RELEASES.md" 2>/dev/null | awk -F '|' -v wanted="$version" '
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
  '; } || true)"

  if [[ -z "$registered_checksum" ]]; then
    return 1
  fi

  temporary_playbook="$(mktemp "${TMPDIR:-/tmp}/engineering-playbook-release-status.XXXXXX")"
  if ! git -C "$repo_root" show "$revision:PLAYBOOK.md" > "$temporary_playbook" 2>/dev/null; then
    rm -f "$temporary_playbook"
    return 1
  fi

  if command -v shasum >/dev/null 2>&1; then
    actual_checksum="$(shasum -a 256 "$temporary_playbook" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual_checksum="$(sha256sum "$temporary_playbook" | awk '{print $1}')"
  else
    rm -f "$temporary_playbook"
    echo "Neither shasum nor sha256sum is available." >&2
    exit 1
  fi
  rm -f "$temporary_playbook"

  if [[ "$actual_checksum" != "$registered_checksum" ]]; then
    return 1
  fi

  printf '%s\n' "$registered_checksum"
}

latest_local_version=""
latest_local_checksum=""
while IFS= read -r release_tag; do
  candidate_version="${release_tag#v}"
  candidate_checksum="$(checksum_at_revision "$release_tag" "$candidate_version" || true)"
  if [[ -n "$candidate_checksum" ]]; then
    latest_local_version="$candidate_version"
    latest_local_checksum="$candidate_checksum"
  fi
done < <(git -C "$repo_root" tag --list 'v[0-9]*' --sort=version:refname)

publication_status="unavailable"
latest_published_version=""
latest_published_checksum=""

if [[ "${ENGINEERING_PLAYBOOK_OFFLINE:-0}" != "1" ]]; then
  remote_tags="$(git -C "$repo_root" ls-remote --tags "$remote" 2>/dev/null || true)"
  if [[ -n "$remote_tags" ]]; then
    if git -C "$repo_root" fetch --quiet --no-tags "$remote" \
      '+refs/tags/v*:refs/engineering-playbook/published/v*' 2>/dev/null; then
      publication_status="verified"
      while IFS= read -r remote_tag; do
        candidate_version="${remote_tag#v}"
        if ! grep -Eq "[[:space:]]refs/tags/${remote_tag}(\^\{\})?$" <<< "$remote_tags"; then
          continue
        fi
        candidate_ref="refs/engineering-playbook/published/$remote_tag"
        candidate_checksum="$(checksum_at_revision "$candidate_ref" "$candidate_version" || true)"
        if [[ -n "$candidate_checksum" ]]; then
          latest_published_version="$candidate_version"
          latest_published_checksum="$candidate_checksum"
        fi
      done < <(git -C "$repo_root" for-each-ref \
        --sort=version:refname \
        --format='%(refname:strip=3)' \
        'refs/engineering-playbook/published/v[0-9]*')
    fi
  fi
fi

if [[ "$publication_status" == "verified" && -z "$latest_published_version" ]]; then
  echo "The configured remote was reachable but contained no valid self-registered playbook release." >&2
  exit 1
fi

if [[ "$publication_status" == "verified" ]]; then
  latest_guidance_version="$latest_published_version"
  latest_guidance_checksum="$latest_published_checksum"
  latest_guidance_basis="verified-published"
else
  latest_guidance_version="$latest_local_version"
  latest_guidance_checksum="$latest_local_checksum"
  latest_guidance_basis="local-offline-fallback"
fi

if [[ -z "$latest_guidance_version" || -z "$latest_guidance_checksum" ]]; then
  echo "No valid self-registered playbook release is available." >&2
  exit 1
fi

if [[ "$machine" -eq 1 ]]; then
  echo "publication_status=$publication_status"
  echo "latest_published_version=$latest_published_version"
  echo "latest_published_checksum=$latest_published_checksum"
  echo "latest_local_version=$latest_local_version"
  echo "latest_local_checksum=$latest_local_checksum"
  echo "latest_guidance_version=$latest_guidance_version"
  echo "latest_guidance_checksum=$latest_guidance_checksum"
  echo "latest_guidance_basis=$latest_guidance_basis"
  exit 0
fi

echo "Publication verification: $publication_status"
if [[ "$publication_status" == "verified" ]]; then
  echo "Latest verified-published release: v$latest_published_version"
  echo "Verified-published PLAYBOOK SHA-256: $latest_published_checksum"
else
  echo "Latest verified-published release: unavailable"
fi
echo "Latest locally validated tag: v$latest_local_version"
echo "Locally validated PLAYBOOK SHA-256: $latest_local_checksum"
echo "Latest guidance candidate: v$latest_guidance_version ($latest_guidance_basis)"
