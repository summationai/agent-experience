/**
 * The development watch page: a screenshot of the hidden session, refreshed every second, and a
 * Stop button that closes the session. Loopback only, behind a random path the CLI prints.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The watch page's HTML. Relative URLs: it is served at `/watch/<key>/`. */
export function watchPage(appUrl: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hosted session</title>
<style>
  :root { color-scheme: light dark; --bg: #fafaf9; --fg: #1c1917; --muted: #57534e; --line: #d6d3d1; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1c1917; --fg: #f5f5f4; --muted: #a8a29e; --line: #44403c; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); }
  header .app { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #state { color: var(--muted); }
  button { font: inherit; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--line); background: transparent; color: inherit; cursor: pointer; }
  main { padding: 16px; }
  img { max-width: 100%; border: 1px solid var(--line); border-radius: 6px; display: block; }
  p.empty { color: var(--muted); }
</style></head>
<body>
<header><div class="app">Hosted session of <strong>${escapeHtml(appUrl)}</strong> (development)</div><span id="state" role="status" aria-live="polite">waiting</span><button id="stop" type="button">Stop session</button></header>
<main><img id="shot" alt="The hidden browser session, as it looks now" hidden><p id="empty" class="empty">No session is running. It starts on the agent's first tool call.</p></main>
<script>
  const base = location.pathname.replace(/\\/$/, "");
  const shot = document.getElementById("shot"), empty = document.getElementById("empty"), state = document.getElementById("state");
  async function tick() {
    try {
      const res = await fetch(base + "/screenshot.png", { cache: "no-store" });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const old = shot.src; shot.src = url; if (old) URL.revokeObjectURL(old);
        shot.hidden = false; empty.hidden = true; state.textContent = "live " + new Date().toLocaleTimeString();
      } else { shot.hidden = true; empty.hidden = false; state.textContent = "no session"; }
    } catch { state.textContent = "host not reachable"; }
    setTimeout(tick, 1000);
  }
  document.getElementById("stop").addEventListener("click", async () => {
    await fetch(base + "/stop", { method: "POST" });
    state.textContent = "stopped";
  });
  tick();
</script>
</body></html>`;
}
