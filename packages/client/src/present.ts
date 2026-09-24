/**
 * @axe/client/present: turn an `ok` result into a `PresentedResult` and render it
 * for chat (Markdown) or a self-contained page (HTML). Nothing site-specific runs:
 * every string is escaped, URLs are validated, and the only script is the SDK's own.
 */
import type { ActionDefinition, Brand, OkResult, Result } from "@axe/core/types";
import type { PresentedAttribute, PresentedItem, PresentedResult } from "@axe/core/display";
import { resolveDisplay } from "@axe/core/display";
import * as WIRE from "@axe/core/vocabulary";

export type {
  PresentedResult,
  PresentedItem,
  PresentedAttribute,
  ResolvedAffordance,
} from "@axe/core/display";

/** Apply an action's `display` to an `ok` result. Throws when the result is not `ok`. */
export function present(
  action: ActionDefinition,
  result: Result | OkResult,
  brand?: Brand,
): PresentedResult {
  if (result.status !== WIRE.status.ok) {
    throw new Error(
      `present(): expected an ok result, received status "${result.status}". Handle the other statuses first (see docs/for-agent-builders.md).`,
    );
  }
  return resolveDisplay(action, result.output, brand);
}

// ---------------------------------------------------------------------------
// Formatting values
// ---------------------------------------------------------------------------

/** Format an attribute for humans. Locale-aware where it can be, plain otherwise. */
export function formatValue(attr: PresentedAttribute, locale = "en-US"): string {
  const v = attr.value;
  if (v === null || v === undefined) return "";
  switch (attr.format) {
    case WIRE.format.boolean:
      return v ? "Yes" : "No";
    case WIRE.format.number:
      return typeof v === "number" ? v.toLocaleString(locale) : String(v);
    case WIRE.format.currency:
      return typeof v === "number"
        ? v.toLocaleString(locale, { maximumFractionDigits: 2 })
        : String(v);
    case WIRE.format.area:
      return typeof v === "number" ? `${v.toLocaleString(locale)} sq ft` : String(v);
    case WIRE.format.distance:
      return typeof v === "number" ? v.toLocaleString(locale) : String(v);
    case WIRE.format.duration:
      return typeof v === "number" ? `${v} min` : String(v);
    case WIRE.format.date: {
      const d = typeof v === "string" ? new Date(`${v}T00:00:00Z`) : null;
      return d && !Number.isNaN(d.getTime())
        ? d.toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        : String(v);
    }
    case WIRE.format.datetime: {
      const d = typeof v === "string" ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime())
        ? d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
        : String(v);
    }
    case WIRE.format.list:
      return Array.isArray(v) ? v.map(String).join(", ") : String(v);
    default:
      return Array.isArray(v)
        ? v.map(String).join(", ")
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
  }
}

const PERIOD_SUFFIX: Record<string, string> = {
  [WIRE.period.hour]: "/hr",
  [WIRE.period.day]: "/day",
  [WIRE.period.month]: "/mo",
  [WIRE.period.year]: "/yr",
  [WIRE.period.once]: "",
};

