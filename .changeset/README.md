# Changesets

Run `pnpm changeset` to record a change. `@summationai/axe` (the CLI) and every `@summationai/axe-*` package version together (see `fixed` in `config.json`), so one changeset covers the release.

A release is a version bump merged to `main`: run `pnpm version-packages` in the pull request, which consumes the changesets into `CHANGELOG.md` and sets the new version, and `.github/workflows/release.yml` publishes it to GitHub Packages when the pull request merges. The workflow fails while unversioned changesets remain.
