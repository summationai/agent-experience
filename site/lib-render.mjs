// Markdown → HTML for the site. Shared by build.mjs. No runtime dependencies are produced:
// Shiki highlights at build time (dual themes as CSS variables), beautiful-mermaid renders
// diagrams to inline SVG, admonitions become callouts, headings get GitHub-style ids.
import MarkdownIt from "markdown-it";
import GithubSlugger from "github-slugger";
import { createHighlighter } from "shiki";
import { renderMermaidSVG, renderMermaidASCII } from "beautiful-mermaid";

const LANGS = [
  "typescript",
  "ts",
  "javascript",
  "js",
  "json",
  "jsonc",
  "shell",
  "bash",
  "sh",
  "http",
  "sql",
  "yaml",
  "html",
  "css",
  "markdown",
  "text",
  "promql",
  "mermaid",
  "diff",
  "toml",
];

let highlighterPromise;
export function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: LANGS.filter((l) => l !== "promql" && l !== "mermaid" && l !== "http"),
  });
  return highlighterPromise;
}

const LANG_ALIAS = { promql: "text", http: "text", mermaid: "text", "": "text", txt: "text" };

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Shiki emits one inline style per token (`--shiki-light:#..;--shiki-dark:#..`). To keep pages
 * small, identical style pairs are replaced by short classes and emitted once as CSS
 * (`tokenStyles()`), sorted so output is deterministic regardless of render order.
 */
const tokenClasses = new Map(); // style string → class name

export function tokenStyles() {
  const entries = [...tokenClasses.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const color = (style, which) =>
    new RegExp("--shiki-" + which + ":(#[0-9a-fA-F]+)").exec(style)?.[1] ?? "inherit";
  // Each token class carries both colors as custom properties; two theme rules pick one.
  const ordered = [...tokenClasses.values()].sort();
  const short = new Map(ordered.map((cls, i) => [cls, `t${i}`]));
  const defs = entries
    .map(
      ([style, cls]) =>
        `.${short.get(cls)}{--l:${color(style, "light")};--d:${color(style, "dark")}}`,
    )
    .join("");
  return `${defs}.shiki [class^=t]{color:var(--l)}:root[data-theme="dark"] .shiki [class^=t]{color:var(--d)}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .shiki [class^=t]{color:var(--d)}}`;
}

function classify(html) {
  return html
    .replace(/ style="(--shiki-light:[^"]+)"/g, (_m, style) => {
      let cls = tokenClasses.get(style);
      if (!cls) {
        // Provisional name derived from the colors; `shortenTokenClasses` renames to t0…tN at the end of the build.
        const light = /--shiki-light:#([0-9a-fA-F]+)/.exec(style)?.[1] ?? "x";
        const dark = /--shiki-dark:#([0-9a-fA-F]+)/.exec(style)?.[1] ?? "x";
        cls = `t${light}-${dark}`.toLowerCase();
        tokenClasses.set(style, cls);
      }
      return ` class="${cls}"`;
    })
    .replace(/<pre class="shiki[^"]*"[^>]*>/, (m) => m.replace(/ style="[^"]*"/, ""))
    .replace(/ tabindex="0"/, "");
}

/** Rename provisional token classes to short sequential names, in a deterministic order (sorted by color pair). */
export function shortenTokenClasses(html) {
  const ordered = [...tokenClasses.values()].sort();
  const map = new Map(ordered.map((cls, i) => [cls, `t${i}`]));
  return html.replace(
    /class="(t[0-9a-f]+-[0-9a-f]+)"/g,
    (m, cls) => `class="${map.get(cls) ?? cls}"`,
  );
}

/** Highlight one code block. Returns the <pre class="shiki"> HTML with class-based token colors. */
export function highlight(highlighter, code, lang) {
  const language = LANG_ALIAS[lang] ?? lang;
  const loaded = highlighter.getLoadedLanguages();
  const l = loaded.includes(language) ? language : "text";
  const inner = classify(
    highlighter.codeToHtml(code.replace(/\n$/, ""), {
      lang: l,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      mergeSameStyleTokens: true,
      structure: "inline",
    }),
  );
  return `<pre class="shiki"><code>${inner}</code></pre>`;
}

/** A code block with a copy button, as emitted everywhere on the site. */
export function codeBlock(highlighter, code, lang, { title } = {}) {
  const pre = highlight(highlighter, code, lang);
  const label = title ? `<span class="code-title">${escapeHtml(title)}</span>` : "";
  return `<div class="code" data-lang="${escapeHtml(lang || "text")}">${label}<button class="copy" type="button" aria-label="Copy code to clipboard">Copy</button>${pre}</div>`;
}

