#!/usr/bin/env sh
# Packs the SDK for an application that consumes it from a checkout (docs/deploying.md,
# "Consume from a checkout"). Builds the workspace, packs @summationai/axe-core, @summationai/axe-surface, @summationai/axe-client
# and @summationai/axe-testing into <out-dir> as summationai-axe-<name>-<version>.tgz, and writes <out-dir>/SOURCE with
# the repository, branch, commit and date the tarballs came from, since a tarball carries only
# the version and every commit between two releases carries the same one.
#
# Usage: scripts/pack-for-consumer.sh <out-dir> [package ...]
#   package: a directory name under packages/ (default: core surface client testing)
#
# The consumer installs the tarballs as file: dependencies with an override per sibling, and
# copies them into place before installing from its lockfile; the doc has the details.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: $0 <out-dir> [package ...]}"
shift
PACKAGES="${*:-core surface client testing}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

(
  cd "$ROOT"
  pnpm install --frozen-lockfile
  pnpm -r build
)

rm -f "$OUT"/summationai-axe-*.tgz
for pkg in $PACKAGES; do
  if [ ! -f "$ROOT/packages/$pkg/package.json" ]; then
    echo "no such package: packages/$pkg" >&2
    exit 2
  fi
  # pnpm rewrites workspace:* dependencies to the packed version, so the surface tarball asks
  # for @summationai/axe-core@<version>; the consumer's overrides point that back at the core tarball.
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$OUT" >/dev/null)
done

REPO="$(git -C "$ROOT" remote get-url origin 2>/dev/null || echo unknown)"
# Record a browsable URL: an SSH remote becomes its https form.
case "$REPO" in
  git@github.com:*) REPO="https://github.com/${REPO#git@github.com:}" ;;
esac
REPO="${REPO%.git}"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
DIRTY=""
if [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]; then
  DIRTY=" (working tree had uncommitted changes)"
fi
{
  echo "repo: $REPO"
  echo "branch: $BRANCH"
  echo "commit: $COMMIT$DIRTY"
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "packages: $(cd "$OUT" && ls summationai-axe-*.tgz | tr '\n' ' ')"
} > "$OUT/SOURCE"

echo "packed into $OUT:"
cat "$OUT/SOURCE"
