import { describe, expect, it } from "vitest";
import { AXEClient, discover, findLinkHref, isOk, isNeedsHuman, isNeedsInput } from "../src/index";
import type { Fulfiller } from "../src/index";
import { present, toMarkdown, toHTML, formatValue } from "../src/present";
import { apartmentsAXE, UNITS } from "../../core/test/fixtures/apartments";
import { WIRE } from "@axe/core/vocabulary";

/** Route fetch calls into the in-process server, adding a fake HTML home page. */
function fetchFor(
  axe: { handle(req: Request): Promise<Response> },
  opts: { html?: string; header?: string; wellKnown?: boolean } = {},
) {
  let calls = 0;
  const f = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    calls++;
    const url = new URL(String(input));
    if (url.pathname === "/" || url.pathname === "/about") {
      const headers: Record<string, string> = { "content-type": "text/html" };
      if (opts.header) headers[WIRE.header.manifest] = opts.header;
      return new Response(opts.html ?? "<html><head><title>x</title></head></html>", { headers });
    }
    if (
      opts.wellKnown === false &&
      (url.pathname === WIRE.path.manifest || url.pathname === WIRE.path.manifestAlias)
    ) {
      return new Response("nope", { status: 404 });
    }
    if (url.pathname === "/custom/manifest.json")
      return axe.handle(new Request(new URL(WIRE.path.manifest, url.origin), init));
    return axe.handle(new Request(url, init));
  };
  return { fetch: f, calls: () => calls };
}

const ACH_PAYLOAD = {
  accountHolderName: "Dana Whitfield",
  routingNumber: "125000024",
  accountNumber: "000123454471",
  accountType: "checking",
  amount: 500,
  currency: "USD",
  authorizedAt: "2026-09-23T18:41:10Z",
  authorizationText: "I authorize the debit.",
};

describe("discover [P-DISC-7]", () => {
  it("finds the manifest at .well-known", async () => {
    const { axe } = apartmentsAXE();
    const r = await discover("https://oakridge-rentals.example/about", {
      fetch: fetchFor(axe).fetch,
    });
    expect(r.via).toBe("well-known");
    expect(r.manifest.name).toBe("Oakridge Rentals");
  });
  it("falls back to the AXE-Manifest header, then the link tag", async () => {
    const { axe } = apartmentsAXE();
    const viaHeader = await discover("https://oakridge-rentals.example/", {
      fetch: fetchFor(axe, { wellKnown: false, header: "/custom/manifest.json" }).fetch,
    });
    expect(viaHeader.via).toBe("header");
    const html = `<html><head><link rel="stylesheet" href="/x.css"><link rel="axe-manifest" href="/custom/manifest.json"></head></html>`;
    const viaLink = await discover("https://oakridge-rentals.example/", {
      fetch: fetchFor(axe, { wellKnown: false, html }).fetch,
    });
    expect(viaLink.via).toBe("link");
    expect(viaLink.manifestUrl).toBe("https://oakridge-rentals.example/custom/manifest.json");
    expect(findLinkHref(`<link href='/m.json' rel=axe-manifest>`)).toBe("/m.json");
    await expect(
      discover("https://oakridge-rentals.example/", {
        fetch: fetchFor(axe, { wellKnown: false }).fetch,
      }),
    ).rejects.toThrow(/No AXE manifest found/);
  });
});

describe("AXEClient", () => {
  it("invokes read actions and narrows results", async () => {
    const { axe } = apartmentsAXE();
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      agent: { name: "TestAgent", version: "1.0", vendor: "Acme" },
    });
    const r = await client.invoke<{ units: unknown[] }>("units.search", {
      location: "Bellevue, WA",
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.output.units).toHaveLength(2);
    expect(client.action("units.search")?.display?.kind).toBe("list");
  });

  it("generates idempotency keys for mutating actions and forwards auth", async () => {
    const { axe } = apartmentsAXE();
    const seen: string[] = [];
    const base = fetchFor(axe).fetch;
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: async (u, init) => {
        if (init?.body) seen.push(String(init.body));
        return base(u, init);
      },
      auth: () => "user:dana",
    });
    const r = await client.invoke("tours.book", { unitId: "u_204", at: "2026-10-02T17:00:00Z" });
    expect(isOk(r)).toBe(true);
    const body = JSON.parse(seen.at(-1)!) as { idempotencyKey: string };
    expect(body.idempotencyKey).toMatch(/[0-9a-f-]{36}/);
  });

  it("run(): fulfills needs_input from a wallet after confirmation, then continues to ok", async () => {
    const { axe } = apartmentsAXE();
    const confirmations: string[] = [];
    const wallet: Fulfiller = {
      kinds: [WIRE.kind.paymentAchDebit, WIRE.kind.paymentCard],
      fulfill: ({ accept }) =>
        accept.kind === WIRE.kind.paymentAchDebit ? ACH_PAYLOAD : undefined,
    };
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      auth: "user:dana",
      fulfillers: [wallet],
      confirm: ({ accept }) => {
        confirmations.push(accept.kind);
        return true;
      },
    });
    const outcome = await client.run<{ applicationId: string; depositStatus: string }>(
      "applications.submit",
      { unitId: "u_204" },
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") expect(outcome.result.output.depositStatus).toBe("received");
    expect(confirmations).toEqual([WIRE.kind.paymentAchDebit]);
  });

  it("run(): skips sensitive options without confirm, tries the next option, then falls back to the handoff", async () => {
    const { axe } = apartmentsAXE();
    const wallet: Fulfiller = { kinds: [WIRE.kind.paymentAchDebit], fulfill: () => ACH_PAYLOAD };
    const noConfirm = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      auth: "user:dana",
      fulfillers: [wallet],
    });
    const outcome = await noConfirm.run("applications.submit", { unitId: "u_204" });
    expect(outcome.status).toBe("needs_human");
    if (outcome.status === "needs_human") {
      expect(outcome.handoff.whatAgentShouldSayToUser).toContain("bank transfer");
      expect(isNeedsInput(outcome.result)).toBe(true);
    }
    const declined = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      auth: "user:dana",
      fulfillers: [wallet],
      confirm: () => false,
    });
    expect((await declined.run("applications.submit", { unitId: "u_204" })).status).toBe(
      "needs_human",
    );
  });

  it("run(): returns needs_input (not a handoff) when nothing matches and there is no fallback; surfaces needs_human directly", async () => {
    const { axe } = apartmentsAXE();
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      auth: "user:dana",
    });
    const lease = await client.run("leases.sign", { applicationId: "APP-1" });
    expect(lease.status).toBe("needs_human");
    if (lease.status === "needs_human") expect(isNeedsHuman(lease.result)).toBe(true);
    const anon = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
    });
    const login = await anon.run("tours.book", { unitId: "u_204", at: "2026-10-02T17:00:00Z" });
    expect(login.status).toBe("needs_human");
    if (login.status === "needs_human")
      expect(login.handoff.reason).toBe(WIRE.reason.loginRequired);
    expect((await client.run("nope.nothing", {})).status).toBe("error");
  });

  it("honors Retry-After on rate_limited and retries once", async () => {
    const { axe } = apartmentsAXE({ onRequest: () => undefined });
    let n = 0;
    const base = fetchFor(axe).fetch;
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: async (u, init) => {
        if (String(u).includes("/axe/actions/") && n++ === 0) {
          return new Response(
            JSON.stringify({
              status: "error",
              error: { code: "rate_limited", message: "slow", retryable: true },
            }),
            { status: 429, headers: { "Retry-After": "0", "content-type": "application/json" } },
          );
        }
        return base(u, init);
      },
    });
    const r = await client.invoke("units.search", { location: "x" });
    expect(isOk(r)).toBe(true);
    expect(n).toBe(2);
  });

  it("refuses to call a site whose policies deny the vendor [P-DISC-12]", async () => {
    const { axe } = apartmentsAXE({ policies: { agents: { deny: ["Acme"] } } });
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
      agent: { name: "A", vendor: "acme" },
    });
    expect(client.allowed()).toBe(false);
    const r = await client.invoke("units.search", { location: "x" });
    expect(r.status).toBe("error");
  });
});

