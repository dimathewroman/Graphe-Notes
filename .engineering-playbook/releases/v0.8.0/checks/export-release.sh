#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 VERSION DESTINATION_DIRECTORY" >&2
}

if [[ "$#" -ne 2 ]]; then
  usage
  exit 2
fi

requested_version="${1#v}"
destination="$2"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_tag="v$requested_version"
release_revision="refs/tags/$release_tag"

if git -C "$repo_root" rev-parse --verify --quiet "refs/engineering-playbook/published/$release_tag^{commit}" >/dev/null; then
  release_revision="refs/engineering-playbook/published/$release_tag"
fi

if [[ -e "$destination" ]]; then
  echo "Destination already exists; refusing to overwrite: $destination" >&2
  exit 1
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
  echo "Version $requested_version is not available as a self-registered tagged release." >&2
  exit 1
fi

if ! git -C "$repo_root" rev-parse --verify --quiet "$release_revision^{commit}" >/dev/null; then
  echo "Registered release tag is not available locally: $release_tag" >&2
  echo "Fetch tags from the canonical repository and retry." >&2
  exit 1
fi

destination_parent="$(dirname "$destination")"
mkdir -p "$destination_parent"
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/engineering-playbook-export.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

git -C "$repo_root" archive "$release_revision" | tar -x -C "$temporary_directory"

if command -v shasum >/dev/null 2>&1; then
  exported_checksum="$(shasum -a 256 "$temporary_directory/PLAYBOOK.md" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  exported_checksum="$(sha256sum "$temporary_directory/PLAYBOOK.md" | awk '{print $1}')"
else
  echo "Neither shasum nor sha256sum is available." >&2
  exit 1
fi

if [[ "$exported_checksum" != "$registered_checksum" ]]; then
  echo "Exported $release_tag checksum $exported_checksum does not match registry $registered_checksum." >&2
  exit 1
fi

cat > "$temporary_directory/IMMUTABLE-RELEASE.md" <<EOF
# Immutable Engineering Playbook Release

This directory was generated from canonical Git tag \`$release_tag\`.

- Adopted version: \`$requested_version\`
- PLAYBOOK SHA-256: \`$registered_checksum\`
- Canonical repository: \`https://github.com/dimathewroman/Engineering-Playbook\`

Do not edit this generated release in place. Adopt a newer tagged release through a separate, reviewable project change.
EOF

mv "$temporary_directory" "$destination"
trap - EXIT

echo "Exported Engineering Playbook $release_tag to $destination"
echo "PLAYBOOK SHA-256: $registered_checksum"
