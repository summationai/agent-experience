# The website

The marketing and documentation site lives in `site/` and is built into `site/dist/`, which is committed. Opening `site/dist/index.html` from disk renders the landing page and every documentation page with no server and no network: the site is plain HTML, one stylesheet, and one classic script, and it deploys as static files anywhere that can serve a directory.

## How it is built

`pnpm site:build` runs `site/build.mjs` (the site is deliberately outside `pnpm -r build`, because rendering the Open Graph image needs a browser), which:

1. Renders every Markdown page in `docs/`, `spec/`, and the repository root (README, roadmap, decisions, changelog, contributing, security) into `site/dist/docs/` with the documentation template: a sidebar generated from the ordered list in `docs/README.md`, an "On this page" rail from the headings, previous and next links in that same order, and an "Edit this page" link.
2. Rewrites relative Markdown links to the generated pages and fails the build on any link that does not resolve to a page, an existing anchor, or a file in the output.
3. Highlights code with Shiki at build time, emitting light and dark colors as CSS variables so no highlighter ships to the browser, and adds a copy button to every block.
4. Renders Mermaid diagrams to inline SVG at build time with a pure-JavaScript renderer, with a text version of each diagram behind a disclosure.
5. Fills the landing page's include markers from the docs' own sources: code blocks come from `docs/examples/`, prose excerpts come from `docs/why-axe.md`, the docs hub comes from `docs/README.md`, and the demo data comes from running `docs/examples/apartments/site.ts` in-process with the clock and random ids pinned, so the envelopes are real and the build is reproducible.
6. Embeds a search index as JSON in each page and generates `sitemap.txt` and the Open Graph image.

Nothing on the site is a hand-copied version of something in the repository. If a sentence on the landing page needs to change, change the doc it is pulled from.

## Adding a documentation page

You do not touch the site. Add the page to `docs/`, link it from the ordered list in `docs/README.md`, and rebuild: the sidebar, the previous and next links, the search index, and the docs hub all derive from that list. To place the page on the landing page's hub, add its path to the group map at the top of `site/build.mjs`.

## Running the tests

`pnpm site:test` runs `site/test/run.mjs`:

- **reproducible**: two builds are byte-identical, and the committed `site/dist/` matches a fresh build.
- **offline**: every page loads from `file://` in Chromium with all network requests aborted, with zero console errors, failed requests, or broken images; the landing page and one docs page also load in Firefox and WebKit.
- **links**: every `href` and `src` in the output resolves; external links point only at the repository and npm.
- **demos**: the ladder demo plays both paths and reports the expected `status` sequence; choosing a unit in the rendered search binds its id into the ladder; search and the theme toggle work from the keyboard.
- **screenshots**: the landing page at four widths in light and dark, compared with the baselines committed under `site/test/__screenshots__/`. Regenerate them with `node site/test/run.mjs --update-screenshots` and look at them.
- **lighthouse**: performance, accessibility, best practices, and SEO at 95 or above on the landing page and one docs page, served over a local port for the run.

CI builds the site and fails if `site/dist/` differs from the committed output. The Open Graph image is rendered by a browser and excluded from that byte comparison.

## Iterating

`pnpm site:dev` serves `site/dist/` on a local port for convenience while editing. The deliverable never needs it.

## Next steps

- [Testing and conformance](testing-and-conformance.md) for the checks the site's demos are built on.
- [Contributing](../CONTRIBUTING.md) for the repository layout.
- [Docs index](README.md).
