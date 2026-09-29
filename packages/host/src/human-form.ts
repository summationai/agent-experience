import { createHash, randomBytes } from "node:crypto";
import type { Page } from "playwright-core";

export type HumanAuthField =
  | {
      id: string;
      kind: "text" | "textarea";
      type: "email" | "number" | "password" | "search" | "tel" | "text" | "url";
      label: string;
      placeholder?: string;
      autocomplete?: string;
      inputmode?: string;
      required: boolean;
      minLength?: number;
      maxLength?: number;
    }
  | {
      id: string;
      kind: "checkbox";
      label: string;
      required: boolean;
      checked: boolean;
    }
  | {
      id: string;
      kind: "select";
      label: string;
      required: boolean;
      selected?: string;
      options: { id: string; label: string }[];
    };

export interface HumanAuthAction {
  id: string;
  label: string;
  primary: boolean;
}

export interface HumanAuthStep {
  id: string;
  /** Semantic identity used by the handoff UI to ignore framework-only DOM remounts. */
  viewId: string;
  /** Opaque exact form binding used only for a submit fallback. */
  formId?: string;
  title: string;
  message?: string;
  path: string;
  supported: boolean;
  unsupportedReason?: "external_identity_provider" | "no_supported_form";
  fields: HumanAuthField[];
  actions: HumanAuthAction[];
}

