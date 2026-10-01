/**
 * @summationai/axe-host/site: the site's side of the agent web. It lives in
 * `@summationai/axe-core/agent-site`, which an application's server installs without the host's
 * browser dependencies; this entry re-exports it.
 */
export { agentSiteHandler } from "@summationai/axe-core/agent-site";
export type { AgentSiteIdentity, AgentSiteOptions } from "@summationai/axe-core/agent-site";
