/**
 * Waiting for slow work ([S-AUTO-15]): resolve when a condition on the page holds (text appears
 * or goes, an entry becomes available, the revision moves, the page goes quiet, the route
 * changes), or when the bound runs out. Driven by the page's own mutations with a bounded poll
 * beside them; never a busy loop, never longer than two minutes, and canceled when the surface
 * stops.
 */
import type { Surface } from "./index";
import { ActWatch, norm } from "./auto-dom";
import { globMatch } from "./auto-config";
import { WAIT_LIMITS, checkCondition } from "./auto-content";
import type { WaitCondition, WaitOptions, WaitResult } from "./auto-content";

type Win = Window & typeof globalThis;

export interface WaitDeps {
  win: Win;
  doc: Document;
  surface: Surface;
  /** Apply DOM changes the scan has not seen yet. */
  flush(): void;
  /** The route keys are built from now. */
  route(): string;
  /** Scans add the ids they changed to every set here. */
  collectors: Set<Set<string>>;
  /** The page's text: fast, or confirmed against styles (`visible`). */
  text(visible: boolean): string;
}

const clamp = (n: number | undefined, lo: number, hi: number, dflt: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;

/** A text matcher: `/pattern/flags` or a RegExp as a regular expression, else a case-insensitive substring. */
function matcher(pattern: string | RegExp): { test: (s: string) => boolean; say: string } {
  if (pattern instanceof RegExp) {
    const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    return { test: (s) => re.test(s), say: String(pattern) };
  }
  const m = /^\/(.+)\/([dimsuvy]*)$/.exec(pattern);
  if (m) {
    try {
      const re = new RegExp(m[1]!, m[2]!);
      return { test: (s) => re.test(s), say: pattern };
    } catch {
      // Not a valid expression: match it as text.
    }
  }
  const needle = norm(pattern).toLowerCase();
  return { test: (s) => s.toLowerCase().includes(needle), say: `“${norm(pattern)}”` };
}

/** Waits on one auto surface's page; `cancelAll` ends every pending wait (the surface stopped). */
export function createWaiter(deps: WaitDeps) {
  const pending = new Set<(reason: string) => void>();

  async function wait(condition: WaitCondition, options: WaitOptions = {}): Promise<WaitResult> {
    const problem = checkCondition(condition);
    if (problem) throw new TypeError(`wait: ${problem}.`);
    const { win, doc, surface } = deps;
    const timeoutMs = clamp(
      options.timeoutMs,
      0,
      WAIT_LIMITS.timeoutMs.max,
      WAIT_LIMITS.timeoutMs.default,
    );
    const pollMs = clamp(
      options.pollMs,
      WAIT_LIMITS.pollMs.min,
      WAIT_LIMITS.pollMs.max,
      WAIT_LIMITS.pollMs.default,
    );
    deps.flush();
    const fromRev = surface.currentRev();
    const started = Date.now();
    const seen = new Set<string>();
    deps.collectors.add(seen);
    // The page's mutations: the time of the last one (for idle) and the notices they carried.
    const watch = new ActWatch([doc], win, null);

    // One text read per check, shared by every text condition in it.
    let fast: string | null = null;
    let slow: string | null = null;
    const shown = (m: ReturnType<typeof matcher>): boolean => {
      fast ??= deps.text(false);
      if (!m.test(fast)) return false;
      slow ??= deps.text(true);
      return m.test(slow);
    };

    /** Whether the condition holds now, and in words what held. */
    const check = (c: WaitCondition): { met: boolean; why: string } => {
      const parts: { met: boolean; why: string }[] = [];
      if (c.text !== undefined) {
        const m = matcher(c.text);
        const onPage = shown(m);
        const inNotice = !onPage && watch.peek().some((n) => m.test(n));
        parts.push({
          met: onPage || inNotice,
          why: `text ${m.say} ${inNotice ? "appeared in a notice" : "is on the page"}`,
        });
      }
      if (c.gone !== undefined) {
        const m = matcher(c.gone);
        parts.push({ met: !shown(m), why: `text ${m.say} is no longer on the page` });
      }
      if (c.entry !== undefined) {
        const e = surface.get(c.entry);
        const a = e ? surface.availability(c.entry) : undefined;
        const met = !!e && (c.available === undefined || (a?.available ?? true) === c.available);
        parts.push({
          met,
          why: `entry ${c.entry} is ${c.available === undefined ? "on the page" : c.available ? "available" : "unavailable"}`,
        });
      }
      if (c.revMoved !== undefined)
        parts.push({
          met: surface.currentRev() !== c.revMoved,
          why: `the revision moved from ${c.revMoved} to ${surface.currentRev()}`,
        });
      if (c.idle !== undefined)
        parts.push({
          met: Date.now() - watch.last >= c.idle,
          why: `the page has been quiet for ${c.idle} ms`,
        });
      if (c.route !== undefined) {
        const path = win.location?.pathname ?? "";
        parts.push({
          met: globMatch(c.route, deps.route()) || globMatch(c.route, path),
          why: `the route matches ${c.route}`,
        });
      }
      if (c.all) {
        const subs = c.all.map(check);
        parts.push({ met: subs.every((s) => s.met), why: subs.map((s) => s.why).join(" and ") });
      }
      if (c.any) {
        const subs = c.any.map(check);
        const hit = subs.find((s) => s.met);
        parts.push({ met: !!hit, why: hit ? hit.why : subs.map((s) => s.why).join(" or ") });
      }
      return { met: parts.every((p) => p.met), why: parts.map((p) => p.why).join(" and ") };
    };

    /** The soonest an idle condition could hold, to check exactly then. */
    const idleDue = (c: WaitCondition): number => {
      let due = Infinity;
      if (c.idle !== undefined) due = watch.last + c.idle;
      for (const sub of [...(c.all ?? []), ...(c.any ?? [])]) due = Math.min(due, idleDue(sub));
      return due;
    };

    return new Promise<WaitResult>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let soon: ReturnType<typeof setTimeout> | undefined;
      const deadline = setTimeout(() => {
        fast = null;
        slow = null;
        let why = "";
        try {
          deps.flush();
          const last = check(condition);
          if (last.met) return finish(true, last.why);
          why = last.why;
        } catch {
          why = "the condition";
        }
        finish(false, `timed out after ${timeoutMs} ms waiting until ${why}`);
      }, timeoutMs);
      const MO = win.MutationObserver;
      const mo = MO ? new MO(() => schedule(Math.min(pollMs, 30))) : null;
      mo?.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });

      const finish = (met: boolean, reason: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(soon);
        clearTimeout(deadline);
        mo?.disconnect();
        pending.delete(cancel);
        options.signal?.removeEventListener("abort", onAbort);
        try {
          deps.flush();
        } catch {
          // A failed scan leaves the revision where it was.
        }
        deps.collectors.delete(seen);
        const notices = watch.stop();
        resolve({
          met,
          elapsedMs: Date.now() - started,
          rev: surface.currentRev(),
          fromRev,
          reason,
          changed: [...seen],
          notices,
        });
      };

      const run = () => {
        if (done) return;
        soon = undefined;
        fast = null;
        slow = null;
        let result: { met: boolean; why: string };
        try {
          deps.flush();
          result = check(condition);
        } catch (e) {
          return finish(
            false,
            `the condition could not be checked: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (result.met) return finish(true, result.why);
        clearTimeout(timer);
        const due = idleDue(condition) - Date.now();
        timer = setTimeout(
          run,
          Math.max(5, Math.min(pollMs, Number.isFinite(due) ? due + 1 : pollMs)),
        );
      };
      const schedule = (ms: number) => {
        if (done || soon !== undefined) return;
        soon = setTimeout(run, ms);
      };
      const cancel = (reason: string) => finish(false, reason);
      const onAbort = () => finish(false, "the wait was canceled");
      pending.add(cancel);
      if (options.signal?.aborted) return onAbort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      run();
    });
  }

  return {
    wait,
    /** End every pending wait with `met: false` and this reason. */
    cancelAll(reason: string) {
      for (const c of [...pending]) c(reason);
    },
  };
}
