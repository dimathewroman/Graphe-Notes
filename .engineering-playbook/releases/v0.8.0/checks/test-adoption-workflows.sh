#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/engineering-playbook-workflow-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

published_project="$test_root/published-project"
mkdir -p "$published_project"
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/bootstrap-project.sh" "$published_project" 0.3.0 >/dev/null
"$repo_root/checks/validate-adoption.sh" "$published_project/AGENTS.md" >/dev/null
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/check-latest-guidance.sh" "$published_project/AGENTS.md" >/dev/null

for adapter_path in CLAUDE.md GEMINI.md .github/copilot-instructions.md; do
  if [[ ! -f "$published_project/$adapter_path" ]]; then
    echo "Bootstrap did not install expected agent adapter: $adapter_path" >&2
    exit 1
  fi
done

printf '\nProject-specific instruction that must survive adoption.\n' >> "$published_project/AGENTS.md"
printf '\nProject-specific Claude instruction that must survive adoption.\n' >> "$published_project/CLAUDE.md"
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$published_project" 0.3.1 >/dev/null
"$repo_root/checks/validate-adoption.sh" "$published_project/AGENTS.md" >/dev/null
grep -Fq 'Project-specific instruction that must survive adoption.' "$published_project/AGENTS.md"
grep -Fq 'Project-specific Claude instruction that must survive adoption.' "$published_project/CLAUDE.md"
grep -Fq 'version `0.3.1`' "$published_project/AGENTS.md"
grep -Fq '.engineering-playbook/releases/v0.3.1/PLAYBOOK.md' "$published_project/docs/ENGINEERING-PROFILE.md"
grep -Fq '../.engineering-playbook/releases/v0.3.1/guides/README.md' "$published_project/docs/ENGINEERING-PROFILE.md"

if ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/bootstrap-project.sh" "$published_project" 0.3.0 >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly overwrote an existing project AGENTS.md." >&2
  exit 1
fi

if "$repo_root/checks/export-release.sh" 0.3.0 "$published_project/.engineering-playbook/releases/v0.3.0" >/dev/null 2>&1; then
  echo "Release export unexpectedly overwrote an existing destination." >&2
  exit 1
fi

legacy_project="$test_root/legacy-project"
mkdir -p "$legacy_project/docs"
cp "$repo_root/adapters/AGENTS.example.md" "$legacy_project/AGENTS.md"
sed \
  -e 's|{{PROJECT_NAME}}|legacy-project|g' \
  -e 's|{{PLAYBOOK_VERSION}}|0.3.0|g' \
  -e 's|{{PLAYBOOK_SHA256}}|21767aa86aade5dbc15ecab0f992a93495f38fff23e3da175340d37627bea389|g' \
  -e 's|{{PINNED_PLAYBOOK_PATH}}|.engineering-playbook/releases/v0.3.0/PLAYBOOK.md|g' \
  "$legacy_project/AGENTS.md" > "$legacy_project/AGENTS.rendered.md"
mv "$legacy_project/AGENTS.rendered.md" "$legacy_project/AGENTS.md"
sed '/engineering-playbook-managed:/d' "$legacy_project/AGENTS.md" > "$legacy_project/AGENTS.legacy.md"
mv "$legacy_project/AGENTS.legacy.md" "$legacy_project/AGENTS.md"
sed \
  -e 's|{{PROJECT_NAME}}|legacy-project|g' \
  -e 's|{{PLAYBOOK_VERSION}}|0.3.0|g' \
  -e 's|{{PLAYBOOK_SHA256}}|21767aa86aade5dbc15ecab0f992a93495f38fff23e3da175340d37627bea389|g' \
  "$repo_root/templates/engineering-profile.md" > "$legacy_project/docs/ENGINEERING-PROFILE.md"
sed '/engineering-playbook-managed:/d' "$legacy_project/docs/ENGINEERING-PROFILE.md" > "$legacy_project/docs/ENGINEERING-PROFILE.legacy.md"
mv "$legacy_project/docs/ENGINEERING-PROFILE.legacy.md" "$legacy_project/docs/ENGINEERING-PROFILE.md"
"$repo_root/checks/export-release.sh" 0.3.0 "$legacy_project/.engineering-playbook/releases/v0.3.0" >/dev/null
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$legacy_project" 0.3.1 >/dev/null
grep -Fq '<!-- engineering-playbook-managed:start -->' "$legacy_project/AGENTS.md"
grep -Fq '<!-- engineering-playbook-managed:start -->' "$legacy_project/docs/ENGINEERING-PROFILE.md"
"$repo_root/checks/validate-adoption.sh" "$legacy_project/AGENTS.md" >/dev/null

