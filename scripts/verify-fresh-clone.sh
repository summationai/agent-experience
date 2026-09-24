#!/usr/bin/env sh
# Extracts the committed tree into a temporary directory and runs the full verification
# there, exactly as a fresh clone would: install, build, test, typecheck, lint, snippet and
# schema checks, and the getting-started conformance run.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
echo "Extracting HEAD of $(basename "$ROOT") into $TMP"
if git -C "$ROOT" rev-parse --show-prefix >/dev/null 2>&1; then
  PREFIX="$(git -C "$ROOT" rev-parse --show-prefix)"
  git -C "$ROOT" archive --format=tar HEAD "${PREFIX:-.}" | tar -x -C "$TMP"
  [ -n "$PREFIX" ] && TMP="$TMP/${PREFIX%/}"
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
echo "Fresh-clone verification passed in $TMP"
