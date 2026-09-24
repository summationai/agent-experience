/**
 * A tiny draft board with the same registrations SurfaceRow makes in the fantasy-draft app:
 * picks come off the board when taken, undo puts them back, every change bumps the revision.
 */
import { createSurface } from "../../src/index";
import type { Surface } from "../../src/index";

export function board(options: { players?: string[]; now?: () => Date } = {}) {
  const surface: Surface = createSurface({
    app: "fantasy-draft",
    ...(options.now ? { now: options.now } : {}),
  });
  const players = options.players ?? ["Gibbs", "Robinson", "Chase"];
  const log: { p: string; actor: string; rev: number }[] = [];
  const taken = new Set<string>();
  let drafting = true;
  const sync = () => {
    for (const p of players) {
      if (taken.has(p)) {
        surface.unregister(`pick:me:${p}`);
        continue;
      }
      surface.register({
        id: `pick:me:${p}`,
        kind: "action",
        role: "button",
        name: `Draft ${p}`,
        object: `player:${p}`,
        state: drafting ? { available: true } : { available: false, reason: "draft not started" },
        effect: { mutates: "draft", reversible: true },
        handler: (actor) => {
          taken.add(p);
          log.unshift({ p, actor, rev: surface.currentRev() + 1 });
          sync();
          surface.bump({ by: actor });
        },
      });
    }
  };
  surface.register({
    id: "undo",
    kind: "action",
    role: "button",
    name: "Undo last pick",
    object: "draft",
    state: { available: true },
    effect: { mutates: "draft" },
    handler: (actor) => {
      const e = log.shift();
      if (e) {
        taken.delete(e.p);
        sync();
        surface.bump({ by: actor });
      }
    },
  });
  sync();
  const human = (p: string) => {
    taken.add(p);
    log.unshift({ p, actor: "user", rev: surface.currentRev() + 1 });
    sync();
    surface.bump({ by: "user" });
  };
  const setDrafting = (on: boolean) => {
    drafting = on;
    sync();
    surface.bump({ what: "draft" });
  };
  const idx = (name: string) =>
    surface.observe().entries.find((e) => e.name === name)?.index ?? null;
  return { surface, log, taken, human, setDrafting, idx };
}
