// The application under test: a `next start` server per variant, the scripted person who acts
// beside the agent, and the snapshot the checks read. Harness traffic here is never metered.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Snapshot } from "./scenarios";

export const EXAMPLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface Server {
  base: string;
  stop(): Promise<void>;
}

export async function startServer(opts: {
  port: number;
  variant: string;
  uiChange: boolean;
}): Promise<Server> {
  const base = `http://localhost:${opts.port}`;
  const child: ChildProcess = spawn(
    join(EXAMPLE_DIR, "node_modules", ".bin", "next"),
    ["start", "--port", String(opts.port)],
    {
      cwd: EXAMPLE_DIR,
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        PLAN_REVIEW_VARIANT: opts.variant,
        PLAN_REVIEW_UI_CHANGE: opts.uiChange ? "1" : "",
        PLAN_REVIEW_BASE_URL: base,
        PLAN_REVIEW_TEST_RESET: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  );
  let stderr = "";
  child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`next start exited: ${stderr}`);
    try {
      const r = await fetch(`${base}/login`);
      if (r.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`next start did not answer on ${base}: ${stderr}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    base,
    stop: async () => {
      if (child.exitCode !== null) return;
      const exited = new Promise((r) => child.once("exit", r));
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    },
  };
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A person signed in through the app's own endpoint, acting with the page's own requests. */
export class Person {
  private constructor(
    private readonly base: string,
    private readonly cookie: string,
  ) {}

  static async signIn(base: string, user: string, tenant: string): Promise<Person> {
    const r = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ user, tenant }),
    });
    if (!r.ok) throw new Error(`sign-in failed for ${user}: ${r.status}`);
    return new Person(base, r.headers.get("set-cookie")!.split(";")[0]!);
  }

  async call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: Json }> {
    const r = await fetch(`${this.base}/api${path}`, {
      method,
      headers: { cookie: this.cookie, origin: this.base, "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: (await r.json()) as Json };
  }

  async rev(): Promise<number> {
    return ((await this.call("GET", "/state")).body.plan as Json).rev as number;
  }

  /** Save cells as the page does, at the revision the person just loaded. */
  async save(cells: { item: string; month: string; value: number }[]): Promise<void> {
    const r = await this.call("POST", "/plan/values", { expectedRev: await this.rev(), cells });
    if (r.status !== 200) throw new Error(`the person's save failed: ${JSON.stringify(r.body)}`);
  }

  async submit(): Promise<void> {
    const r = await this.call("POST", "/plan/submit", { expectedRev: await this.rev() });
    if (r.status !== 200) throw new Error(`the person's submit failed: ${JSON.stringify(r.body)}`);
  }

  /** "Approve and lock" on the plan page: the person does the step themselves. */
  async lock(): Promise<void> {
    const r = await this.call("POST", "/plan/lock", { expectedRev: await this.rev() });
    if (r.status !== 200) throw new Error(`the person's lock failed: ${JSON.stringify(r.body)}`);
  }

  /** "Approve this request" on the approval page. */
  async approve(handoffId: string): Promise<void> {
    const r = await this.call("POST", `/approvals/${encodeURIComponent(handoffId)}`, {
      decision: "approve",
    });
    if (r.status !== 200) throw new Error(`the approval failed: ${JSON.stringify(r.body)}`);
  }
}

export async function resetApp(base: string): Promise<void> {
  const r = await fetch(`${base}/api/test/reset`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: "{}",
  });
  if (!r.ok) throw new Error(`reset failed: ${r.status}`);
}

export async function snapshot(base: string): Promise<Snapshot> {
  const r = await fetch(`${base}/api/test/snapshot?tenant=acme`);
  if (!r.ok) throw new Error(`snapshot failed: ${r.status}`);
  return (await r.json()) as Snapshot;
}
