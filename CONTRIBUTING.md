# Contributing

Thank you for looking at AXE. This file covers the mechanics; the design reasoning lives in [DECISIONS.md](DECISIONS.md) and the scope boundaries in [ROADMAP.md](ROADMAP.md).

## Setup

```sh
pnpm install
pnpm -r build
pnpm -r test
pnpm -r typecheck
pnpm lint
```

Node 20 or newer. pnpm is pinned in `package.json` (`packageManager`), so `corepack enable` is enough.

## Repository layout

- `spec/` — normative documents. `VOCABULARY.md` is the source of every wire name; `packages/core/src/vocabulary.ts` is generated from it (`pnpm gen:vocabulary`). `schemas/` is generated from `@summationai/axe-core` (`pnpm gen:schemas`).
- `packages/` — `core`, `client`, `mcp`, `express`, `next`, `fetch`, `testing`, `cli`.
- `docs/` — the product. Every TypeScript code block lives in `docs/examples/**` and is pulled in by `pnpm gen:snippets`; `pnpm -r typecheck` typechecks the examples.
- `scripts/` — generators and CI helpers.

## Making a change

1. **Wire names.** If you add or rename anything that appears on the wire, in the CLI, or in the public API, edit `spec/VOCABULARY.md` first, then run `pnpm gen:vocabulary`. The drift test (`packages/testing/test/drift.test.ts`) fails on any name the docs use that is not in the vocabulary, and on any vocabulary entry the docs or source never use.
2. **Spec first.** Protocol behavior changes start in `spec/AXE-PROTOCOL.md` with a numbered requirement. Map the requirement in `packages/testing/src/conformance/requirements.ts` to a conformance check or a named test; a test asserts every requirement is mapped.
3. **Tests.** Vitest. Aim for behavior coverage: every protocol MUST has a test or a conformance check.
4. **Docs.** Put TypeScript in `docs/examples/`, reference it with an include marker, run `pnpm gen:snippets`. Follow the style rules in `docs/README.md`.
5. **Changeset.** `pnpm changeset` and describe the change for the changelog. All packages version together.
6. **Decisions.** A non-obvious judgment call gets a short entry in `DECISIONS.md`: what you chose and why.

## Commit messages

Conventional commits: `feat(core): ...`, `fix(client): ...`, `docs: ...`, `chore: ...`.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not open a public issue for a vulnerability.

## Code of conduct

Be direct, be kind, assume competence. Disagreements about design go through `DECISIONS.md` entries, quoted and answered.
