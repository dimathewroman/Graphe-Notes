#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 PATH_TO_PROJECT_AGENTS.md [...]" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_registry="$repo_root/RELEASES.md"

version_at_least() {
  local candidate="$1"
  local minimum="$2"
  local candidate_major candidate_minor candidate_patch
  local minimum_major minimum_minor minimum_patch

  IFS=. read -r candidate_major candidate_minor candidate_patch <<< "$candidate"
  IFS=. read -r minimum_major minimum_minor minimum_patch <<< "$minimum"

  if (( candidate_major != minimum_major )); then
    (( candidate_major > minimum_major ))
    return
  fi
  if (( candidate_minor != minimum_minor )); then
    (( candidate_minor > minimum_minor ))
    return
  fi
  (( candidate_patch >= minimum_patch ))
}

for adoption_file in "$@"; do
  if [[ ! -f "$adoption_file" ]]; then
    echo "Missing adoption file: $adoption_file" >&2
    exit 1
  fi

  adoption_values="$(awk -F '`' '
    /Playbook:/ { capture=5 }
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

  registered_checksum="$(awk -F '|' -v wanted="$adopted_version" '
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
  ' "$release_registry")"

  if [[ -z "$registered_checksum" ]]; then
    echo "$adoption_file pins unregistered playbook version $adopted_version." >&2
    exit 1
  fi

  if [[ "$adopted_checksum" != "$registered_checksum" ]]; then
    echo "$adoption_file checksum $adopted_checksum does not match registered playbook v$adopted_version checksum $registered_checksum." >&2
    exit 1
  fi

  if version_at_least "$adopted_version" "0.3.1"; then
    pinned_path="$(awk -F '`' '/Pinned playbook path:/ { print $2; exit }' "$adoption_file")"
    if [[ -z "$pinned_path" ]]; then
      echo "$adoption_file does not name an exact pinned playbook path required by v0.3.1+." >&2
      exit 1
    fi

    if [[ "$pinned_path" = /* ]]; then
      resolved_pinned_path="$pinned_path"
    else
      adoption_directory="$(cd "$(dirname "$adoption_file")" && pwd)"
      resolved_pinned_path="$adoption_directory/$pinned_path"
    fi

    if [[ ! -f "$resolved_pinned_path" ]]; then
      echo "$adoption_file pinned playbook is unavailable: $resolved_pinned_path" >&2
      exit 1
    fi

    if command -v shasum >/dev/null 2>&1; then
      pinned_checksum="$(shasum -a 256 "$resolved_pinned_path" | awk '{print $1}')"
    elif command -v sha256sum >/dev/null 2>&1; then
      pinned_checksum="$(sha256sum "$resolved_pinned_path" | awk '{print $1}')"
    else
      echo "Neither shasum nor sha256sum is available." >&2
      exit 1
    fi

    if [[ "$pinned_checksum" != "$adopted_checksum" ]]; then
      echo "$resolved_pinned_path checksum $pinned_checksum does not match the adopted baseline $adopted_checksum." >&2
      exit 1
    fi

    if ! grep -Fq 'check-latest-guidance.sh' "$adoption_file"; then
      echo "$adoption_file does not require the v0.3.1+ latest-stable guidance check." >&2
      exit 1
    fi
  fi

  echo "Validated $adoption_file against pinned playbook v$adopted_version ($adopted_checksum)."
done
