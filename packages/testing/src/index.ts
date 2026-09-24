/**
 * @axe/testing: conformance suite, AXE audit, vocabulary drift check, and unit-test
 * helpers for sites built with @axe/core.
 */
export { runConformance, formatConformanceTable } from "./conformance/index";
export type {
  Check,
  CheckStatus,
  ConformanceReport,
  ConformanceOptions,
  Observations,
} from "./conformance/index";
export { REQUIREMENTS } from "./conformance/requirements";
export type { Coverage } from "./conformance/requirements";
export { runAudit, WEIGHTS, graphConnectivity } from "./audit/index";
export type {
  AuditReport,
  AuditCategory,
  AuditCheck,
  AuditFix,
  AuditOptions,
  ParityTarget,
} from "./audit/index";
export { formatAuditTable, formatAuditHtml } from "./audit/format";
export { checkVocabularyDrift, formatDriftReport, inlineCodeSpans, wireLikeNames } from "./drift";
export type { DriftOptions, DriftReport } from "./drift";
export {
  createTestClient,
  invokeAction,
  samplePayload,
  SAMPLE_PAYLOADS,
  WELL_KNOWN_KIND_NAMES,
} from "./helpers";
export type { AxeLike, TestClientOptions } from "./helpers";
