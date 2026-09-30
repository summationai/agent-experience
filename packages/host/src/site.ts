/**
 * @summationai/axe-host/site: the site's side of the agent web, for the site's own server. It has no
 * browser dependency: the pages a person opens from an agent's deep link (connect a session,
 * approve an action, type a value) and the calls that report the outcome to the service.
 */
export { agentSiteHandler } from "./agent-site";
export type { AgentSiteIdentity, AgentSiteOptions } from "./agent-site";
