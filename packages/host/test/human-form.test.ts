import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import type { Browser } from "playwright-core";
import { readHumanAuthStep, submitHumanAuthStep } from "../src/human-form";
import { chromiumMissing } from "./helpers";

let browser: Browser | null = null;
let missing: string | null = null;

beforeAll(async () => {
  missing = await chromiumMissing();
  if (!missing) browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

describe("semantic human authentication forms", () => {
  it("waits past a same-semantics remount for the settled next step", async (ctx) => {
    if (missing || !browser) return ctx.skip();
    const page = await browser.newPage();
    await page.route("http://auth.example/login", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><form><label id="label">E-mail address<input name="email" autocomplete="email"></label><button type="submit">Continue</button></form><script>
          document.querySelector("form").addEventListener("submit", event => {
            event.preventDefault();
            const old = document.querySelector("input");
            const replacement = old.cloneNode(true);
            replacement.removeAttribute("data-axe-human-field");
            old.replaceWith(replacement);
            setTimeout(() => {
              const label = document.querySelector("#label");
              label.firstChild.textContent = "Password";
              replacement.type = "password";
              replacement.name = "password";
              replacement.autocomplete = "current-password";
              document.querySelector("button").textContent = "Sign in";
            }, 1200);
          }, { once: true });
        </script>`,
      }),
    );
    await page.goto("http://auth.example/login");
    const nonce = "semantic-transition";
    const first = await readHumanAuthStep(page, nonce, "http://auth.example");
    const started = Date.now();
    const submitted = await submitHumanAuthStep(page, nonce, "http://auth.example", {
      stepId: first.id,
      fields: { [first.fields[0]!.id]: "person@example.com" },
      actionId: first.actions[0]!.id,
    });
    const elapsed = Date.now() - started;
    const next = await readHumanAuthStep(page, nonce, "http://auth.example");

    expect(submitted).toEqual({ ok: true });
    expect(elapsed).toBeGreaterThanOrEqual(1_400);
    expect(elapsed).toBeLessThan(4_000);
    expect(next.fields).toEqual([expect.objectContaining({ type: "password", label: "Password" })]);
    expect(next.actions).toEqual([expect.objectContaining({ label: "Sign in", primary: true })]);
    await page.close();
  });

  it("does not promote password visibility to a form action", async (ctx) => {
    if (missing || !browser) return ctx.skip();
    const page = await browser.newPage();
    await page.route("http://auth.example/password", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><form><label>Password<input type="password" autocomplete="current-password"></label><button type="button" aria-label="Show Password">eye</button><button type="submit" disabled>Sign in</button></form>`,
      }),
    );
    await page.goto("http://auth.example/password");
    const step = await readHumanAuthStep(page, "password-actions", "http://auth.example");
    expect(step.fields).toEqual([expect.objectContaining({ type: "password" })]);
    expect(step.actions).toEqual([]);
    await page.close();
  });
});
