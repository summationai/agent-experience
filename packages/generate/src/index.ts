/**
 * @axe/generate: derive AXE actions from definitions an application already has.
 *
 * ```ts
 * import { fromOpenAPI, generate, registerGenerated } from "@axe/generate";
 *
 * const generated = generate([fromOpenAPI(document, { baseUrl: "https://api.example" })], {
 *   overrides: { "orders.get": { description: "..." } },
 * });
 * registerGenerated(axe, generated);
 * ```
 *
 * The generator fills in what a definition states and refuses to invent what it does not: an
 * operation without a description is left out with a warning, not given one.
 */
export { generate, registerGenerated, formatWarnings } from "./generate";
export type {
  ActionOverride,
  ActionSource,
  GeneratedAction,
  GeneratedSpec,
  GenerateOptions,
  GeneratePolicy,
  GenerateResult,
  GenerateWarning,
  GenerateWarningCode,
  NamePattern,
  Provenance,
  SourceOutput,
} from "./types";
export {
  fromOpenAPI,
  actionNameFromOperationId,
  derivedActionName,
  errorCodeForStatus,
  wordTokens,
} from "./openapi";
export type {
  HttpMethod,
  OpenAPIAuthOptions,
  OpenAPIDocument,
  OpenAPIMediaType,
  OpenAPIOperation,
  OpenAPIOptions,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISecurityRequirement,
  OpenAPISecurityScheme,
} from "./openapi";
export { fromFunctions, fromTRPCRouter } from "./functions";
export type {
  FunctionEntry,
  FunctionTable,
  FunctionsOptions,
  TRPCOptions,
  TRPCProcedureLike,
  TRPCProcedureMeta,
  TRPCRouterLike,
} from "./functions";
export { jsonSchemaToZod, resolveLocalRef } from "./json-schema-to-zod";
export type { JsonSchemaToZodOptions, JsonSchemaToZodResult } from "./json-schema-to-zod";