// Variable names differ from the site's own so the SVG's `--bg: var(--d-bg)` is not circular.
const MERMAID_OPTS = {
  bg: "var(--d-bg)",
  fg: "var(--d-fg)",
  line: "var(--d-line)",
  accent: "var(--d-accent)",
  muted: "var(--d-muted)",
  surface: "var(--d-surface)",
  border: "var(--d-border)",
  transparent: true,
  font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/** Render a Mermaid block to inline SVG with a text alternative. */
export function diagram(source, index) {
  // beautiful-mermaid imports the font from Google Fonts; the site is offline, so drop the import.
  const svg = renderMermaidSVG(source, MERMAID_OPTS)
    .replace(/@import\s+url\([^)]*\)[^;]*;/g, "")
    .replace(/<svg /, `<svg role="img" aria-labelledby="diagram-${index}-title" `)
    .replace(
      /(<svg[^>]*>)/,
      `$1<title id="diagram-${index}-title">Diagram ${index + 1}. A text version follows.</title>`,
    );
  let ascii;
  try {
    ascii = renderMermaidASCII(source);
  } catch {
    ascii = source;
  }
  return `<figure class="diagram">${svg}<details class="diagram-text"><summary>Text version of this diagram</summary><pre>${escapeHtml(ascii)}</pre><pre class="diagram-source">${escapeHtml(source.trim())}</pre></details></figure>`;
}

/**
 * Create a renderer. `resolveLink(href, sourcePath)` maps a Markdown link to a site href
 * (or returns null to leave it alone). `onHeading` receives every heading for the TOC.
 */
export function createRenderer(highlighter, { resolveLink, sourcePath, onHeading }) {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  const slugger = new GithubSlugger();
  let diagramIndex = 0;

  // Headings: GitHub-style ids, collected for the TOC.
  md.renderer.rules.heading_open = (tokens, idx) => {
    const token = tokens[idx];
    const inline = tokens[idx + 1];
    const text = inline.children
      .filter((t) => t.type === "text" || t.type === "code_inline")
      .map((t) => t.content)
      .join("");
    const id = slugger.slug(text);
    const level = Number(token.tag.slice(1));
    onHeading?.({ level, text, id });
    return `<${token.tag} id="${id}">`;
  };
  md.renderer.rules.heading_close = (tokens, idx) => `</${tokens[idx].tag}>\n`;
  // Reset per-document state on every render so ids are stable and unique per page.
  const originalRender = md.render.bind(md);
  md.render = (src, env) => {
    slugger.reset();
    diagramIndex = 0;
    return originalRender(src, env);
  };

  // Fenced code: Shiki, Mermaid → SVG.
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = (token.info || "").trim().split(/\s+/)[0] || "text";
    if (lang === "mermaid") return diagram(token.content, diagramIndex++);
    return codeBlock(highlighter, token.content, lang);
  };

  // Links: rewrite .md → .html through the site map.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href");
    if (href) {
      const mapped = resolveLink(href, sourcePath);
      if (mapped) token.attrSet("href", mapped);
      if (/^https?:\/\//.test(mapped ?? href)) {
        token.attrSet("rel", "noopener noreferrer");
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
  // Images: resolve relative paths the same way.
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src");
    // External images (badges) would be network requests; the site is offline-complete.
    if (src && /^https?:\/\//.test(src)) {
      const alt = token.content || "";
      return alt ? `<span class="badge">${escapeHtml(alt)}</span>` : "";
    }
    if (src) {
      const mapped = resolveLink(src, sourcePath, { asset: true });
      if (mapped) token.attrSet("src", mapped);
    }
    token.attrSet("loading", "lazy");
    return defaultImage(tokens, idx, options, env, self);
  };

  // Tables scroll on narrow screens.
  md.renderer.rules.table_open = () => `<div class="table-wrap"><table>`;
  md.renderer.rules.table_close = () => `</table></div>\n`;

  // Admonitions: a blockquote whose first inline is **Note** / **Warning**.
  md.core.ruler.push("callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;
      const para = tokens[i + 1];
      const inline = tokens[i + 2];
      if (!para || para.type !== "paragraph_open" || !inline || inline.type !== "inline") continue;
      const first = inline.children?.[0];
      const strong = inline.children?.[1];
      if (
        first?.type === "strong_open" &&
        strong?.type === "text" &&
        /^(Note|Warning|Tip|Caution)$/.test(strong.content)
      ) {
        const kind = strong.content.toLowerCase();
        tokens[i].tag = "aside";
        tokens[i].attrSet("class", `callout callout-${kind}`);
        tokens[i].attrSet("role", kind === "warning" || kind === "caution" ? "alert" : "note");
        let j = i + 1;
        while (j < tokens.length && tokens[j].type !== "blockquote_close") j++;
        if (j < tokens.length) tokens[j].tag = "aside";
      }
    }
  });

  return md;
}