describe("present", () => {
  it("renders Markdown with a comparison table, links, badges, next steps, and the disclaimer", async () => {
    const { axe } = apartmentsAXE();
    const def = axe.describe().actions[0]!;
    const md = toMarkdown(
      present(
        def,
        { status: "ok", output: { units: UNITS, nextCursor: null } },
        axe.describe().brand,
      ),
    );
    expect(md).toContain("| Option | Price | Size | Available | Pets |");
    expect(md).toContain("[The Meridian 204](https://oakridge-rentals.example/units/u_204)");
    expect(md).toContain("$2,950/mo");
    expect(md).toContain("720 sq ft");
    expect(md).toContain("`Pet friendly`");
    expect(md).toContain(
      '**Apply for this unit** (`applications.submit` with `{"unitId":"u_204"}`)',
    );
    expect(md).toContain("_Pricing and availability change frequently");
    const empty = toMarkdown(
      present(def, { status: "ok", output: { units: [], nextCursor: null } }),
    );
    expect(empty).toContain("No units match those filters");
  });

  it("renders self-contained HTML with escaped data, safe URLs only, brand accent, and affordance buttons", async () => {
    const { axe } = apartmentsAXE();
    const def = axe.describe().actions[0]!;
    const evil = {
      ...UNITS[0]!,
      name: `<script>alert(1)</script> "Quoted"`,
      humanUrl: "javascript:alert(1)",
      photos: ["data:image/png;base64,AAAA", "https://oakridge-rentals.example/img/ok.jpg"],
      badges: ["<b>bold</b>"],
    };
    const html = toHTML(
      present(
        def,
        { status: "ok", output: { units: [evil, UNITS[1]!], nextCursor: null } },
        axe.describe().brand,
      ),
    );
    expect(html).toContain("<!doctype html>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &quot;Quoted&quot;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).toContain('src="https://oakridge-rentals.example/img/ok.jpg"');
    expect(html).toContain("--axe-accent:#2b6cb0");
    expect(html).toContain('data-axe-action="applications.submit"');
    expect(html).toContain('data-axe-input="{&quot;unitId&quot;:&quot;u_204&quot;}"');
    expect(html).toContain('class="axe-primary"');
    expect(html).toContain("axe:select");
    expect(html).toContain("Confirm on the listing page before applying.");
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    const table = toHTML(
      present(def, { status: "ok", output: { units: UNITS, nextCursor: null } }),
      { layout: "table" },
    );
    expect(table).toContain('<table class="axe-table">');
  });

  it("formats attribute values by format", () => {
    expect(formatValue({ label: "x", value: true, format: "boolean" })).toBe("Yes");
    expect(formatValue({ label: "x", value: 1234.5, format: "number" })).toBe("1,234.5");
    expect(formatValue({ label: "x", value: "2026-10-15", format: "date" })).toBe("Oct 15, 2026");
    expect(formatValue({ label: "x", value: ["a", "b"], format: "list" })).toBe("a, b");
    expect(formatValue({ label: "x", value: 900, format: "area" })).toBe("900 sq ft");
    expect(() =>
      present(axeDef(), {
        status: "error",
        error: { code: "internal", message: "x", retryable: false },
      }),
    ).toThrow(/expected an ok result/);
  });
});

function axeDef() {
  return apartmentsAXE().axe.describe().actions[0]!;
}
