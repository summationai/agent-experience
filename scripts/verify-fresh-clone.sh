#!/usr/bin/env sh
# Extracts the committed tree into a temporary directory and runs the full verification
# there, exactly as a fresh clone would: install, build, test, typecheck, lint, snippet and
# schema checks, and the getting-started conformance run.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
echo "Extracting HEAD of $(basename "$ROOT") into $TMP"
PREFIX="$(git -C "$ROOT" rev-parse --show-prefix)"
TOPLEVEL="$(git -C "$ROOT" rev-parse --show-toplevel)"
if [ -n "$PREFIX" ]; then
  # The project lives in a subdirectory of a larger repository: archive that subtree
  # from the repository root (git archive resolves pathspecs relative to the cwd).
  git -C "$TOPLEVEL" archive --format=tar "HEAD:${PREFIX%/}" | tar -x -C "$TMP"
else
  git -C "$TOPLEVEL" archive --format=tar HEAD | tar -x -C "$TMP"
fi
cd "$TMP"
pnpm install --frozen-lockfile
pnpm gen:vocabulary -- --check
pnpm -r build
node scripts/gen-schemas.mjs --check
pnpm check:snippets
pnpm lint
pnpm -r typecheck
pnpm -r test
node scripts/ci-conformance.mjs
pnpm site:build
git init -q . && git add -A . >/dev/null 2>&1 && git -c user.email=verify@local -c user.name=verify commit -qm "verify" >/dev/null 2>&1
pnpm site:build
git diff --exit-code -- site/dist ':!site/dist/assets/og.png'
pnpm site:test
echo "Fresh-clone verification passed in $TMP"
