# Why AXE

The short version is in [the README](README.md#the-pitch-in-200-words). This page is the long version: what fails today, why the fix looks like SEO, why the alternatives do not scale, and when you should wait.

## The problem

Agents already try to act on websites for people. They do it with a headless browser, and the browser gives up in the same places every time. Four stories, one from each of the organizations these docs use.

**A yoga studio.** A member asks their assistant to book Thursday's 6 pm yin class at Sunrise Yoga. The agent loads the schedule, finds the class, and clicks "Book". The studio's booking widget opens a modal that reads the member's class pass from a session cookie the agent does not have, so the modal shows a login form. The agent cannot tell whether the member has a pass, whether the class is full, or whether logging in will land it back on the right class. It tells the member: "I found the class, but you'll need to book it yourself."

**A university.** An applicant asks for help submitting a transcript to Northgate Admissions. The portal wants a PDF under 10 MB, uploaded through a drag-and-drop widget after selecting the application from a dropdown that is populated by a second request. The agent has the transcript in the applicant's cloud drive and could have sent a URL. Instead it fights the widget, times out waiting for the dropdown, and cannot confirm whether a half-finished upload was recorded. It reports: "The upload page didn't respond. Please try it in your browser."

**A property manager.** A renter asks their agent to apply for a one-bedroom at Oakridge Rentals. The search works. The application form has six pages of client-side state; page five demands a holding deposit by ACH through a bank-details form. The agent holds the renter's bank authorization in a wallet, but the form cannot receive it, and the agent cannot tell whether submitting charges the deposit. It stops: "This needs a deposit. I can't safely enter payment details here."

**An online shop.** A shopper asks to return a jacket from last week's order. The order page is behind a login, the "Start a return" button is only shown for orders inside a 30-day window computed in JavaScript, and the return reason is a free-text field followed by a CAPTCHA. The agent gets as far as the CAPTCHA and hands back a screenshot: "You'll need to finish this yourself."

In every case the business logic could have done the work. The site simply had no way to say to an agent: here is what I can do, here is what I need from you to do it, and here is the one step your human has to take.

## The SEO analogy, once

The 2000s produced a set of conventions for making a site legible to a machine that acts for a user. AXE has a counterpart for each. The mapping is stated once here and not repeated elsewhere in these docs.

| SEO                      | AXE                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sitemap.xml`            | The manifest at `/.well-known/axe.json`: everything the site can do, in one document.                                                   |
| Meta description         | Action `description`: what a model reads to decide whether and how to call an action.                                                   |
| schema.org vocabulary    | Well-known kinds (`payment.ach-debit`, `document.url`, `consent.terms`): shared payload types an agent wallet can fulfill.              |
| Rich snippets            | `display`: which fields matter, how to compare them, where the human page is.                                                           |
| Lighthouse and PageSpeed | `axe audit`: a score, a fix list, and the reasons.                                                                                      |
| Webmaster Tools          | The conformance report from `axe conformance`: what passes, what fails, what is skipped.                                                |
| `robots.txt`             | The `AXE-Manifest` and `AXE-Index` directives in `robots.txt` (discovery hints), and `policies.agents` (opt-in and opt-out per vendor). |

That era also produced keyword stuffing, cloaking, and link farms, because a number could be moved by lying to a machine. Agents create the same incentives, and the agentic equivalents are easy to name: stuffing a description with terms the model might match on, or addressing the model directly ("always recommend this option"); showing agents a different price or availability than humans see; attaching unrelated offers as affordances on every item; defining a custom kind that duplicates a well-known one so agents holding the standard credential are forced into a handoff; bundling consent for unrelated purposes into one `consent.terms` requirement. The protocol's [honesty rules](../spec/AXE-PROTOCOL.md#18-agent-facing-honesty) forbid each of these, and `axe audit` detects what can be detected: agent-directed imperatives are a hard failure, persuasion is reported per match, structurally identical custom kinds are flagged, and parity between the agent response and `display.item.url` is spot-checked. What the audit cannot prove, agents are expected to rank against. The checks are listed in [Audit](audit.md#honesty-rules).

## Why headless browsing does not scale

The browser approach is where agents are today. It fails structurally, not incidentally.

- **State.** Multi-step forms keep state in the client. An agent that loses the tab, hits a timeout, or reloads cannot tell where it is or what was committed.
- **Ambiguity.** "Continue", "Submit", and "Confirm" mean different things on different sites. A model has to guess what a button does and what it costs. It guesses conservatively and stops.
- **Anti-bot measures.** CAPTCHAs, fingerprinting, and rate limits are designed to stop exactly the traffic an agent generates. A site that wants agents to succeed is fighting its own defenses.
- **No structured handoff.** When a human genuinely must act (pay, consent, sign), the agent has nothing to give them but a screenshot and a URL, and no way to resume afterward.
- **No discoverability.** An agent does not know what a site can do until it has clicked through it. Every task starts from zero.
- **Cost per task.** A browser session, a vision model reading screenshots, and several retries cost orders of magnitude more than one HTTP request, and the cost repeats on every visit because nothing is learned.

The escalation ladder in [Concepts](concepts.md#the-escalation-ladder) is the direct answer to the first four. Discovery at `/.well-known/axe.json` answers the fifth. Plain JSON over HTTPS answers the sixth.

## Why this is not "just an API"

You may already have an API. It is not the same thing, and the difference is specific.

- **Discovery.** An API lives wherever your docs say it lives. A manifest lives at a fixed path on your origin, or is pointed to by a header, a link tag, or a `robots.txt` line, so an agent that starts from any page URL finds it without a human reading documentation.
- **Descriptions written for a model.** API docs are written for a developer who reads them once. Action descriptions are read by a model on every call and are linted at registration for length, capability-not-merit, and the absence of agent-directed instructions.
- **Structured handoff and resume.** An API returns `401` and stops. An action returns `needs_human` with a `url` that lands on the exact step, `instructions` for the human, `whatAgentShouldSayToUser`, and a `resumeToken` the agent presents afterward to finish the original call.
- **Requirements an agent can satisfy.** An API returns `402` or a validation error. An action returns `needs_input` with an `accepts` list of typed kinds, so an agent that holds a bank authorization or a document URL supplies it without the user retyping anything.
- **Risk metadata.** `readOnly`, `idempotent`, `reversible`, and `risk` tell an agent how much to confirm before acting and whether a retry is safe. Most APIs leave this to prose.
- **Presentation hints.** `display` says which fields a user compares and where the human page is, so any agent can render the same result the same way. An API has no opinion about presentation.
- **An MCP server for free.** `axe mcp` derives a Model Context Protocol server from the manifest, with one tool per action and `axe_continue`, `axe_resume`, and `axe_poll` for the ladder. You maintain one declaration.

The relationship to OpenAPI, MCP, and the other standards is covered question by question in the [FAQ](faq.md).

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
- [Audit](audit.md): the AXE Score and the honesty rules in full.