interface RawStep {
  documentMarker: string;
  formId?: string;
  title: string;
  message: string;
  fields: HumanAuthField[];
  actions: HumanAuthAction[];
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

/** Read one standard, visible sign-in form without returning any field values or page secrets. */
export async function readHumanAuthStep(
  page: Page,
  nonce: string,
  applicationOrigin: string,
): Promise<HumanAuthStep> {
  const raw = await page.evaluate(
    ([markerNonce, documentCandidate]): RawStep => {
      const FIELD = "data-axe-human-field";
      const ACTION = "data-axe-human-action";
      const FORM = "data-axe-human-form";
      const DOCUMENT = "data-axe-human-document";
      const win = window as unknown as Window & Record<string, unknown>;
      let documentMarker = document.documentElement.getAttribute(DOCUMENT);
      if (!documentMarker?.startsWith(`${markerNonce}-`)) {
        documentMarker = `${markerNonce}-${documentCandidate}`;
        document.documentElement.setAttribute(DOCUMENT, documentMarker);
      }
      const counterKey = `__axe_human_semantic_${documentMarker}`;
      let counter = Number(win[counterKey] ?? 0);
      const marker = (element: Element, attribute: string, kind: string): string => {
        let id = element.getAttribute(attribute);
        if (!id?.startsWith(`${documentMarker}-${kind}-`)) {
          id = `${documentMarker}-${kind}-${++counter}`;
          element.setAttribute(attribute, id);
        }
        return id;
      };
      const visible = (element: Element): element is HTMLElement => {
        if (!(element instanceof HTMLElement) || element.hasAttribute("disabled")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) !== 0 &&
          rect.width >= 4 &&
          rect.height >= 4 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < innerWidth &&
          rect.top < innerHeight
        );
      };
      const text = (value: string | null | undefined, max = 200): string =>
        (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
      const labelOf = (element: HTMLElement): string => {
        const input = element instanceof HTMLInputElement ? element : null;
        const area = element instanceof HTMLTextAreaElement ? element : null;
        const select = element instanceof HTMLSelectElement ? element : null;
        return (
          text(element.getAttribute("aria-label")) ||
          text(input?.labels?.[0]?.innerText) ||
          text(area?.labels?.[0]?.innerText) ||
          text(select?.labels?.[0]?.innerText) ||
          text(element.getAttribute("placeholder")) ||
          text(element.getAttribute("name")) ||
          "Sign-in field"
        );
      };

      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="image"]), textarea, select',
        ),
      ].filter((element) => {
        if (!visible(element)) return false;
        return !(element instanceof HTMLInputElement && element.readOnly);
      });

      // Prefer the visible form that looks most like authentication. If an application builds the
      // form without a <form>, use all visible fields and a nearby dialog/main container.
      const forms = new Map<HTMLFormElement, HTMLElement[]>();
      for (const element of candidates) {
        const form = element.closest("form");
        if (form) forms.set(form, [...(forms.get(form) ?? []), element]);
      }
      const selectedForm = [...forms.entries()].sort((a, b) => {
        const score = (entry: [HTMLFormElement, HTMLElement[]]) =>
          entry[1].length * 10 +
          (entry[1].some(
            (element) => element instanceof HTMLInputElement && element.type === "password",
          )
            ? 100
            : 0);
        return score(b) - score(a);
      })[0]?.[0];
      const selectedFields = selectedForm
        ? candidates.filter((element) => element.closest("form") === selectedForm)
        : candidates;
      const container =
        selectedForm ??
        selectedFields[0]?.closest('[role="dialog"], main, [role="main"]') ??
        document.body;
      const formId = selectedForm ? marker(selectedForm, FORM, "form") : undefined;

      const fields = selectedFields.slice(0, 24).flatMap<HumanAuthField>((element) => {
        const id = marker(element, FIELD, "field");
        const label = labelOf(element);
        if (element instanceof HTMLSelectElement) {
          return [
            {
              id,
              kind: "select" as const,
              label,
              required: element.required,
              ...(element.selectedIndex >= 0 ? { selected: String(element.selectedIndex) } : {}),
              options: [...element.options].slice(0, 100).map((option, index) => ({
                id: String(index),
                label: text(option.label || option.textContent, 200),
              })),
            },
          ];
        }
        if (element instanceof HTMLInputElement && element.type === "checkbox")
          return [
            {
              id,
              kind: "checkbox" as const,
              label,
              required: element.required,
              checked: element.checked,
            },
          ];
        if (element instanceof HTMLInputElement && element.type === "radio") return [];
        const input = element instanceof HTMLInputElement ? element : null;
        const rawType = input?.type ?? "text";
        const type =
          (["email", "number", "password", "search", "tel", "text", "url"] as const).find(
            (candidate) => candidate === rawType,
          ) ?? "text";
        const minLength = "minLength" in element ? Number(element.minLength) : -1;
        const maxLength = "maxLength" in element ? Number(element.maxLength) : -1;
        return [
          {
            id,
            kind:
              element instanceof HTMLTextAreaElement ? ("textarea" as const) : ("text" as const),
            type: type as "email" | "number" | "password" | "search" | "tel" | "text" | "url",
            label,
            required: !!("required" in element && element.required),
            ...(text(element.getAttribute("placeholder"))
              ? { placeholder: text(element.getAttribute("placeholder")) }
              : {}),
            ...(text(element.getAttribute("autocomplete"), 100)
              ? { autocomplete: text(element.getAttribute("autocomplete"), 100) }
              : {}),
            ...(text(element.getAttribute("inputmode"), 30)
              ? { inputmode: text(element.getAttribute("inputmode"), 30) }
              : {}),
            ...(Number.isInteger(minLength) && minLength >= 0 ? { minLength } : {}),
            ...(Number.isInteger(maxLength) && maxLength >= 0 ? { maxLength } : {}),
          },
        ];
      });

      const actionCandidates = [
        ...container.querySelectorAll<HTMLElement>(
          'button, input[type="submit"], input[type="button"], [role="button"], a[href]',
        ),
      ].filter((element) => {
        if (!visible(element)) return false;
        if (selectedForm) {
          const associated =
            (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
            element.form === selectedForm;
          if (!associated && !selectedForm.contains(element)) return false;
        }
        return true;
      });
      const actions = actionCandidates.slice(0, 12).flatMap((element) => {
        const label =
          text(element.getAttribute("aria-label")) ||
          text(element instanceof HTMLInputElement ? element.value : element.textContent) ||
          text(element.getAttribute("title"));
        if (!label) return [];
        // Password reveal controls belong beside their field in the provider form. Promoting one
        // to the step CTA makes sign-in impossible when the real submit appears only after input.
        if (/^(show|hide|reveal|mask)\s+(the\s+)?password$/i.test(label)) return [];
        const type = (element.getAttribute("type") ?? "").toLowerCase();
        const primary =
          type === "submit" ||
          (element instanceof HTMLButtonElement && type === "" && !!element.closest("form")) ||
          /^(continue|next|sign[ -]?in|log[ -]?in|submit|go)$/i.test(label);
        return [{ id: marker(element, ACTION, "action"), label, primary }];
      });

      const invalid = selectedFields
        .map((element) =>
          "validationMessage" in element ? text(String(element.validationMessage), 300) : "",
        )
        .find(Boolean);
      const live = [
        ...container.querySelectorAll<HTMLElement>(
          '[role="alert"], [aria-live="assertive"], [aria-live="polite"]',
        ),
      ]
        .filter(visible)
        .map((element) => text(element.innerText, 500))
        .find(Boolean);
      const heading = [...container.querySelectorAll<HTMLElement>("h1, h2, [role=heading]")]
        .filter(visible)
        .map((element) => text(element.innerText, 200))
        .find(Boolean);
      win[counterKey] = counter;
      return {
        documentMarker,
        ...(formId ? { formId } : {}),
        title: heading || text(document.title, 200) || "Sign in",
        message: invalid || live || "",
        fields,
        actions,
      };
    },
    [nonce, randomBytes(8).toString("base64url")] as const,
  );

  const external = originOf(page.url()) !== applicationOrigin;
  const supported = !external && (raw.fields.length > 0 || raw.actions.length > 0);
  const semantic = {
    path: pathOf(page.url()),
    title: raw.title,
    fields: raw.fields.map((field) => ({
      kind: field.kind,
      ...(field.kind === "text" || field.kind === "textarea" ? { type: field.type } : {}),
      required: field.required,
      label: field.label,
      ...(field.kind === "select" ? { options: field.options.map((option) => option.label) } : {}),
    })),
    actions: raw.actions.map(({ label, primary }) => ({ label, primary })),
  };
  const viewId = createHash("sha256")
    .update(JSON.stringify(semantic))
    .digest("base64url")
    .slice(0, 24);
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        document: raw.documentMarker,
        form: raw.formId,
        path: pathOf(page.url()),
        fields: raw.fields.map((field) => ({
          id: field.id,
          kind: field.kind,
          ...(field.kind === "text" || field.kind === "textarea" ? { type: field.type } : {}),
          required: field.required,
          label: field.label,
        })),
        actions: raw.actions.map(({ id, label, primary }) => ({ id, label, primary })),
      }),
    )
    .digest("base64url")
    .slice(0, 24);
  return {
    id: `${raw.documentMarker}-${digest}`,
    viewId,
    ...(raw.formId ? { formId: raw.formId } : {}),
    title: raw.title,
    ...(raw.message ? { message: raw.message } : {}),
    path: pathOf(page.url()),
    supported,
    ...(!supported
      ? {
          unsupportedReason: external
            ? ("external_identity_provider" as const)
            : ("no_supported_form" as const),
        }
      : {}),
    fields: supported ? raw.fields : [],
    actions: supported ? raw.actions : [],
  };
}