custom_legacy_project="$test_root/custom-legacy-project"
mkdir -p "$custom_legacy_project"
cat > "$custom_legacy_project/AGENTS.md" <<'EOF'
# Custom project agent entry point

Read the project architecture before making changes.

## Playbook adoption profile

- Playbook: version `0.3.0`, SHA-256 `21767aa86aade5dbc15ecab0f992a93495f38fff23e3da175340d37627bea389`.
- Operating mode: Private daily driver.

## Project-specific instructions

Preserve this custom instruction during managed adoption.
EOF
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$custom_legacy_project" 0.3.1 >/dev/null
"$repo_root/checks/validate-adoption.sh" "$custom_legacy_project/AGENTS.md" >/dev/null
grep -Fq 'check-latest-guidance.sh AGENTS.md' "$custom_legacy_project/AGENTS.md"
grep -Fq 'Preserve this custom instruction during managed adoption.' "$custom_legacy_project/AGENTS.md"
grep -Fq '../.engineering-playbook/releases/v0.3.1/guides/README.md' "$custom_legacy_project/docs/ENGINEERING-PROFILE.md"

canonical_project="$test_root/canonical-project"
temporary_worktree="$test_root/temporary-worktree-name"
mkdir -p "$canonical_project"
cp "$custom_legacy_project/AGENTS.md" "$canonical_project/AGENTS.md"
git -C "$canonical_project" init --quiet
git -C "$canonical_project" config user.name 'Engineering Playbook Test'
git -C "$canonical_project" config user.email 'playbook-test@example.invalid'
git -C "$canonical_project" add AGENTS.md
git -C "$canonical_project" commit --quiet -m 'test custom project baseline'
git -C "$canonical_project" worktree add --quiet -b test-worktree-adoption "$temporary_worktree"
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$temporary_worktree" 0.3.1 >/dev/null
grep -Fq -- '- Project: canonical-project' "$temporary_worktree/docs/ENGINEERING-PROFILE.md"
grep -Fq '../.engineering-playbook/releases/v0.3.1/guides/README.md' "$temporary_worktree/docs/ENGINEERING-PROFILE.md"
"$repo_root/checks/validate-adoption.sh" "$temporary_worktree/AGENTS.md" >/dev/null

section_legacy_project="$test_root/openbubbles-style-project"
mkdir -p "$section_legacy_project"
cat > "$section_legacy_project/AGENTS.md" <<'EOF'
# Project Agent Instructions

## Adopted engineering standard

- Engineering Playbook release: `0.2.3`
- Committed `PLAYBOOK.md` SHA-256:
  `96aeeef7abb6207601a12979f16c44162dbdd489099fed158d3660d5fee67a00`
- Owner workspace path:
  `/Users/example/Engineering-Playbook/PLAYBOOK.md`

Do not silently adopt a newer release.

## Required behavior

- Preserve this project-specific behavior.
EOF
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$section_legacy_project" 0.3.1 >/dev/null
"$repo_root/checks/validate-adoption.sh" "$section_legacy_project/AGENTS.md" >/dev/null
grep -Fq '<!-- engineering-playbook-managed:start -->' "$section_legacy_project/AGENTS.md"
grep -Fq 'Preserve this project-specific behavior.' "$section_legacy_project/AGENTS.md"
if grep -Fq '/Users/example/Engineering-Playbook/PLAYBOOK.md' "$section_legacy_project/AGENTS.md"; then
  echo "Section-style legacy adoption retained its obsolete workspace path." >&2
  exit 1
fi

