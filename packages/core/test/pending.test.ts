import { describe, expect, it } from "vitest";
import { createAXE, action, z } from "../src/index";
import type { PendingResult, OkResult, ErrorResult } from "../src/types";
import { WIRE } from "../src/vocabulary";

function server() {
  let ticks = 0;
  const axe = createAXE({
    name: "Registrar",
    description:
      "University registrar: check application status, upload transcripts, and request enrollment verification letters.",
    baseUrl: "http://localhost:3000",
    auth: { modes: ["none"] },
    secret: "0123456789abcdef0123456789abcdef",
  });
  axe.register(
    action("letters.request", {
      title: "Request an enrollment verification letter",
      description:
        "Generates an official enrollment verification letter for the student and returns a download URL. Generation takes a few seconds; the result is delivered by polling.",
      risk: "low",
      input: z.object({ studentId: z.string().describe("Student id") }),
      output: z.object({ url: z.string() }),
      handler: async ({ input, pending }) =>
        pending({ retryAfter: 1, state: { studentId: input.studentId } }),
      onPoll: async ({ state, pending }) => {
        ticks++;
        if (ticks < 2) return pending({ retryAfter: 1 });
        return {
          url: `https://registrar.example/letters/${(state as { studentId: string }).studentId}.pdf`,
        };
      },
    }),
  );
  axe.register(
    action("letters.broken", {
      title: "Broken pending",
      description:
        "Test action that reports pending work without defining onPoll, to verify the runtime reports a configuration error.",
      risk: "low",
      input: z.object({}),
      output: z.object({}),
      handler: async ({ pending }) => pending(),
    }),
  );
  return axe;
}

async function post(axe: ReturnType<typeof server>, path: string, body: unknown) {
  return axe.handle(
    new Request(`http://localhost:3000${path}`, { method: "POST", body: JSON.stringify(body) }),
  );
}

describe("pending and poll [P-PEND-1] [P-PEND-2]", () => {
  it("returns a pollUrl with Retry-After, then the terminal result, which is then stable", async () => {
    const axe = server();
    const res = await post(axe, "/axe/actions/letters.request", {
      input: { studentId: "s1" },
      idempotencyKey: "k",
    });
    expect(res.headers.get(WIRE.header.retryAfter)).toBe("1");
    const p = (await res.json()) as PendingResult;
    expect(p.status).toBe("pending");
    expect(p.pollUrl.startsWith(`http://localhost:3000${WIRE.path.poll}/`)).toBe(true);
    expect(p.retryAfter).toBe(1);
    const again = (await (await axe.handle(new Request(p.pollUrl))).json()) as PendingResult;
    expect(again.status).toBe("pending");
    const done = (await (await axe.handle(new Request(p.pollUrl))).json()) as OkResult<{
      url: string;
    }>;
    expect(done.status).toBe("ok");
    expect(done.output.url).toContain("s1.pdf");
    const stable = (await (await axe.handle(new Request(p.pollUrl))).json()) as OkResult<{
      url: string;
    }>;
    expect(stable).toEqual(done);
    const bad = (await (
      await axe.handle(new Request(`http://localhost:3000${WIRE.path.poll}/nope`))
    ).json()) as ErrorResult;
    expect(bad.error.code).toBe(WIRE.error.notFound);
  });

  it("pending without onPoll is an internal error", async () => {
    const axe = server();
    const r = (await (
      await post(axe, "/axe/actions/letters.broken", { input: {}, idempotencyKey: "k" })
    ).json()) as ErrorResult;
    expect(r.error.code).toBe(WIRE.error.internal);
    expect(r.error.message).toContain("onPoll");
  });
});
