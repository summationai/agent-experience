#!/usr/bin/env node
// Builds the Body Spray site into site/dist. Everything is static and runs from file://.
// Usage: node build.mjs [--out <dir>] [--skip-og]
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  existsSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve, posix, basename, extname } from "node:path";
import {
  createRenderer,
  getHighlighter,
  codeBlock,
  escapeHtml,
  tokenStyles,
  shortenTokenClasses,
} from "./lib-render.mjs";
import { captureFixtures } from "./lib-fixtures.mjs";
import { renderOgImage } from "./lib-og.mjs";

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SITE, "..");
const args = process.argv.slice(2);
const OUT = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : join(SITE, "dist"));
const SKIP_OG = args.includes("--skip-og");

/** One place for the repository location. */
export const GITHUB_REPO = "https://github.com/body-spray/body-spray";
export const NPM_URL = "https://www.npmjs.com/package/@axe/core";
const SITE_NAME = "Body Spray";
const TAGLINE =
  "Agentic eXperience Engineering — because your site should smell good to agents too.";

/** Docs hub groups: which pages go under which heading on the landing page. Keys are docs/ paths. */
export const HUB_GROUPS = [
  {
    title: "Start here",
    pages: ["docs/why-axe.md", "docs/getting-started.md", "docs/concepts.md"],
  },
  {
    title: "Design",
    pages: [
      "docs/designing-actions.md",
      "docs/presenting-results.md",
      "docs/requirements-and-kinds.md",
      "docs/human-handoff.md",
    ],
  },
  {
    title: "Ship",
    pages: [
      "docs/auth.md",
      "docs/integrations/express.md",
      "docs/integrations/next.md",
      "docs/integrations/fetch.md",
      "docs/deploying.md",
      "docs/testing-and-conformance.md",
      "docs/audit.md",
      "docs/analytics.md",
      "docs/platforms.md",
    ],
  },
  {
    title: "Reference",
    pages: [
      "spec/AXE-PROTOCOL.md",
      "spec/KINDS.md",
      "spec/EVENTS.md",
      "spec/VOCABULARY.md",
      "docs/api/README.md",
      "docs/mcp.md",
      "docs/for-agent-builders.md",
      "docs/security.md",
      "docs/faq.md",
      "docs/glossary.md",
      "docs/site.md",
    ],
  },
];

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (name === "node_modules") continue;
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const ROOT_FILES = [
  "README.md",
  "ROADMAP.md",
  "DECISIONS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
];

/** Every Markdown source, as a repo-relative posix path. */
function collectSources() {
  const docs = walk(join(ROOT, "docs"), (p) => p.endsWith(".md")).map((p) =>
    relative(ROOT, p).split("\\").join("/"),
  );
  const spec = walk(
    join(ROOT, "spec"),
    (p) => p.endsWith(".md") && dirname(p) === join(ROOT, "spec"),
  ).map((p) => relative(ROOT, p).split("\\").join("/"));
  return [...docs, ...spec, ...ROOT_FILES];
}

/** Output path (relative to dist) for a source path. */
export function outPathFor(source) {
  if (source.startsWith("docs/")) return source.replace(/\.md$/, ".html");
  if (source.startsWith("spec/")) return `docs/${source.replace(/\.md$/, ".html")}`;
  return `docs/repo/${source.replace(/\.md$/, ".html")}`;
}

// ---------------------------------------------------------------------------
// Navigation from docs/README.md
// ---------------------------------------------------------------------------

/** Parse the ordered list in docs/README.md into nav entries: { title, source, children[] }. */
export function parseNav(readme) {
  const entries = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  for (const line of readme.split("\n")) {
    const m = /^\d+\.\s+(.*)$/.exec(line);
    if (!m) continue;
    const links = [...m[1].matchAll(linkRe)].map((l) => ({ title: l[1], href: l[2] }));
    if (links.length === 0) continue;
    const toSource = (href) => posix.normalize(posix.join("docs", href.split("#")[0]));
    const [first, ...rest] = links;
    const isGroupLabel = /^Integrations:/.test(m[1]);
    if (isGroupLabel) {
      entries.push({
        title: "Integrations",
        source: toSource(first.href),
        children: links.map((l) => ({ title: l.title, source: toSource(l.href) })),
      });
    } else {
      entries.push({
        title: first.title,
        source: toSource(first.href),
        children: rest.map((l) => ({ title: l.title, source: toSource(l.href) })),
      });
    }
  }
  return entries;
}