export function formatPrice(price: NonNullable<PresentedItem["price"]>, locale = "en-US"): string {
  let amount: string;
  try {
    amount = price.amount.toLocaleString(locale, {
      style: "currency",
      currency: price.currency,
      minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch {
    amount = `${price.amount.toLocaleString(locale)} ${price.currency}`;
  }
  return `${amount}${price.period ? (PERIOD_SUFFIX[price.period] ?? "") : ""}`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export interface MarkdownOptions {
  locale?: string;
  /** Include the affordances list under the table. Default true. */
  affordances?: boolean;
  /** Cap the number of attribute columns. Default 6. */
  maxColumns?: number;
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** A comparison table for chat surfaces, with links, badges, the disclaimer, and each item's affordances. */
export function toMarkdown(presented: PresentedResult, options: MarkdownOptions = {}): string {
  const locale = options.locale ?? "en-US";
  const lines: string[] = [];
  if (presented.items.length === 0) {
    lines.push(presented.emptyMessage ?? "No results.");
    if (presented.disclaimer) lines.push("", `_${mdEscape(presented.disclaimer)}_`);
    return lines.join("\n");
  }
  const isCollection =
    presented.kind === WIRE.displayKind.list || presented.kind === WIRE.displayKind.table;
  if (isCollection) {
    const labels = orderedLabels(presented, options.maxColumns ?? 6);
    const hasPrice = presented.items.some((i) => i.price);
    const header = ["Option", ...(hasPrice ? ["Price"] : []), ...labels];
    lines.push(`| ${header.map(mdEscape).join(" | ")} |`);
    lines.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (const item of presented.items) {
      const name = item.url ? `[${mdEscape(item.title)}](${item.url})` : mdEscape(item.title);
      const sub = item.subtitle ? `<br>${mdEscape(item.subtitle)}` : "";
      const badges = item.badges.length
        ? `<br>${item.badges.map((b) => `\`${mdEscape(b)}\``).join(" ")}`
        : "";
      const cells = [`${name}${sub}${badges}`];
      if (hasPrice) cells.push(item.price ? formatPrice(item.price, locale) : "");
      for (const label of labels) {
        const attr = item.attributes.find((a) => a.label === label);
        cells.push(attr ? mdEscape(formatValue(attr, locale)) : "");
      }
      lines.push(`| ${cells.join(" | ")} |`);
    }
  } else {
    for (const item of presented.items) {
      lines.push(
        `**${mdEscape(item.title)}**${item.subtitle ? ` — ${mdEscape(item.subtitle)}` : ""}`,
      );
      if (item.price) lines.push(`Price: ${formatPrice(item.price, locale)}`);
      for (const attr of item.attributes)
        lines.push(`- ${mdEscape(attr.label)}: ${mdEscape(formatValue(attr, locale))}`);
      if (item.badges.length)
        lines.push(`- ${item.badges.map((b) => `\`${mdEscape(b)}\``).join(" ")}`);
      if (item.url) lines.push(`[View on site](${item.url})`);
    }
  }
  if (options.affordances !== false) {
    const withAff = presented.items.filter((i) => i.affordances.length > 0);
    if (withAff.length) {
      lines.push("", "**Next steps**");
      for (const item of withAff) {
        const list = item.affordances
          .map(
            (a) =>
              `${a.primary ? "**" : ""}${mdEscape(a.title)}${a.primary ? "**" : ""} (\`${a.action}\` with \`${JSON.stringify(a.input)}\`)`,
          )
          .join("; ");
        lines.push(`- ${mdEscape(item.title)}: ${list}`);
      }
    }
  }
  if (presented.disclaimer) lines.push("", `_${mdEscape(presented.disclaimer)}_`);
  return lines.join("\n");
}

function orderedLabels(presented: PresentedResult, max: number): string[] {
  const all: string[] = [];
  for (const item of presented.items)
    for (const a of item.attributes) if (!all.includes(a.label)) all.push(a.label);
  const lead = presented.suggestedComparison.filter((l) => all.includes(l));
  const rest = all.filter((l) => !lead.includes(l));
  return [...lead, ...rest].slice(0, max);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export interface HtmlOptions {
  locale?: string;
  /** Page title. Defaults to the brand name or the action name. */
  title?: string;
  /** `cards` (default for list) or `table`. */
  layout?: "cards" | "table";
  /** Text of the heading above the results. */
  heading?: string;
}

export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(u);
    if (
      p.protocol === "https:" ||
      (p.protocol === "http:" && ["localhost", "127.0.0.1"].includes(p.hostname))
    )
      return p.toString();
  } catch {
    // ignore
  }
  return undefined;
}

function safeColor(c: string | undefined): string {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#1f3a5f";
}

/**
 * The only script in the page. It reads `data-*` attributes (never site text) and
 * dispatches `axe:select` on `window` and, inside an iframe, to the parent via postMessage.
 */
const SELECT_SCRIPT = `document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("button[data-axe-action]"):null;if(!b)return;var d;try{d=JSON.parse(b.getAttribute("data-axe-input")||"{}")}catch(_){d={}}var detail={itemId:b.getAttribute("data-axe-item")||"",action:b.getAttribute("data-axe-action")||"",input:d};window.dispatchEvent(new CustomEvent("axe:select",{detail:detail,bubbles:true}));if(window.parent&&window.parent!==window){window.parent.postMessage({type:"axe:select",detail:detail},"*")}});`;

const CSS = `:root{--axe-accent:ACCENT;--axe-fg:#1a1a1a;--axe-muted:#5b6470;--axe-bg:#ffffff;--axe-card:#f7f8fa;--axe-border:#e2e6ea}
@media (prefers-color-scheme:dark){:root{--axe-fg:#f2f2f2;--axe-muted:#a3adb8;--axe-bg:#111418;--axe-card:#1a1f25;--axe-border:#2a313a}}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--axe-fg);background:var(--axe-bg)}
.axe-wrap{max-width:1080px;margin:0 auto;padding:20px 16px}.axe-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}.axe-head img{height:32px;width:auto}
.axe-head h1{font-size:20px;margin:0}.axe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.axe-card{background:var(--axe-card);border:1px solid var(--axe-border);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.axe-card img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block}.axe-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}
.axe-title{font-weight:600;font-size:16px;margin:0}.axe-title a{color:inherit;text-decoration:none}.axe-title a:hover{text-decoration:underline}
.axe-sub{color:var(--axe-muted);margin:0;font-size:14px}.axe-price{font-weight:700;color:var(--axe-accent);font-size:17px}
.axe-badges{display:flex;flex-wrap:wrap;gap:6px}.axe-badge{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--axe-accent);color:#fff}
dl.axe-attrs{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0;font-size:14px}dl.axe-attrs dt{color:var(--axe-muted)}dl.axe-attrs dd{margin:0}
.axe-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:6px}
.axe-actions button{font:inherit;font-size:14px;padding:8px 12px;border-radius:8px;border:1px solid var(--axe-accent);background:transparent;color:var(--axe-accent);cursor:pointer}
.axe-actions button.axe-primary{background:var(--axe-accent);color:#fff}.axe-actions button:hover{filter:brightness(1.1)}
.axe-link{font-size:13px;color:var(--axe-muted)}.axe-disclaimer{margin-top:18px;padding:10px 12px;border-left:3px solid var(--axe-accent);background:var(--axe-card);font-size:13px;color:var(--axe-muted)}
.axe-empty{padding:24px;text-align:center;color:var(--axe-muted)}
table.axe-table{width:100%;border-collapse:collapse;font-size:14px}table.axe-table th,table.axe-table td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--axe-border);vertical-align:top}table.axe-table th{color:var(--axe-muted);font-weight:600}
@media (max-width:640px){table.axe-table{display:block;overflow-x:auto}}`;

/**
 * A self-contained, dependency-free comparison page. Cards or a table, responsive,
 * brand-aware, with the disclaimer, a link per item, and affordance buttons that dispatch
 * `CustomEvent("axe:select", { detail: { itemId, action, input } })`.
 */
export function toHTML(presented: PresentedResult, options: HtmlOptions = {}): string {
  const locale = options.locale ?? "en-US";
  const brand = presented.brand;
  const accent = safeColor(brand?.accentColor);
  const title = options.title ?? brand?.name ?? presented.action;
  const logo = safeUrl(brand?.logoUrl);
  const isCollection =
    presented.kind === WIRE.displayKind.list || presented.kind === WIRE.displayKind.table;
  const layout = options.layout ?? (presented.kind === WIRE.displayKind.table ? "table" : "cards");

  let body: string;
  if (presented.items.length === 0) {
    body = `<p class="axe-empty">${escapeHtml(presented.emptyMessage ?? "No results.")}</p>`;
  } else if (isCollection && layout === "table") {
    body = renderTable(presented, locale);
  } else {
    body = `<div class="axe-grid">${presented.items.map((item) => renderCard(item, locale)).join("")}</div>`;
  }

  return `<!doctype html>
<html lang="${escapeHtml(locale.split("-")[0] ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http://localhost:* http://127.0.0.1:*; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(title)}</title>
<style>${CSS.replace("ACCENT", accent)}</style>
</head>
<body>
<main class="axe-wrap">
<header class="axe-head">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ""}<h1>${escapeHtml(options.heading ?? title)}</h1></header>
${body}
${presented.disclaimer ? `<p class="axe-disclaimer">${escapeHtml(presented.disclaimer)}</p>` : ""}
</main>
<script>${SELECT_SCRIPT}</script>
</body>
</html>
`;
}

function renderAffordances(item: PresentedItem): string {
  if (!item.affordances.length) return "";
  return `<div class="axe-actions">${item.affordances
    .map(
      (a) =>
        `<button type="button" class="${a.primary ? "axe-primary" : ""}" data-axe-item="${escapeHtml(item.id)}" data-axe-action="${escapeHtml(a.action)}" data-axe-input="${escapeHtml(JSON.stringify(a.input))}">${escapeHtml(a.title)}</button>`,
    )
    .join("")}</div>`;
}

function renderCard(item: PresentedItem, locale: string): string {
  const url = safeUrl(item.url);
  const img = item.images.map(safeUrl).find(Boolean);
  const titleHtml = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const attrs = item.attributes
    .map((a) => `<dt>${escapeHtml(a.label)}</dt><dd>${escapeHtml(formatValue(a, locale))}</dd>`)
    .join("");
  return `<article class="axe-card" data-axe-item="${escapeHtml(item.id)}">
${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}
<div class="axe-body">
<h2 class="axe-title">${titleHtml}</h2>
${item.subtitle ? `<p class="axe-sub">${escapeHtml(item.subtitle)}</p>` : ""}
${item.price ? `<div class="axe-price">${escapeHtml(formatPrice(item.price, locale))}</div>` : ""}
${item.badges.length ? `<div class="axe-badges">${item.badges.map((b) => `<span class="axe-badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
${attrs ? `<dl class="axe-attrs">${attrs}</dl>` : ""}
${renderAffordances(item)}
${url ? `<a class="axe-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View on site</a>` : ""}
</div>
</article>`;
}

function renderTable(presented: PresentedResult, locale: string): string {
  const labels = orderedLabels(presented, 8);
  const hasPrice = presented.items.some((i) => i.price);
  const head = `<tr><th>Option</th>${hasPrice ? "<th>Price</th>" : ""}${labels.map((l) => `<th>${escapeHtml(l)}</th>`).join("")}<th></th></tr>`;
  const rows = presented.items
    .map((item) => {
      const url = safeUrl(item.url);
      const name = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
        : escapeHtml(item.title);
      const cells = labels.map((l) => {
        const a = item.attributes.find((x) => x.label === l);
        return `<td>${a ? escapeHtml(formatValue(a, locale)) : ""}</td>`;
      });
      return `<tr data-axe-item="${escapeHtml(item.id)}"><td><strong>${name}</strong>${item.subtitle ? `<br><span class="axe-sub">${escapeHtml(item.subtitle)}</span>` : ""}${item.badges.length ? `<div class="axe-badges">${item.badges.map((b) => `<span class="axe-badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}</td>${hasPrice ? `<td class="axe-price">${item.price ? escapeHtml(formatPrice(item.price, locale)) : ""}</td>` : ""}${cells.join("")}<td>${renderAffordances(item)}</td></tr>`;
    })
    .join("");
  return `<table class="axe-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
