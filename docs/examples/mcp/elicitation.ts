// #region elicitation
import { createMcpServer, serveHttp } from "@axe/mcp";
import { axe } from "../apartments/site";

// Elicitation and the Apps view are on by default and used only with clients that declare them.
// A form waits up to ten minutes for the user; here, five. Sessions are needed over HTTP, because
// the question is a request from the server in the middle of the tool call.
const derived = await createMcpServer(axe, { elicitation: { timeoutMs: 300_000 } });
export const mcpHandler = serveHttp(derived, { sessions: true });

// To keep every result as text (the model relays requirements and handoffs itself):
export const textOnly = await createMcpServer(axe, { elicitation: false, apps: false });
// #endregion elicitation