function stripLabel(title) {
  return title.replace(/\s*—.*$/, "");
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function build({ out = OUT, skipOg = SKIP_OG, log = console.log } = {}) {
  OUT_FOR_SANITIZE = out;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const highlighter = await getHighlighter();
  const sources = collectSources();
  const sourceSet = new Set(sources);
  const readme = readFileSync(join(ROOT, "docs/README.md"), "utf8");
  const nav = parseNav(readme);

  // Ordered list of pages for prev/next: nav order, then spec, then repo files, then the rest.
  const navOrder = [];
  for (const e of nav) {
    navOrder.push(e.source);
    for (const c of e.children) if (!navOrder.includes(c.source)) navOrder.push(c.source);
  }
  const specOrder = [
    "spec/AXE-PROTOCOL.md",
    "spec/KINDS.md",
    "spec/EVENTS.md",
    "spec/VOCABULARY.md",
  ];
  const repoOrder = ROOT_FILES;
  const ordered = [
    ...new Set(["docs/README.md", ...navOrder, ...specOrder, ...repoOrder, ...sources]),
  ].filter((s) => sourceSet.has(s));

  const template = readFileSync(join(SITE, "src/templates/doc.html"), "utf8");
  const navGroups = [
    { title: "Guide", entries: nav },
    {
      title: "Specification",
      entries: specOrder.map((s) => ({
        title: basename(s, ".md")
          .replace("AXE-PROTOCOL", "Protocol")
          .replace(/^(.)(.*)$/, (m, a, b) => a + b.toLowerCase()),
        source: s,
        children: [],
      })),
    },
    {
      title: "Repository",
      entries: repoOrder.map((s) => ({
        title: basename(s, ".md")
          .replace(/^(.)(.*)$/, (m, a, b) => a + b.toLowerCase())
          .replace("Readme", "README"),
        source: s,
        children: [],
      })),
    },
  ];

  const titles = new Map();
  const pages = new Map(); // outPath → { source, title, headings, text }
  const linkProblems = [];
  const assetsToCopy = new Map(); // repo path → dist path

  /** Resolve a Markdown link from `sourcePath` to a site href, relative to the source page's output. */
  function makeResolver(sourcePath) {
    const fromOut = outPathFor(sourcePath);
    const fromDir = posix.dirname(fromOut);
    return (href, _src, opts = {}) => {
      if (/^(https?:|mailto:|#)/.test(href)) return null;
      const [pathPart, anchor] = href.split("#");
      const target = posix.normalize(posix.join(posix.dirname(sourcePath), pathPart));
      const suffix = anchor ? `#${anchor}` : "";
      if (sourceSet.has(target)) return posix.relative(fromDir, outPathFor(target)) + suffix;
      const abs = join(ROOT, target);
      if (existsSync(abs) && statSync(abs).isFile()) {
        if (opts.asset || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(target)) {
          const distPath = target.startsWith("docs/") ? target : `docs/assets/${target}`;
          assetsToCopy.set(target, distPath);
          return posix.relative(fromDir, distPath);
        }
        return `${GITHUB_REPO}/blob/main/${target}`;
      }
      if (existsSync(abs) && statSync(abs).isDirectory())
        return `${GITHUB_REPO}/tree/main/${target}`;
      linkProblems.push(`${sourcePath}: link "${href}" does not resolve`);
      return null;
    };
  }

  // Pass 1: render every page body and collect metadata.
  const rendered = new Map();
  for (const source of ordered) {
    const markdown = readFileSync(join(ROOT, source), "utf8");
    const headings = [];
    const md = createRenderer(highlighter, {
      resolveLink: makeResolver(source),
      sourcePath: source,
      onHeading: (h) => headings.push(h),
    });
    const html = md.render(markdown);
    const title = headings.find((h) => h.level === 1)?.text ?? basename(source, ".md");
    const firstParagraph =
      /<p>([\s\S]*?)<\/p>/
        .exec(html)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ?? "";
    titles.set(source, title);
    rendered.set(source, { html, headings, title, excerpt: firstParagraph.slice(0, 240) });
  }

  // Search index (shared by every page).
  const searchIndex = ordered.map((source) => {
    const r = rendered.get(source);
    return {
      t: r.title,
      u: outPathFor(source),
      h: r.headings.filter((h) => h.level <= 3 && h.level > 1).map((h) => [h.text, h.id]),
      e: r.excerpt,
    };
  });
  const searchJson = JSON.stringify(searchIndex).replace(/</g, "\\u003c");
  // Shared, deferred classic scripts: no fetch(), works from file://, off the critical path.
  writeFileSync(join(out, "search-index.js"), `window.AXE_SEARCH = ${searchJson};\n`);
  const rawCss = readFileSync(join(SITE, "src/styles.css"), "utf8");
  // The stylesheet has three regions: shared tokens and components, landing-only, docs-only, then shared again.
  const cssFor = (kind) =>
    minifyCss(
      rawCss.replace(
        new RegExp(
          `/\\* @${kind === "docs" ? "landing" : "docs"} \\*/[\\s\\S]*?/\\* @(?:docs|shared) \\*/`,
        ),
        "",
      ),
    );
  const css = cssFor("docs");
  const landingCss = cssFor("landing");
  // The page script is minified and inlined: one request fewer on the critical path, still a classic script.
  const { transform } = await import("esbuild");
  const siteJs = (
    await transform(readFileSync(join(SITE, "src/site.js"), "utf8"), {
      minify: true,
      target: "es2017",
      legalComments: "none",
    })
  ).code.trim();
  const inlineScript = `<script>${siteJs.replace(/<\/script/gi, "<\\/script")}</script>`;

  // Landing page body first so every token class is known before the shared CSS is finalized.
  const fixtures = await captureFixtures({ root: ROOT, highlighter });
  const indexBody = await renderIndex({ highlighter, fixtures, rendered, sourceSet });
  const fullCss = `${css}${tokenStyles()}`;
  const fullLandingCss = `${landingCss}${tokenStyles()}`;

  // Pass 2: wrap in the template and write.
  const versionBadge = "axe/0.1";
  for (const [i, source] of ordered.entries()) {
    const r = rendered.get(source);
    const outPath = outPathFor(source);
    const depth = outPath.split("/").length - 1;
    const rootRel = depth === 0 ? "./" : "../".repeat(depth);
    const toHref = (s) => posix.relative(posix.dirname(outPath), outPathFor(s)) || "./";
    const navHtml = navGroups
      .map((g) => {
        const items = g.entries
          .map((e) => {
            const current = e.source === source;
            const childCurrent = e.children.some((c) => c.source === source);
            const kids = e.children.length
              ? `<ul>${e.children.map((c) => `<li><a href="${toHref(c.source)}"${c.source === source ? ' aria-current="page"' : ""}>${escapeHtml(stripLabel(c.title))}</a></li>`).join("")}</ul>`
              : "";
            const label = escapeHtml(stripLabel(e.title));
            if (kids) {
              return `<li><details${current || childCurrent ? " open" : ""}><summary><a href="${toHref(e.source)}"${current ? ' aria-current="page"' : ""}>${label}</a></summary>${kids}</details></li>`;
            }
            return `<li><a href="${toHref(e.source)}"${current ? ' aria-current="page"' : ""}>${label}</a></li>`;
          })
          .join("");
        return `<section class="nav-group"><h2>${escapeHtml(g.title)}</h2><ul>${items}</ul></section>`;
      })
      .join("");
    const toc = r.headings
      .filter((h) => h.level === 2 || h.level === 3)
      .map((h) => `<li class="toc-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
      .join("");
    const prev = i > 0 ? ordered[i - 1] : null;
    const next = i < ordered.length - 1 ? ordered[i + 1] : null;
    const pager = `${prev ? `<a class="pager-prev" rel="prev" href="${toHref(prev)}"><span>Previous</span>${escapeHtml(titles.get(prev))}</a>` : "<span></span>"}${next ? `<a class="pager-next" rel="next" href="${toHref(next)}"><span>Next</span>${escapeHtml(titles.get(next))}</a>` : "<span></span>"}`;
    const description = r.excerpt || `${r.title} — ${SITE_NAME} documentation`;
    const page = template
      .replaceAll("{{title}}", escapeHtml(r.title))
      .replaceAll("{{siteName}}", SITE_NAME)
      .replaceAll("{{description}}", escapeHtml(description))
      .replaceAll("{{root}}", rootRel)
      .replaceAll("{{nav}}", navHtml)
      .replaceAll(
        "{{toc}}",
        toc
          ? `<nav class="toc" aria-labelledby="toc-title"><h2 id="toc-title">On this page</h2><ul>${toc}</ul></nav>`
          : "",
      )
      .replaceAll("{{content}}", r.html)
      .replaceAll("{{pager}}", pager)
      .replaceAll("{{editUrl}}", `${GITHUB_REPO}/edit/main/${source}`)
      .replaceAll("{{sourcePath}}", escapeHtml(source))
      .replaceAll("{{css}}", fullCss)
      .replaceAll("{{script}}", inlineScript)
      .replaceAll("{{version}}", versionBadge)
      .replaceAll("{{githubRepo}}", GITHUB_REPO);
    mkdirSync(join(out, dirname(outPath)), { recursive: true });
    const finalPage = shortenTokenClasses(
      minifyHtml(
        source.startsWith("docs/api/reference/")
          ? sanitizeReferenceLinks(page, join(out, outPath), ordered.map(outPathFor))
          : page,
      ),
    );
    writeFileSync(join(out, outPath), finalPage);
    pages.set(outPath, { source, title: r.title, headings: r.headings });
  }

  // Assets referenced by docs (images), plus the site's own.
  for (const [repoPath, distPath] of assetsToCopy) {
    mkdirSync(join(out, dirname(distPath)), { recursive: true });
    copyFileSync(join(ROOT, repoPath), join(out, distPath));
  }

  mkdirSync(join(out, "assets"), { recursive: true });
  for (const f of readdirSync(join(SITE, "src/assets")))
    if (!f.endsWith(".html")) copyFileSync(join(SITE, "src/assets", f), join(out, "assets", f));

  // Landing page.
  for (const path of ["wallet", "handoff"]) {
    for (const step of fixtures.ladder[path]) {
      if (step.request) step.request.html = shortenTokenClasses(step.request.html);
      if (step.response) step.response.html = shortenTokenClasses(step.response.html);
    }
  }
  writeFileSync(
    join(out, "fixtures.js"),
    `window.AXE_LADDER = ${JSON.stringify(fixtures.ladder).replace(/</g, "\\u003c")};\nwindow.AXE_ARC_HTML = ${JSON.stringify(fixtures.arcHtml).replace(/</g, "\\u003c")};\nif (window.axeFixturesReady) window.axeFixturesReady();\n`,
  );
  writeFileSync(
    join(out, "index.html"),
    shortenTokenClasses(
      minifyHtml(
        indexBody.replaceAll("{{css}}", fullLandingCss).replaceAll("{{script}}", inlineScript),
      ),
    ),
  );
  pages.set("index.html", { source: "site/src/index.html", title: SITE_NAME, headings: [] });

  // sitemap.txt
  writeFileSync(join(out, "sitemap.txt"), [...pages.keys()].sort().join("\n") + "\n");

  // OG image (Playwright; skipped in reproducibility tests that compare byte-for-byte).
  if (!skipOg)
    await renderOgImage({
      out: join(out, "assets/og.png"),
      template: join(SITE, "src/assets/og.html"),
    });

  // Link check across dist.
  const problems = [...linkProblems, ...checkLinks(out, pages)];
  if (problems.length) {
    for (const p of problems) console.error(`link: ${p}`);
    throw new Error(`${problems.length} broken link(s)`);
  }
  log(`Built ${pages.size} pages into ${out}`);
  log(`Open: ${pathToFileURL(join(out, "index.html")).href}`);
  return { out, pages: [...pages.keys()] };
}

/** Collapse inter-tag whitespace outside <pre> blocks. Safe for this site's markup (no whitespace-sensitive inline runs across newlines). */
function minifyHtml(html) {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>)/);
  return parts
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/>\s*\n\s*</g, "><").replace(/\n\s+/g, "\n"),
    )
    .join("");
}

/** Whitespace/comment-only CSS minifier; the stylesheet is hand-written and has no strings with `;`. */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

// ---------------------------------------------------------------------------
// Landing page assembly
// ---------------------------------------------------------------------------

const EXTERNAL_ALLOW = [GITHUB_REPO, "https://www.npmjs.com/", "https://registry.npmjs.org/"];

async function renderIndex({ highlighter, fixtures, rendered, sourceSet }) {
  let html = readFileSync(join(SITE, "src/index.html"), "utf8");
  const md = createRenderer(highlighter, {
    resolveLink: (href) => {
      if (/^(https?:|mailto:|#)/.test(href)) return null;
      const [pathPart, anchor] = href.split("#");
      const target = posix.normalize(posix.join("docs", pathPart));
      if (sourceSet.has(target)) return outPathFor(target) + (anchor ? `#${anchor}` : "");
      const alt = posix.normalize(pathPart);
      if (sourceSet.has(alt)) return outPathFor(alt) + (anchor ? `#${anchor}` : "");
      return `${GITHUB_REPO}/blob/main/${target}`;
    },
    sourcePath: "docs/README.md",
  });

  // <!-- include: docs/examples/x.ts#region --> ... <!-- /include -->
  html = html.replace(/<!-- include: ([^\s]+) -->[\s\S]*?<!-- \/include -->/g, (_m, spec) => {
    const [file, region] = spec.split("#");
    const source = readFileSync(join(ROOT, file), "utf8");
    return `<!-- include: ${spec} -->${codeBlock(highlighter, extractRegion(source, region), extname(file).slice(1) || "text", { title: basename(file) })}<!-- /include -->`;
  });
  // <!-- include-md: docs/why-axe.md#section --> ... <!-- /include-md -->
  html = html.replace(/<!-- include-md: ([^\s]+) -->[\s\S]*?<!-- \/include-md -->/g, (_m, spec) => {
    const [file, slug] = spec.split("#");
    const markdown = readFileSync(join(ROOT, file), "utf8");
    const section = slug ? extractSection(markdown, slug) : markdown;
    const body = md
      .render(section)
      .replace(/<h([1-6]) id="([^"]+)">/g, (m, level, id) => `<h${level} id="excerpt-${id}">`);
    const sourceHref = outPathFor(file) + (slug ? `#${slug}` : "");
    return `<!-- include-md: ${spec} -->${body}<p class="excerpt-source"><a href="${sourceHref}">Read the full section in the docs.</a></p><!-- /include-md -->`;
  });
  // <!-- generated: name --> ... <!-- /generated -->
  const generated = {
    "docs-hub": () => renderHub(rendered),
    "arc-demo": () =>
      `<iframe class="arc-frame" id="arc-frame" title="What an agent renders for the Bellevue search: three units with attributes, links, and affordance buttons" sandbox="allow-scripts"></iframe><noscript><p class="arc-note">The rendered search needs JavaScript to display here. The same output is shown in <a href="docs/presenting-results.html#what-the-reference-renderers-produce">Presenting results</a>.</p></noscript>`,
    "arc-declaration": () =>
      codeBlock(highlighter, fixtures.arcDeclaration, "ts", {
        title: "units.search — display and affordances",
      }),
    "audit-report": () => `<div class="audit-embed">${fixtures.auditHtml}</div>`,
    "audit-score": () => String(fixtures.auditScore),
    "seo-table": () => {
      const markdown = readFileSync(join(ROOT, "docs/why-axe.md"), "utf8");
      const section = extractSection(markdown, "the-seo-analogy-once");
      const table = /(\|[\s\S]*?\|)\n\n/.exec(section + "\n\n")?.[1] ?? "";
      return md.render(table);
    },
  };
  html = html.replace(/<!-- generated: ([\w-]+) -->[\s\S]*?<!-- \/generated -->/g, (_m, name) => {
    const fn = generated[name];
    if (!fn) throw new Error(`index.html: unknown generated block "${name}"`);
    return `<!-- generated: ${name} -->${fn()}<!-- /generated -->`;
  });
  html = html
    .replaceAll("{{githubRepo}}", GITHUB_REPO)
    .replaceAll("{{npmUrl}}", NPM_URL)
    .replaceAll("{{tagline}}", escapeHtml(TAGLINE));
  return html;
}

function renderHub(rendered) {
  return HUB_GROUPS.map((g) => {
    const cards = g.pages
      .filter((p) => rendered.has(p))
      .map((p) => {
        const r = rendered.get(p);
        return `<a class="card" href="${outPathFor(p)}"><h4>${escapeHtml(r.title)}</h4><p>${escapeHtml(r.excerpt.slice(0, 140))}${r.excerpt.length > 140 ? "…" : ""}</p></a>`;
      })
      .join("");
    return `<section class="hub-group"><h3>${escapeHtml(g.title)}</h3><div class="cards">${cards}</div></section>`;
  }).join("");
}

/** Lines of a `// #region name` block, dedented, without nested markers. Whole file when no region. */
export function extractRegion(source, region) {
  let lines = source.replace(/\r\n/g, "\n").split("\n");
  if (region) {
    const start = lines.findIndex((l) =>
      new RegExp(`^\\s*//\\s*#region\\s+${region}\\s*$`).test(l),
    );
    const end = lines.findIndex(
      (l, i) => i > start && new RegExp(`^\\s*//\\s*#endregion(\\s+${region})?\\s*$`).test(l),
    );
    if (start < 0 || end < 0) throw new Error(`region "${region}" not found`);
    lines = lines.slice(start + 1, end);
  }
  lines = lines.filter((l) => !/^\s*\/\/\s*#(end)?region\b/.test(l));
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}

/** The Markdown under the heading whose GitHub slug is `slug`, up to the next heading of the same or higher level. */
export function extractSection(markdown, slug) {
  const lines = markdown.split("\n");
  const slugger = new (class {
    constructor() {
      this.seen = new Map();
    }
    slug(text) {
      let s = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      const n = this.seen.get(s) ?? 0;
      this.seen.set(s, n + 1);
      return n ? `${s}-${n}` : s;
    }
  })();
  let start = -1;
  let level = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const id = slugger.slug(m[2].replace(/`/g, ""));
    if (start < 0 && id === slug) {
      start = i + 1;
      level = m[1].length;
      continue;
    }
    if (start >= 0 && m[1].length <= level) return lines.slice(start, i).join("\n").trim();
  }
  if (start < 0) throw new Error(`section "#${slug}" not found`);
  return lines.slice(start).join("\n").trim();
}

/**
 * TypeDoc output links to types it does not document (Node's IncomingMessage, nodejs.org).
 * The reference is linked as committed, not re-rendered, so unresolvable links become plain text.
 */
function sanitizeReferenceLinks(html, file, knownPages) {
  const known = new Set(knownPages);
  return html.replace(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (m, href, _attrs, text) => {
    if (href.startsWith("#")) return m;
    if (/^https?:\/\//.test(href)) return EXTERNAL_ALLOW.some((a) => href.startsWith(a)) ? m : text;
    const abs = resolve(dirname(file), href.split("#")[0]);
    const outRel = relative(OUT_FOR_SANITIZE, abs).split("\\").join("/");
    return known.has(outRel) || existsSync(abs) ? m : text;
  });
}
let OUT_FOR_SANITIZE = OUT;

// ---------------------------------------------------------------------------
// Link check
// ---------------------------------------------------------------------------

export function checkLinks(out, pages) {
  const problems = [];
  const idCache = new Map();
  const idsOf = (file) => {
    if (!idCache.has(file)) {
      const html = readFileSync(file, "utf8");
      idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    }
    return idCache.get(file);
  };
  for (const outPath of pages.keys()) {
    const file = join(out, outPath);
    const html = readFileSync(file, "utf8");
    const attrs = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
    for (const raw of attrs) {
      if (raw.startsWith("data:") || raw.startsWith("mailto:")) continue;
      if (/^https?:\/\//.test(raw)) {
        if (!EXTERNAL_ALLOW.some((a) => raw.startsWith(a)))
          problems.push(`${outPath}: external link not allowed: ${raw}`);
        continue;
      }
      const [pathPart, anchor] = raw.split("#");
      const targetFile = pathPart ? resolve(dirname(file), pathPart) : file;
      if (!existsSync(targetFile)) {
        problems.push(`${outPath}: "${raw}" → missing ${relative(out, targetFile)}`);
        continue;
      }
      if (anchor && targetFile.endsWith(".html") && !idsOf(targetFile).has(anchor)) {
        problems.push(
          `${outPath}: "${raw}" → no element with id "${anchor}" in ${relative(out, targetFile)}`,
        );
      }
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
