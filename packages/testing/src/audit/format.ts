import type { AuditReport } from "./index";

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

/** Terminal table. */
export function formatAuditTable(report: AuditReport, options: { color?: boolean } = {}): string {
  const c = options.color ?? false;
  const paint = (s: string, code: number) => (c ? `\u001b[${code}m${s}\u001b[0m` : s);
  const lines: string[] = [];
  lines.push(
    `AXE Score: ${paint(String(report.score), report.score >= 90 ? 32 : report.score >= 60 ? 33 : 31)} / 100   ${report.url}`,
  );
  if (report.hardFailure)
    lines.push(paint(`HARD FAILURE: ${report.hardFailure} zeroes its category.`, 31));
  lines.push("");
  for (const cat of report.categories) {
    lines.push(
      `${pad(cat.title, 14)} ${pad(`${cat.score}/${cat.max}`, 8)} ${bar(cat.score / cat.max, 30)}`,
    );
    for (const k of cat.checks) {
      const mark =
        k.status === "pass"
          ? paint("✓", 32)
          : k.status === "skip"
            ? paint("–", 90)
            : k.status === "partial"
              ? paint("◐", 33)
              : paint("✗", 31);
      lines.push(`  ${mark} ${pad(k.id, 40)} ${k.title}`);
      if (k.status !== "pass") lines.push(`      ${k.detail}`);
    }
    lines.push("");
  }
  if (report.fixes.length) {
    lines.push("Fix list (highest impact first):");
    report.fixes.forEach((f, i) => {
      lines.push(`${String(i + 1).padStart(2)}. +${f.points} ${f.title} [${f.category}]`);
      lines.push(`    ${f.detail}`);
      lines.push(`    See ${f.docs}`);
    });
    lines.push("");
  }
  lines.push("Parity spot-check:");
  lines.push(`  ${report.parity.note}`);
  for (const t of report.parity.targets) {
    const expect = Object.entries(t.expect)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const found = t.found
      ? "  " +
        Object.entries(t.found)
          .map(([k, ok]) => `${ok ? "✓" : "?"} ${k}`)
          .join(" ")
      : "";
    lines.push(`  ${t.action} ${t.itemId}: ${t.url}  (${expect})${found}`);
  }
  return lines.join("\n");
}

function bar(fraction: number, width: number): string {
  const n = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return "█".repeat(n) + "░".repeat(width - n);
}

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Self-contained HTML report suitable for attaching to a pull request. */
export function formatAuditHtml(report: AuditReport): string {
  const color = report.score >= 90 ? "#1a7f37" : report.score >= 60 ? "#b08800" : "#c62828";
  const cats = report.categories
    .map(
      (
        c,
      ) => `<section class="cat"><h2>${esc(c.title)} <span class="pts">${c.score} / ${c.max}</span></h2><div class="bar"><div style="width:${(c.score / c.max) * 100}%"></div></div>
<table>${c.checks.map((k) => `<tr class="${k.status}"><td class="st">${k.status === "pass" ? "✓" : k.status === "skip" ? "–" : k.status === "partial" ? "◐" : "✗"}</td><td><strong>${esc(k.title)}</strong><br><code>${esc(k.id)}</code> · weight ${k.weight}<br><span class="detail">${esc(k.detail)}</span>${k.status !== "pass" && k.status !== "skip" ? ` · <a href="${esc(k.docs)}">${esc(k.docs)}</a>` : ""}</td></tr>`).join("")}</table></section>`,
    )
    .join("");
  const fixes = report.fixes.length
    ? `<ol>${report.fixes.map((f) => `<li><strong>+${f.points}</strong> ${esc(f.title)} <em>(${esc(f.category)})</em><br><span class="detail">${esc(f.detail)}</span><br><a href="${esc(f.docs)}">${esc(f.docs)}</a></li>`).join("")}</ol>`
    : "<p>Nothing to fix.</p>";
  const parity = report.parity.targets.length
    ? `<table>${report.parity.targets
        .map(
          (t) =>
            `<tr><td><code>${esc(t.action)}</code> ${esc(t.itemId)}</td><td><a href="${esc(t.url)}" rel="noopener noreferrer" target="_blank">${esc(t.url)}</a></td><td>${Object.entries(
              t.expect,
            )
              .map(([k, v]) => `${esc(k)}=${esc(v)}${t.found ? (t.found[k] ? " ✓" : " ?") : ""}`)
              .join("<br>")}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AXE audit: ${esc(report.url)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;color:#1a1a1a;background:#fff}main{max-width:900px;margin:0 auto;padding:24px 16px}.score{display:flex;align-items:center;gap:20px}.ring{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;font-size:40px;font-weight:700;color:#fff;background:${color}}
.cat{margin-top:28px}.pts{font-weight:400;color:#666;font-size:15px;margin-left:8px}.bar{height:8px;background:#eee;border-radius:4px;overflow:hidden;margin:6px 0 12px}.bar div{height:100%;background:${color}}
table{width:100%;border-collapse:collapse}td{padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top}.st{width:24px;font-size:18px}.pass .st{color:#1a7f37}.fail .st{color:#c62828}.partial .st{color:#b08800}.skip .st{color:#999}.detail{color:#555;font-size:14px}code{background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px}.hard{background:#fde8e8;border:1px solid #c62828;padding:10px 14px;border-radius:8px;margin:16px 0}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}td{border-color:#333}.bar{background:#333}code{background:#222}.detail{color:#aaa}.hard{background:#3a1a1a}}</style></head>
<body><main><div class="score"><div class="ring">${report.score}</div><div><h1 style="margin:0">AXE Score</h1><div>${esc(report.url)}</div><div class="detail">Generated ${esc(report.generatedAt)}</div></div></div>
${report.hardFailure ? `<div class="hard"><strong>Hard failure:</strong> <code>${esc(report.hardFailure)}</code> zeroes its category. See docs/audit.md#honesty-rules.</div>` : ""}
<h2>Fix list</h2>${fixes}
${cats}
<section class="cat"><h2>Parity spot-check</h2><p class="detail">${esc(report.parity.note)}</p>${parity}</section>
</main></body></html>`;
}
