# Review of 2026-09-24: implementation checklist

The engineering and product review of branch `herz/surface-integration` at `e5630fd` listed eighteen items in four phases. This directory is the repository-local checklist the review asked for: one file per item, each recording the finding as verified in this checkout, what changed (files, APIs, spec rule ids), the tests that pin it, and the limitations that remain. A subsequent task should be able to continue from these files without the review text.

| # | Item | Phase | File | Status |
| --- | --- | --- | --- | --- |
| 1 | Tenant and principal binding for every token endpoint | 1 | [01-token-binding.md](01-token-binding.md) | pending |
| 2 | Atomic idempotency and token consumption; operation lifecycle | 1 | [02-operation-lifecycle.md](02-operation-lifecycle.md) | pending |
| 3 | Client credentials and network destinations bound to trust boundaries | 1 | [03-client-trust.md](03-client-trust.md) | done |
| 4 | Terminal poll results authorized before return | 1 | [04-poll-authorization.md](04-poll-authorization.md) | pending |
| 5 | Authorization and privacy boundary for the Surface bridge | 1 | [05-surface-authorization.md](05-surface-authorization.md) | pending |
| 6 | Cookie-authenticated integration with CSRF protection | 1 | [06-csrf.md](06-csrf.md) | done |
| 7 | Site-key principals resolved consistently | 1 | [07-site-principals.md](07-site-principals.md) | pending |
| 8 | State preconditions meaningful at the write boundary | 1 | [08-write-preconditions.md](08-write-preconditions.md) | done |
| 9 | MCP HTTP lifecycle and request identity | 2 | [09-mcp-http.md](09-mcp-http.md) | pending |
| 10 | Remote capability freshness and stable retries | 2 | [10-mcp-freshness.md](10-mcp-freshness.md) | pending |
| 11 | Mounted React behavior | 2 | [11-react-lifecycle.md](11-react-lifecycle.md) | pending |
| 12 | Resource limits, schema boundaries, retention | 2 | [12-limits-and-schema.md](12-limits-and-schema.md) | pending |
| 13 | Browser-local and server-side execution as explicit modes; reference app | 3 | [13-execution-modes.md](13-execution-modes.md) | pending |
| 14 | Existing agent interfaces through adapters (WebMCP, elicitation, MCP Apps) | 3 | [14-agent-interface-adapters.md](14-agent-interface-adapters.md) | pending |
| 15 | Human oversight in the reference workflow | 3 | [15-human-oversight.md](15-human-oversight.md) | pending |
| 16 | Capability granularity evaluated | 4 | [16-granularity.md](16-granularity.md) | pending |
| 17 | Evaluation harness and external pilot plan | 4 | [17-evaluation.md](17-evaluation.md) | pending |
| 18 | Audit claims clarified; roadmap prioritized | 4 | [18-claims-and-roadmap.md](18-claims-and-roadmap.md) | pending |

Each item file follows one shape: **Finding** (what the review said and what this checkout showed on reproduction), **Change** (files, public API, spec rule ids, migration), **Tests** (names, what they fail on without the change), **Limitations** (what is still not guaranteed), **Status**.
