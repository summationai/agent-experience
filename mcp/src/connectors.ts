import { readFileSync } from "node:fs";
import type { SessionFor } from "@axe/host";

/**
 * Trusted bootstrap configuration for one application. Runtime controls and application-specific
 * behavior do not belong here; they come from the application's Surface.
 */
export interface ConnectorDescriptor {
  id: string;
  displayName: string;
  aliases: string[];
  description?: string;
  appUrl: string;
  startPath?: string;
  allowedOrigins: string[];
  /** The id the application's Surface profile must report. Default: `id`. */
  surfaceId: string;
  identity: {
    principalClaim: string;
    contextClaim: string;
    defaultContext?: string;
  };
  session: {
    strategy: "broker" | "none";
    brokerUrl?: string;
    brokerAuth?: "service" | "caller";
    /** Environment variable containing the provider credential; never sent to the page. */
    brokerTokenEnv?: string;
  };
}

export interface RegisteredConnector extends ConnectorDescriptor {
  sessionFor?: SessionFor;
}

export interface ConnectorSummary {
  id: string;
  displayName: string;
  aliases: string[];
  description?: string;
}

export interface ConnectorRegistry {
  readonly defaultId: string | null;
  list(): ConnectorSummary[];
  get(id: string): RegisteredConnector | undefined;
  search(query?: string): ConnectorSummary[];
}

interface ConnectorFile {
  default?: string;
  connectors?: unknown;
}

const CONNECTOR_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function httpUrl(value: unknown, where: string): string {
  if (typeof value !== "string") throw new Error(`${where} must be an absolute http(s) URL.`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${where} must be an absolute http(s) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new Error(`${where} must be an absolute http(s) URL.`);
  return parsed.href;
}

function strings(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()))
    throw new Error(`${where} must be an array of non-empty strings.`);
  return value.map((item) => (item as string).trim());
}

function descriptor(value: unknown, index: number): ConnectorDescriptor {
  const where = `connectors[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${where} must be an object.`);
  const input = value as Record<string, unknown>;
  const id = typeof input["id"] === "string" ? input["id"].trim() : "";
  if (!CONNECTOR_ID.test(id) || id.length > 80)
    throw new Error(`${where}.id must be a stable lowercase connector id.`);
  const displayName = typeof input["displayName"] === "string" ? input["displayName"].trim() : "";
  if (!displayName || displayName.length > 120)
    throw new Error(`${where}.displayName must be between 1 and 120 characters.`);
  const appUrl = httpUrl(input["appUrl"], `${where}.appUrl`);
  const allowedOrigins = strings(input["allowedOrigins"], `${where}.allowedOrigins`);
  const appOrigin = new URL(appUrl).origin;
  if (!allowedOrigins.includes(appOrigin)) allowedOrigins.unshift(appOrigin);
  const surfaceId =
    typeof input["surfaceId"] === "string" && input["surfaceId"].trim()
      ? input["surfaceId"].trim()
      : id;
  if (!CONNECTOR_ID.test(surfaceId) || surfaceId.length > 80)
    throw new Error(`${where}.surfaceId must be a stable lowercase Surface id.`);

  const identityInput =
    input["identity"] && typeof input["identity"] === "object" && !Array.isArray(input["identity"])
      ? (input["identity"] as Record<string, unknown>)
      : {};
  const sessionInput =
    input["session"] && typeof input["session"] === "object" && !Array.isArray(input["session"])
      ? (input["session"] as Record<string, unknown>)
      : {};
  const strategy = sessionInput["strategy"] ?? "broker";
  if (strategy !== "broker" && strategy !== "none")
    throw new Error(`${where}.session.strategy must be "broker" or "none".`);
  const brokerAuth = sessionInput["brokerAuth"] ?? "service";
  if (brokerAuth !== "service" && brokerAuth !== "caller")
    throw new Error(`${where}.session.brokerAuth must be "service" or "caller".`);
  const session: ConnectorDescriptor["session"] = { strategy };
  if (strategy === "broker") {
    session.brokerUrl = httpUrl(sessionInput["brokerUrl"], `${where}.session.brokerUrl`);
    session.brokerAuth = brokerAuth;
    if (sessionInput["brokerTokenEnv"] !== undefined) {
      if (
        typeof sessionInput["brokerTokenEnv"] !== "string" ||
        !/^[A-Z][A-Z0-9_]*$/.test(sessionInput["brokerTokenEnv"])
      )
        throw new Error(`${where}.session.brokerTokenEnv must name an environment variable.`);
      session.brokerTokenEnv = sessionInput["brokerTokenEnv"];
    }
    if (brokerAuth === "service" && !session.brokerTokenEnv)
      throw new Error(`${where}.session.brokerTokenEnv is required for service broker auth.`);
  }

  const startPath = typeof input["startPath"] === "string" ? input["startPath"].trim() : "";
  if (startPath && new URL(startPath, appUrl).origin !== appOrigin)
    throw new Error(`${where}.startPath must stay on appUrl's origin.`);
  const description =
    typeof input["description"] === "string" && input["description"].trim()
      ? input["description"].trim()
      : undefined;
  if (description && description.length > 500)
    throw new Error(`${where}.description must be at most 500 characters.`);
  const defaultContext =
    typeof identityInput["defaultContext"] === "string" && identityInput["defaultContext"].trim()
      ? identityInput["defaultContext"].trim()
      : undefined;
  return {
    id,
    displayName,
    aliases: strings(input["aliases"], `${where}.aliases`),
    ...(description ? { description } : {}),
    appUrl,
    ...(startPath ? { startPath } : {}),
    allowedOrigins,
    surfaceId,
    identity: {
      principalClaim:
        typeof identityInput["principalClaim"] === "string" &&
        identityInput["principalClaim"].trim()
          ? identityInput["principalClaim"].trim()
          : "sub",
      contextClaim:
        typeof identityInput["contextClaim"] === "string" && identityInput["contextClaim"].trim()
          ? identityInput["contextClaim"].trim()
          : "org",
      ...(defaultContext ? { defaultContext } : {}),
    },
    session,
  };
}

