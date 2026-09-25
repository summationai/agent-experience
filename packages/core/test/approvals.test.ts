// Approval requests (spec §9.3): a consequential call is approved by a person on the site's own
// page, bound to the call's input, principal, tenant, and state, and executed once on resume.
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { accept, action, createAXE, kinds, requestApproval } from "../src/index";
import type { AXEActionEvent, ErrorResult, NeedsHumanResult, OkResult, Result } from "../src/types";
import { WIRE } from "../src/vocabulary";

interface Doc {
  rev: number;
  locked: boolean;
  lockedBy: string | null;
}

function site() {
  // Two tenants, one document each, with a revision column and a conditional write.
  const docs: Record<string, Doc> = {
    acme: { rev: 1, locked: false, lockedBy: null },
    globex: { rev: 1, locked: false, lockedBy: null },
  };
  const executed: { tenant: string; approvedBy: string; input: unknown }[] = [];
  const events: AXEActionEvent[] = [];
  const errors: Error[] = [];
  const axe = createAXE({
    name: "Docs",
    description: "Documents that can be locked, with approval.",
    baseUrl: "https://docs.example",
    secret: "approval-test-secret-0123456789",
    tenant: (req) => {
      const id = req.headers.get("x-tenant");
      return id ? { id, name: id, baseUrl: "https://docs.example" } : null;
    },
    auth: {
      modes: ["user"],
      authenticate: (req) => {
        const m = /^Bearer user:(\w+)$/.exec(req.headers.get("authorization") ?? "");
        return m ? { onBehalfOf: m[1]! } : null;
      },
    },
    onActionEvent: (e) => {
      events.push(e);
    },
    onError: (_ctx, e) => {
      errors.push(e as Error);
    },
  });
  axe.register(
    action("docs.lock", {
      title: "Lock the document",
      description:
        "Locks the tenant's document so nobody can edit it. A person approves every lock on the site before it runs.",
      input: z.object({ note: z.string().max(100) }),
      output: z.object({
        locked: z.boolean(),
        approvedBy: z.string(),
        revBefore: z.number(),
        revAfter: z.number(),
      }),
      risk: "high",
      auth: "user",
      reversible: false,
      approvalState: ({ tenant }) => ({ rev: docs[tenant!]!.rev, locked: docs[tenant!]!.locked }),
      handler: ({ input, tenant }) =>
        requestApproval({
          instructions: "Open the approval page and approve or cancel the lock.",
          url: `https://docs.example/approvals`,
          whatAgentShouldSayToUser: "Locking the document needs your approval on the site.",
          preview: { note: input.note, tenant: tenant!.id },
        }),
      onResume: ({ approval, tenant, fail }) => {
        if (!approval) return fail("internal", "not an approval");
        const doc = docs[tenant!.id]!;
        const expected = (approval.state as { rev: number }).rev;
        // The site's own conditional write is the second gate.
        if (doc.rev !== expected)
          return fail("conflict", "changed", { details: { currentRev: doc.rev } });
        const before = doc.rev;
        doc.rev += 1;
        doc.locked = true;
        doc.lockedBy = approval.approvedBy;
        executed.push({
          tenant: tenant!.id,
          approvedBy: approval.approvedBy,
          input: approval.input,
        });
        return {
          locked: true,
          approvedBy: approval.approvedBy,
          revBefore: before,
          revAfter: doc.rev,
        };
      },
    }),
  );
  axe.register(
    action("docs.sign", {
      title: "Ask for a signature",
      description: "Hands off to a person for a signature on the site.",
      input: z.object({}),
      output: z.object({ signed: z.boolean() }),
      risk: "medium",
      auth: "user",
      handler: ({ handoff }) =>
        handoff({
          reason: "signature_required",
          instructions: "Sign on the site.",
          url: "https://docs.example/sign",
          whatAgentShouldSayToUser: "A signature is needed on the site.",
        }),
      onResume: () => ({ signed: true }),
    }),
  );
  const call = async (
    path: string,
    body: unknown,
    who: { user?: string; tenant?: string } = { user: "alice", tenant: "acme" },
    headers: Record<string, string> = {},
  ): Promise<Result> => {
    const res = await axe.handle(
      new Request(`https://docs.example${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "TestAgent/1.0",
          ...(who.user ? { authorization: `Bearer user:${who.user}` } : {}),
          ...(who.tenant ? { "x-tenant": who.tenant } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
    return (await res.json()) as Result;
  };
  const requestLock = async (key = "k1", who = { user: "alice", tenant: "acme" }) => {
    const r = await call(
      "/axe/actions/docs.lock",
      { input: { note: "quarter close" }, idempotencyKey: key },
      who,
    );
    expect(r.status).toBe("needs_human");
    const h = (r as NeedsHumanResult).handoff;
    const id = new URL(h.url).searchParams.get(WIRE.query.handoff)!;
    return { handoff: h, id };
  };
  const resume = (token: string, who = { user: "alice", tenant: "acme" }) =>
    call("/axe/resume", { resumeToken: token }, who);
  return { axe, docs, executed, events, errors, call, requestLock, resume };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("approval requests", () => {
  it("an approval request returns needs_human and records the exact call for the site's page [P-APPR-1] [P-APPR-2]", async () => {
    const s = site();
    const { handoff, id } = await s.requestLock();
    expect(handoff.reason).toBe("approval_required");
    expect(s.executed).toEqual([]);
    // The approval page reads the call with the person's tenant.
    const view = await s.axe.getHandoff(id, { tenant: "acme" });
    expect(view).toMatchObject({
      id,
      action: "docs.lock",
      reason: "approval_required",
      status: "open",
      onBehalfOf: "alice",
      tenant: "acme",
      approval: {
        input: { note: "quarter close" },
        state: { rev: 1, locked: false },
        preview: { note: "quarter close", tenant: "acme" },
        agent: { name: "TestAgent", version: "1.0" },
      },
    });
    // The handoff carries none of it to the agent.
    expect(JSON.stringify(handoff)).not.toContain("quarter close");
    // The manifest declares that the action may hand off for approval.
    const manifest = await (
      await s.axe.handle(
        new Request("https://docs.example/.well-known/axe.json", {
          headers: { "x-tenant": "acme" },
        }),
      )
    ).json();
    const def = manifest.actions.find((a: { name: string }) => a.name === "docs.lock");
    expect(def.humanHandoff).toEqual({ reasons: ["approval_required"] });
    // Approval requests expire within the hour by default.
    expect(Date.parse(handoff.expiresAt) - Date.now()).toBeLessThanOrEqual(3600_000);
  });

  it("a resume before approval is a retryable conflict and runs nothing; nothing the agent sends approves [P-APPR-3]", async () => {
    const s = site();
    const { handoff, id } = await s.requestLock();
    const r = (await s.resume(handoff.resumeToken)) as ErrorResult;
    expect(r.error).toMatchObject({
      code: "conflict",
      retryable: true,
      details: { handoffStatus: "open" },
    });
    // A confirm flag or any other field on the resume body changes nothing.
    const r2 = (await s.call("/axe/resume", {
      resumeToken: handoff.resumeToken,
      confirm: true,
      approved: true,
    })) as ErrorResult;
    expect(r2.error.details?.["handoffStatus"]).toBe("open");
    // completeHandoff does not approve: approval has its own call with its own checks.
    expect(await s.axe.completeHandoff(id, { tenant: "acme", onBehalfOf: "alice" })).toBe(false);
    expect((await s.resume(handoff.resumeToken)).status).toBe("error");
    expect(s.executed).toEqual([]);
  });

  it("approved: the resume runs onResume once with the approved input and approver; a repeat replays the receipt [P-APPR-4] [P-APPR-7]", async () => {
    const s = site();
    const { handoff, id } = await s.requestLock();
    const decision = await s.axe.approveHandoff(id, { approver: "bob", tenant: "acme" });
    expect(decision.ok).toBe(true);
    expect(decision.ok && decision.view.status).toBe("approved");
    // A second approval is refused.
    expect(await s.axe.approveHandoff(id, { approver: "bob", tenant: "acme" })).toEqual({
      ok: false,
      reason: "already_approved",
    });
    const r = (await s.resume(handoff.resumeToken)) as OkResult<Record<string, unknown>>;
    expect(r.status).toBe("ok");
    expect(r.output).toEqual({ locked: true, approvedBy: "bob", revBefore: 1, revAfter: 2 });
    expect(s.executed).toEqual([
      { tenant: "acme", approvedBy: "bob", input: { note: "quarter close" } },
    ]);
    // The state has moved since (rev 2), yet a repeat is the same use: the stored receipt.
    const again = await s.resume(handoff.resumeToken);
    expect(again).toEqual(r);
    expect(s.executed).toHaveLength(1);
    expect((await s.axe.getHandoff(id, { tenant: "acme" }))!.status).toBe("used");
    // A used request can no longer be cancelled: the lock is committed.
    expect(await s.axe.cancelHandoff(id, { by: "alice", tenant: "acme" })).toEqual({
      ok: false,
      reason: "used",
    });
    // A lost response to the original call is answered from the idempotency store: the same handoff.
    const replay = (await s.call("/axe/actions/docs.lock", {
      input: { note: "quarter close" },
      idempotencyKey: "k1",
    })) as NeedsHumanResult;
    expect(replay.handoff.resumeToken).toBe(handoff.resumeToken);
  });

  it("a state change after the request invalidates the approval, at approval and at resume, for good [P-APPR-6]", async () => {
    const s = site();
    // Changed before the person approves: the approval is refused.
    const first = await s.requestLock("k1");
    s.docs["acme"]!.rev = 7;
    expect(await s.axe.approveHandoff(first.id, { approver: "bob", tenant: "acme" })).toEqual({
      ok: false,
      reason: "state_changed",
    });
    expect((await s.axe.getHandoff(first.id, { tenant: "acme" }))!.status).toBe("invalidated");
    // Even if the state came back, the request stays invalid.
    s.docs["acme"]!.rev = 1;
    expect(await s.axe.approveHandoff(first.id, { approver: "bob", tenant: "acme" })).toEqual({
      ok: false,
      reason: "invalidated",
    });
    const r1 = (await s.resume(first.handoff.resumeToken)) as ErrorResult;
    expect(r1.error).toMatchObject({
      code: "conflict",
      retryable: false,
      details: { handoffStatus: "invalidated" },
    });
    // Changed after the approval, before the resume: refused at resume, nothing runs.
    const second = await s.requestLock("k2");
    expect((await s.axe.approveHandoff(second.id, { approver: "bob", tenant: "acme" })).ok).toBe(
      true,
    );
    s.docs["acme"]!.rev = 2;
    const r2 = (await s.resume(second.handoff.resumeToken)) as ErrorResult;
    expect(r2.error).toMatchObject({ code: "conflict", details: { handoffStatus: "invalidated" } });
    expect(r2.error.message).toContain("start the action again");
    s.docs["acme"]!.rev = 1;
    expect(((await s.resume(second.handoff.resumeToken)) as ErrorResult).error.code).toBe(
      "conflict",
    );
    expect(s.executed).toEqual([]);
  });

  it("a cancelled request, open or approved, is refused with handoffStatus cancelled and nothing runs [P-APPR-5]", async () => {
    const s = site();
    const open = await s.requestLock("k1");
    const c = await s.axe.cancelHandoff(open.id, {
      by: "alice",
      tenant: "acme",
      reason: "not now",
    });
    expect(c.ok && c.view.status).toBe("cancelled");
    expect(await s.axe.approveHandoff(open.id, { approver: "bob", tenant: "acme" })).toEqual({
      ok: false,
      reason: "cancelled",
    });
    const r1 = (await s.resume(open.handoff.resumeToken)) as ErrorResult;
    expect(r1.error).toMatchObject({
      code: "conflict",
      retryable: false,
      details: { handoffStatus: "cancelled" },
    });
    // Revoking an approval before the agent resumes.
    const approved = await s.requestLock("k2");
    await s.axe.approveHandoff(approved.id, { approver: "bob", tenant: "acme" });
    expect((await s.axe.cancelHandoff(approved.id, { by: "bob", tenant: "acme" })).ok).toBe(true);
    const r2 = (await s.resume(approved.handoff.resumeToken)) as ErrorResult;
    expect(r2.error.details?.["handoffStatus"]).toBe("cancelled");
    expect(s.executed).toEqual([]);
    // Cancellation applies to any handoff, not only approvals.
    const sign = (await s.call("/axe/actions/docs.sign", {
      input: {},
      idempotencyKey: "s1",
    })) as NeedsHumanResult;
    const signId = new URL(sign.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect((await s.axe.cancelHandoff(signId, { tenant: "acme" })).ok).toBe(true);
    expect(await s.axe.completeHandoff(signId, { tenant: "acme" })).toBe(false);
    const r3 = (await s.resume(sign.handoff.resumeToken)) as ErrorResult;
    expect(r3.error.details?.["handoffStatus"]).toBe("cancelled");
  });

  it("an expired approval request is not_found and tells the agent to start again; it cannot be approved [P-APPR-8]", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T09:00:00Z"));
    const s = site();
    const { handoff, id } = await s.requestLock();
    await s.axe.approveHandoff(id, { approver: "bob", tenant: "acme" });
    vi.setSystemTime(new Date("2026-09-24T10:00:01Z"));
    const r = (await s.resume(handoff.resumeToken)) as ErrorResult;
    expect(r.error.code).toBe("not_found");
    expect(r.error.message).toContain("start the action again");
    // Byte-identical to an unknown token ([P-TOK-3]).
    expect(await s.resume("garbage")).toEqual(r);
    expect(await s.axe.getHandoff(id, { tenant: "acme" })).toBeNull();
    expect(await s.axe.approveHandoff(id, { approver: "bob", tenant: "acme" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(s.executed).toEqual([]);
  });

  it("the approval is bound to the principal and tenant: another user or tenant cannot read, approve, or resume it [P-APPR-2]", async () => {
    const s = site();
    const { handoff, id } = await s.requestLock();
    expect(await s.axe.getHandoff(id, { tenant: "globex" })).toBeNull();
    expect(await s.axe.getHandoff(id)).toBeNull();
    expect(await s.axe.approveHandoff(id, { approver: "bob", tenant: "globex" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    await s.axe.approveHandoff(id, { approver: "bob", tenant: "acme" });
    const garbage = await s.resume("garbage");
    expect(await s.resume(handoff.resumeToken, { user: "mallory", tenant: "acme" })).toEqual(
      garbage,
    );
    expect(await s.resume(handoff.resumeToken, { user: "alice", tenant: "globex" })).toEqual(
      await s.resume("garbage", { user: "alice", tenant: "globex" }),
    );
    expect(s.executed).toEqual([]);
    expect((await s.resume(handoff.resumeToken)).status).toBe("ok");
    expect(s.docs["globex"]!.locked).toBe(false);
  });

  it("requestApproval outside the handler, or without approvalState, is internal and reported [P-APPR-1]", async () => {
    const errors: Error[] = [];
    const axe = createAXE({
      name: "Bad",
      description: "Misused approvals.",
      baseUrl: "https://bad.example",
      secret: "approval-test-secret-0123456789",
      onError: (_c, e) => {
        errors.push(e as Error);
      },
    });
    const approval = () =>
      requestApproval({
        instructions: "Approve on the site.",
        url: "https://bad.example/approve",
        whatAgentShouldSayToUser: "This needs approval on the site.",
      });
    axe.register(
      action("bad.no-state", {
        title: "No state",
        description: "Asks for approval without declaring what it binds.",
        input: z.object({}),
        output: z.object({}),
        risk: "high",
        handler: approval,
        onResume: () => ({}),
      }),
    );
    axe.register(
      action("bad.from-continue", {
        title: "From continue",
        description: "Asks for approval from a continuation.",
        input: z.object({}),
        output: z.object({}),
        risk: "high",
        approvalState: () => 1,
        handler: ({ needsInput }) =>
          needsInput({
            reason: "email_required",
            message: "An email address is needed.",
            accepts: [accept(kinds.contact.email, { description: "Where to send the receipt." })],
          }),
        onContinue: approval,
        onResume: () => ({}),
      }),
    );
    const post = async (path: string, body: unknown) =>
      (await (
        await axe.handle(
          new Request(`https://bad.example${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
        )
      ).json()) as Result;
    const r1 = (await post("/axe/actions/bad.no-state", {
      input: {},
      idempotencyKey: "a",
    })) as ErrorResult;
    expect(r1.error.code).toBe("internal");
    const ni = await post("/axe/actions/bad.from-continue", { input: {}, idempotencyKey: "b" });
    expect(ni.status).toBe("needs_input");
    const r2 = (await post("/axe/continue", {
      continuationToken: (ni as { continuationToken: string }).continuationToken,
      kind: "contact.email",
      payload: { email: "a@b.example" },
    })) as ErrorResult;
    expect(r2.error, JSON.stringify(r2)).toMatchObject({ code: "internal" });
    expect(errors.map((e) => e.message).join("\n")).toMatch(
      /no approvalState[\s\S]*outside its handler/,
    );
    // action() refuses the shapes that could never work.
    expect(() =>
      action("bad.read", {
        title: "Read",
        description: "Reads something.",
        input: z.object({}),
        output: z.object({}),
        risk: "none",
        readOnly: true,
        approvalState: () => 1,
        handler: () => ({}),
        onResume: () => ({}),
      }),
    ).toThrow(/readOnly/);
    expect(() =>
      action("bad.no-resume", {
        title: "No resume",
        description: "Declares approval state but cannot run the approved call.",
        input: z.object({}),
        output: z.object({}),
        risk: "high",
        approvalState: () => 1,
        handler: () => ({}),
      }),
    ).toThrow(/onResume/);
  });

  it("approval lifecycle events name the actors and the handoff, never the input or the state [P-APPR-9]", async () => {
    const s = site();
    const a = await s.requestLock("k1");
    await s.axe.approveHandoff(a.id, { approver: "bob", tenant: "acme" });
    await s.resume(a.handoff.resumeToken);
    const b = await s.requestLock("k2");
    await s.axe.cancelHandoff(b.id, { by: "alice", tenant: "acme", reason: "wrong quarter" });
    const c = await s.requestLock("k3");
    s.docs["acme"]!.rev = 99;
    await s.axe.approveHandoff(c.id, { approver: "bob", tenant: "acme" });
    await flush();
    const summary = s.events.map((e) => [e.event, e.actor, e.status, e.details["handoffId"]]);
    expect(summary).toEqual([
      ["approval.requested", "alice", "needs_human", a.id],
      ["approval.approved", "bob", "ok", a.id],
      ["approval.executed", "alice", "ok", a.id],
      ["approval.requested", "alice", "needs_human", b.id],
      ["approval.cancelled", "alice", "ok", b.id],
      ["approval.requested", "alice", "needs_human", c.id],
      ["approval.invalidated", null, "error", c.id],
    ]);
    expect(s.events[2]!.details).toMatchObject({ approvedBy: "bob" });
    expect(s.events.every((e) => e.tenant === "acme" && e.action === "docs.lock")).toBe(true);
    const text = JSON.stringify(s.events);
    expect(text).not.toContain("quarter close");
    expect(text).not.toContain("wrong quarter");
  });
});