dirty_project="$test_root/dirty-project"
mkdir -p "$dirty_project"
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/bootstrap-project.sh" "$dirty_project" 0.3.0 >/dev/null
git -C "$dirty_project" init --quiet
git -C "$dirty_project" config user.name 'Engineering Playbook Test'
git -C "$dirty_project" config user.email 'playbook-test@example.invalid'
git -C "$dirty_project" add AGENTS.md docs/ENGINEERING-PROFILE.md .engineering-playbook CLAUDE.md GEMINI.md .github/copilot-instructions.md
git -C "$dirty_project" commit --quiet -m 'test governance baseline'
printf '\nuncommitted governance edit\n' >> "$dirty_project/AGENTS.md"
if ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/adopt-release.sh" "$dirty_project" 0.3.1 >/dev/null 2>&1; then
  echo "Existing-project adoption unexpectedly overwrote dirty governance files." >&2
  exit 1
fi
grep -Fq 'uncommitted governance edit' "$dirty_project/AGENTS.md"

latest_project="$test_root/latest-project"
mkdir -p "$latest_project"
latest_project="$(cd "$latest_project" && pwd)"
latest_test_version="$(ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/release-status.sh" --machine | awk -F= '$1 == "latest_local_version" {print $2}')"
ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/bootstrap-project.sh" "$latest_project" "$latest_test_version" >/dev/null
latest_output="$(ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/check-latest-guidance.sh" "$latest_project/AGENTS.md")"
grep -Fq "Latest guidance playbook path: $latest_project/.engineering-playbook/releases/v$latest_test_version/PLAYBOOK.md" <<< "$latest_output"

CODEX_HOME="$test_root/codex-home" "$repo_root/checks/install-codex-global.sh" >/dev/null
cmp "$repo_root/adapters/CODEX-GLOBAL-AGENTS.example.md" "$test_root/codex-home/AGENTS.md"

current_version="$(tr -d '[:space:]' < "$repo_root/VERSION")"
current_checksum="$(awk -F '|' -v wanted="$current_version" '
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
' "$repo_root/RELEASES.md")"

current_project="$test_root/current-project"
current_bundle="$current_project/.engineering-playbook/releases/v$current_version"
mkdir -p "$current_bundle"
cp "$repo_root/PLAYBOOK.md" "$current_bundle/PLAYBOOK.md"
sed \
  -e 's|{{PROJECT_NAME}}|current-project|g' \
  -e "s|{{PLAYBOOK_VERSION}}|$current_version|g" \
  -e "s|{{PLAYBOOK_SHA256}}|$current_checksum|g" \
  -e "s|{{PINNED_PLAYBOOK_PATH}}|.engineering-playbook/releases/v$current_version/PLAYBOOK.md|g" \
  "$repo_root/adapters/AGENTS.example.md" > "$current_project/AGENTS.md"

"$repo_root/checks/validate-adoption.sh" "$current_project/AGENTS.md" >/dev/null
printf '\nintentional checksum corruption\n' >> "$current_bundle/PLAYBOOK.md"
if "$repo_root/checks/validate-adoption.sh" "$current_project/AGENTS.md" >/dev/null 2>&1; then
  echo "Adoption validation unexpectedly accepted a modified pinned playbook." >&2
  exit 1
fi

fixture_repo="$test_root/release-status-repo"
fixture_remote="$test_root/release-status-remote.git"
expected_local_version="$(ENGINEERING_PLAYBOOK_OFFLINE=1 "$repo_root/checks/release-status.sh" --machine | awk -F= '$1 == "latest_local_version" {print $2}')"
git clone --quiet --no-hardlinks "$repo_root" "$fixture_repo"
git init --quiet --bare "$fixture_remote"
git -C "$fixture_repo" push --quiet "$fixture_remote" refs/tags/v0.3.0:refs/tags/v0.3.0
cp "$repo_root/checks/release-status.sh" "$fixture_repo/checks/release-status.sh"
chmod +x "$fixture_repo/checks/release-status.sh"
fixture_status="$(ENGINEERING_PLAYBOOK_REMOTE="$fixture_remote" "$fixture_repo/checks/release-status.sh" --machine)"
grep -Fq 'publication_status=verified' <<< "$fixture_status"
grep -Fq 'latest_published_version=0.3.0' <<< "$fixture_status"
grep -Fq "latest_local_version=$expected_local_version" <<< "$fixture_status"
grep -Fq 'latest_guidance_version=0.3.0' <<< "$fixture_status"

echo "Adoption workflow tests passed."