export function createConnectorRegistry(
  connectors: RegisteredConnector[],
  options: { defaultId?: string | null } = {},
): ConnectorRegistry {
  const byId = new Map<string, RegisteredConnector>();
  const aliasOwner = new Map<string, string>();
  for (const [index, connector] of connectors.entries()) {
    const where = `connectors[${index}]`;
    if (!CONNECTOR_ID.test(connector.id) || connector.id.length > 80)
      throw new Error(`${where}.id must be a stable lowercase connector id.`);
    if (!connector.displayName?.trim() || connector.displayName.length > 120)
      throw new Error(`${where}.displayName must be between 1 and 120 characters.`);
    if (!Array.isArray(connector.aliases) || connector.aliases.some((alias) => !alias.trim()))
      throw new Error(`${where}.aliases must contain non-empty strings.`);
    httpUrl(connector.appUrl, `${where}.appUrl`);
    if (!Array.isArray(connector.allowedOrigins))
      throw new Error(`${where}.allowedOrigins must be an array.`);
    if (!CONNECTOR_ID.test(connector.surfaceId) || connector.surfaceId.length > 80)
      throw new Error(`${where}.surfaceId must be a stable lowercase Surface id.`);
    if (!connector.identity?.principalClaim?.trim() || !connector.identity.contextClaim?.trim())
      throw new Error(`${where}.identity must name principalClaim and contextClaim.`);
    if (!connector.session || !["broker", "none"].includes(connector.session.strategy))
      throw new Error(`${where}.session.strategy must be "broker" or "none".`);
    if (byId.has(connector.id)) throw new Error(`Duplicate connector id: ${connector.id}.`);
    byId.set(connector.id, connector);
    for (const raw of [connector.id, connector.displayName, ...connector.aliases]) {
      const alias = raw.trim().toLowerCase();
      const owner = aliasOwner.get(alias);
      if (owner && owner !== connector.id)
        throw new Error(
          `Connector alias ${JSON.stringify(raw)} belongs to both ${owner} and ${connector.id}.`,
        );
      aliasOwner.set(alias, connector.id);
    }
  }
  const requestedDefault =
    options.defaultId ?? (connectors.length === 1 ? connectors[0]!.id : null);
  if (requestedDefault && !byId.has(requestedDefault))
    throw new Error(`Unknown default connector: ${requestedDefault}.`);
  const summary = (connector: RegisteredConnector): ConnectorSummary => ({
    id: connector.id,
    displayName: connector.displayName,
    aliases: [...connector.aliases],
    ...(connector.description ? { description: connector.description } : {}),
  });
  return {
    defaultId: requestedDefault,
    list: () => connectors.map(summary),
    get: (id) => byId.get(id),
    search(query = "") {
      const q = query.trim().toLowerCase();
      if (!q) return connectors.map(summary);
      const exact = aliasOwner.get(q);
      if (exact) return [summary(byId.get(exact)!)];
      return connectors
        .filter((connector) =>
          [connector.id, connector.displayName, ...connector.aliases, connector.description ?? ""]
            .join("\n")
            .toLowerCase()
            .includes(q),
        )
        .map(summary);
    },
  };
}

/** Load trusted connector descriptors. Secrets are referenced by environment-variable name. */
export function connectorRegistryFromFile(
  path: string,
  env: Record<string, string | undefined> = process.env,
  sessionFactory?: (connector: ConnectorDescriptor, token: string | undefined) => SessionFor,
): ConnectorRegistry {
  let parsed: ConnectorFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as ConnectorFile;
  } catch (error) {
    throw new Error(
      `Could not read connector registry ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed.connectors) || parsed.connectors.length === 0)
    throw new Error("Connector registry must contain a non-empty connectors array.");
  const connectors = parsed.connectors.map(descriptor).map((connector) => {
    if (connector.session.strategy === "none" || !sessionFactory) return connector;
    const token = connector.session.brokerTokenEnv
      ? env[connector.session.brokerTokenEnv]?.trim()
      : undefined;
    if (connector.session.brokerAuth === "service" && !token)
      throw new Error(
        `${connector.session.brokerTokenEnv} is required by connector ${connector.id}.`,
      );
    return { ...connector, sessionFor: sessionFactory(connector, token) };
  });
  return createConnectorRegistry(connectors, { defaultId: parsed.default ?? null });
}