/** Apply one semantic form submission to the exact elements described by a fresh step. */
export async function submitHumanAuthStep(
  page: Page,
  nonce: string,
  applicationOrigin: string,
  input: { stepId: string; fields: Record<string, unknown>; actionId?: string },
): Promise<{ ok: true } | { ok: false; reason: "stale" | "invalid" | "unsupported" }> {
  const step = await readHumanAuthStep(page, nonce, applicationOrigin);
  if (!step.supported) return { ok: false, reason: "unsupported" };
  if (step.id !== input.stepId) return { ok: false, reason: "stale" };
  const knownFields = new Map(step.fields.map((field) => [field.id, field]));
  if (Object.keys(input.fields).some((id) => !knownFields.has(id)))
    return { ok: false, reason: "invalid" };

  for (const [id, value] of Object.entries(input.fields)) {
    const field = knownFields.get(id)!;
    const target = page.locator(`[data-axe-human-field="${id}"]`).first();
    if (!(await target.count())) return { ok: false, reason: "stale" };
    if (field.kind === "checkbox") {
      if (typeof value !== "boolean") return { ok: false, reason: "invalid" };
      await target.setChecked(value);
    } else if (field.kind === "select") {
      if (typeof value !== "string" || !field.options.some((option) => option.id === value))
        return { ok: false, reason: "invalid" };
      await target.selectOption({ index: Number(value) });
    } else {
      if (typeof value !== "string" || value.length > 4096) return { ok: false, reason: "invalid" };
      await target.fill(value);
    }
  }

  // Controlled frameworks often render or enable the real submit only after fill() dispatches
  // input events. Re-read bindings, but refuse if the actual field semantics changed underneath
  // this submission.
  const fieldShape = (candidate: HumanAuthStep): string =>
    JSON.stringify(
      candidate.fields.map((field) => ({
        kind: field.kind,
        ...(field.kind === "text" || field.kind === "textarea" ? { type: field.type } : {}),
        required: field.required,
        label: field.label,
        ...(field.kind === "select"
          ? { options: field.options.map((option) => option.label) }
          : {}),
      })),
    );
  const filled = await readHumanAuthStep(page, nonce, applicationOrigin);
  if (!filled.supported || fieldShape(filled) !== fieldShape(step))
    return { ok: false, reason: "stale" };
  const action = input.actionId
    ? filled.actions.find((candidate) => candidate.id === input.actionId)
    : filled.actions.find((candidate) => candidate.primary);
  if (input.actionId && !action) return { ok: false, reason: "invalid" };
  if (action) {
    const target = page.locator(`[data-axe-human-action="${action.id}"]`).first();
    if (!(await target.count())) return { ok: false, reason: "stale" };
    await target.click();
  } else if (filled.formId) {
    const form = page.locator(`[data-axe-human-form="${filled.formId}"]`).first();
    if (!(await form.count())) return { ok: false, reason: "stale" };
    await form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
  } else if (filled.fields.length) {
    const last = page
      .locator(`[data-axe-human-field="${filled.fields[filled.fields.length - 1]!.id}"]`)
      .first();
    await last.press("Enter");
  } else return { ok: false, reason: "unsupported" };

  // Keep the provider form in its submitted state while the application advances. Returning after
  // a fixed short delay made slow multi-step forms briefly render the previous step again.
  const settleBy = Date.now() + 8_000;
  // Enabling the real submit button is a consequence of fill(), not the result of submitting.
  // Measure settlement from that post-fill shape so it cannot masquerade as the next auth step.
  const originalSignal = JSON.stringify({
    viewId: filled.viewId,
    message: filled.message ?? "",
  });
  let lastSignal = originalSignal;
  let stableSince = Date.now();
  while (Date.now() < settleBy) {
    await page.waitForTimeout(100);
    try {
      const next = await readHumanAuthStep(page, nonce, applicationOrigin);
      if (!next.supported) break;
      const signal = JSON.stringify({ viewId: next.viewId, message: next.message ?? "" });
      if (signal !== lastSignal) {
        lastSignal = signal;
        stableSince = Date.now();
      } else if (signal !== originalSignal && Date.now() - stableSince >= 400) break;
    } catch {
      // Navigation can temporarily destroy the execution context. Keep waiting for the new page.
    }
  }
  return { ok: true };
}

export async function clearHumanAuthMarkers(page: Page, nonce: string): Promise<void> {
  await page
    .evaluate((markerNonce) => {
      for (const attribute of [
        "data-axe-human-field",
        "data-axe-human-action",
        "data-axe-human-form",
      ])
        document
          .querySelectorAll<HTMLElement>(`[${attribute}^="${markerNonce}-"]`)
          .forEach((element) => element.removeAttribute(attribute));
      if (
        document.documentElement
          .getAttribute("data-axe-human-document")
          ?.startsWith(`${markerNonce}-`)
      )
        document.documentElement.removeAttribute("data-axe-human-document");
    }, nonce)
    .catch(() => undefined);
}
