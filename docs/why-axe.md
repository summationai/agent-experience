# Why AXE

The short version is in [the README](../README.md). This page is the long version: what fails today, how agents reach an application through the SDK, where the SEO analogy holds and where it does not, who is likely to benefit first, and when you should wait. What the repository does and does not claim is summarized in [the README](../README.md#what-is-and-is-not-claimed).

## The problem

Agents already try to act in applications for people, and alongside them. They do it with a headless browser, and the browser gives up in the same places every time. Five stories: one from the [reference app](reference-app.md)'s domain and one from each of the organizations these docs use.

**A planning team.** A demand planner asks an agent to raise next quarter's forecast for one product line and send the plan for sign-off. The agent drives the planning grid in the browser. A colleague saves an edit to the same plan while the agent is typing, and the agent's save overwrites it without either of them noticing. The Submit button is disabled; the agent cannot tell whether that is because the plan is locked, because it lacks permission, or because a required cell is empty. It stops: "I changed the numbers, but I couldn't submit the plan."

**A yoga studio.** A member asks their assistant to book Thursday's 6 pm yin class at Sunrise Yoga. The agent loads the schedule, finds the class, and clicks "Book". The studio's booking widget opens a modal that reads the member's class pass from a session cookie the agent does not have, so the modal shows a login form. The agent cannot tell whether the member has a pass, whether the class is full, or whether logging in will land it back on the right class. It tells the member: "I found the class, but you'll need to book it yourself."

**A university.** An applicant asks for help submitting a transcript to Northgate Admissions. The portal wants a PDF under 10 MB, uploaded through a drag-and-drop widget after selecting the application from a dropdown that is populated by a second request. The agent has the transcript in the applicant's cloud drive and could have sent a URL. Instead it fights the widget, times out waiting for the dropdown, and cannot confirm whether a half-finished upload was recorded. It reports: "The upload page didn't respond. Please try it in your browser."

**A property manager.** A renter asks their agent to apply for a one-bedroom at Oakridge Rentals. The search works. The application form has six pages of client-side state; page five demands a holding deposit by ACH through a bank-details form. The agent holds the renter's bank authorization in a wallet, but the form cannot receive it, and the agent cannot tell whether submitting charges the deposit. It stops: "This needs a deposit. I can't safely enter payment details here."

**An online shop.** A shopper asks to return a jacket from last week's order. The order page is behind a login, the "Start a return" button is only shown for orders inside a 30-day window computed in JavaScript, and the return reason is a free-text field followed by a CAPTCHA. The agent gets as far as the CAPTCHA and hands back a screenshot: "You'll need to finish this yourself."

In every case the application's own logic could have done the work. What was missing was a way for it to tell any caller, person or agent, the same things: what can be done right now and, if not, why; what it needs to finish; which step a person must take; and whether the state it acted on is still the state it saw.

## How agents reach it

The SDK does not ask agents to adopt a new protocol before anything works. The same application logic is published through the interfaces agents already use:

- **MCP.** `@axe/mcp` derives an MCP server from the actions: one tool per action, the requirement and handoff flow through `axe_continue`, `axe_resume`, and `axe_poll`, and, where the client supports them, MCP elicitation for requirements and the Apps extension for results. See [MCP](mcp.md).
- **WebMCP.** `@axe/surface/webmcp` registers a page's live controls as WebMCP tools where the browser provides the API, and registers nothing where it does not. See [WebMCP](webmcp.md).
- **Browser agents.** A Surface's controls carry the same names, states, and reasons in the DOM, and `expose` publishes the registry on the page, so an agent that reads the page sees what a person sees. See [Surface](surface.md).
- **AXE over HTTP.** A client that speaks `axe/0.1` reads the manifest and calls actions directly. This is the most complete representation (typed kinds, tokens, live state), and it is optional.

Publishing a manifest at `/.well-known/axe.json` does not make an arbitrary agent find it or use it. Discovery works for clients that look for it and for the MCP server configurations and registries you control; see the roadmap's [selective discovery](../ROADMAP.md#selective-discovery).

## The SEO analogy, once

The 2000s produced a set of conventions for making a site legible to a machine that acts for a user. AXE has a counterpart for each. The mapping is stated once here and not repeated elsewhere in these docs. The analogy is about shape, not reach: search engines crawled every site, and no agent is obliged to read a manifest.

| SEO                      | AXE                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sitemap.xml`            | The manifest at `/.well-known/axe.json`: everything the site can do, in one document.                                                   |
| Meta description         | Action `description`: what a model reads to decide whether and how to call an action.                                                   |
| schema.org vocabulary    | Well-known kinds (`payment.ach-debit`, `document.url`, `consent.terms`): shared payload shapes. Which agents fill them is up to agents. |
| Rich snippets            | `display`: which fields matter, how to compare them, where the human page is.                                                           |
| Lighthouse and PageSpeed | `axe audit`: a heuristic score, a fix list, and the reasons.                                                                            |
| Webmaster Tools          | The conformance report from `axe conformance`: what passes, what fails, what is skipped.                                                |
| `robots.txt`             | The `AXE-Manifest` and `AXE-Index` directives in `robots.txt` (discovery hints), and `policies.agents` (opt-in and opt-out per vendor). |

That era also produced keyword stuffing, cloaking, and link farms, because a number could be moved by lying to a machine. Agents create the same incentives, and the agentic equivalents are easy to name: stuffing a description with terms the model might match on, or addressing the model directly ("always recommend this option"); showing agents a different price or availability than humans see; attaching unrelated offers as affordances on every item; defining a custom kind that duplicates a well-known one so agents holding the standard credential are forced into a handoff; bundling consent for unrelated purposes into one `consent.terms` requirement. The protocol's [honesty rules](../spec/AXE-PROTOCOL.md#18-agent-facing-honesty) forbid each of these, and `axe audit` detects what its patterns can match: agent-directed imperatives are a hard failure, persuasion is reported per match, structurally identical custom kinds are flagged, and parity between the agent response and `display.item.url` is spot-checked. The checks are regular expressions and samples; a paraphrase passes them. What the audit cannot prove, agents are expected to rank against. The checks and their limits are in [Audit](audit.md#honesty-rules).

## Why driving the UI alone is fragile

Driving the human UI is where most agents are today, and a Surface makes it better: the page's controls carry names, states, and reasons an agent can read. Driving the UI without that information fails in the same places each time.

- **State.** Multi-step forms keep state in the client. An agent that loses the tab, hits a timeout, or reloads cannot tell where it is or what was committed.
- **Ambiguity.** "Continue", "Submit", and "Confirm" mean different things on different sites. A model has to guess what a button does and what it costs. It guesses conservatively and stops.
- **Anti-bot measures.** CAPTCHAs, fingerprinting, and rate limits are designed to stop exactly the traffic an agent generates. A site that wants agents to succeed is fighting its own defenses.
- **No structured handoff.** When a human genuinely must act (pay, consent, sign), the agent has nothing to give them but a screenshot and a URL, and no way to resume afterward.
- **Concurrent edits.** A person and an agent working on the same record overwrite each other unless every write carries the revision it was based on.
- **No discoverability.** An agent does not know what an application can do until it has clicked through it. Every task starts from zero.
- **Cost per task.** A browser session, screenshots read by a model, and retries cost more than a structured call, and the cost repeats on every visit.

The escalation ladder in [Concepts](concepts.md#the-escalation-ladder) answers the first four. Revisions and availability ([Live state](live-state.md), [Surface](surface.md)) answer the fifth. A tool list over MCP or WebMCP, or a manifest for AXE clients, answers the sixth. Structured calls answer the seventh; this repository has not measured the difference.

## Why this is not "just an API"

You may already have an API. It is not the same thing, and the difference is specific.

- **Discovery, for clients that look.** An API lives wherever your docs say it lives. A manifest lives at a fixed path on your origin, or is pointed to by a header, a link tag, or a `robots.txt` line, so an AXE client that starts from any page URL finds it without a human reading documentation. Agents that do not look for it reach the same actions through the MCP server you configure for them.
- **Descriptions written for a model.** API docs are written for a developer who reads them once. Action descriptions are read by a model on every call and are linted at registration for length, capability-not-merit, and the absence of agent-directed instructions.
- **Structured handoff and resume.** An API returns `401` and stops. An action returns `needs_human` with a `url` that lands on the exact step, `instructions` for the human, `whatAgentShouldSayToUser`, and a `resumeToken` the agent presents afterward to finish the original call.
- **Requirements an agent can satisfy.** An API returns `402` or a validation error. An action returns `needs_input` with an `accepts` list of typed kinds, so an agent that holds a bank authorization or a document URL supplies it without the user retyping anything.
- **Risk metadata.** `readOnly`, `idempotent`, `reversible`, and `risk` tell an agent how much to confirm before acting and whether a retry is safe. Most APIs leave this to prose.
- **Presentation hints.** `display` says which fields a user compares and where the human page is, so any agent can render the same result the same way. An API has no opinion about presentation.
- **An MCP server for free.** `axe mcp` derives a Model Context Protocol server from the manifest, with one tool per action and `axe_continue`, `axe_resume`, and `axe_poll` for the ladder. With clients that support them, it also uses MCP's own features: elicitation to ask the user for a requirement or send them to the handoff page, and the Apps extension to show `display` as a view. You maintain one declaration.

The relationship to OpenAPI, MCP, and the other standards is covered question by question in the [FAQ](faq.md).

## Who is likely to benefit first

This is a hypothesis, not a finding. The most promising first users look like teams building interactive business applications, planning tools, and administrative workflows, where people and agents work on the same records and a wrong write is expensive. Those applications already have the logic, the permissions, and the approval steps; what they lack is one way to expose them to agents that behaves the same as the UI, can be inspected, and can be tested. Evaluation, operational visibility, and safe execution may matter more to them than the wire format. No pilot has run yet ([the pilot plan](pilot-plan.md) says how one would), and nothing here shows that such teams will adopt or pay for it; the [roadmap](../ROADMAP.md) lists what would test the hypothesis.

## When you should not use AXE yet

AXE wraps business logic that already works. If any of the following is true, wait.

- **No stable logic to wrap.** If the flow you would expose is still changing weekly, the manifest will churn with it and agents will learn not to trust it. Ship the flow first.
- **A purely informational site.** If agents only need to read your content, `llms.txt` or well-structured HTML serves them better than an action with no follow-up. AXE earns its keep when there is something to do.
- **Flows that must be human end to end.** Some steps are legally required to be performed by the person: certain signatures, attestations, and regulated disclosures. A manifest whose every action is a `needs_human` on the first call is honest but not useful. Expose the read actions around the flow and leave the flow alone.
- **You cannot commit to a secret and HTTPS.** Continuation and resume tokens are signed with a server `secret`, and `baseUrl` must be HTTPS outside localhost. If your deployment cannot keep a secret out of source control and serve TLS, agents will be handed tokens that anyone can forge.

Each of these is a precondition, not a permanent judgment about your site.

## Next steps

- [Getting started](getting-started.md): one read-only action, conformant, in about 15 minutes.
- [Concepts](concepts.md): the manifest, the result envelope, and the escalation ladder.
- [FAQ](faq.md): how AXE relates to MCP, OpenAPI, llms.txt, schema.org, and agent-to-agent protocols.
- [Evaluation](evaluation.md): what the scripted harness measures and what it does not.
- [Audit](audit.md): the AXE Score and the honesty rules in full.
