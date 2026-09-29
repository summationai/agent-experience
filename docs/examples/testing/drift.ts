/**
 * Run the vocabulary drift check in a repository that extends the protocol with its own
 * vocabulary table, for example a fork that adds custom kinds and documents them.
 */
import { checkVocabularyDrift, formatDriftReport } from "@summationai/axe-testing";

// #region drift
const report = checkVocabularyDrift({
  // Must contain spec/VOCABULARY.md, docs/, packages/, and README.md.
  root: process.cwd(),
  // Markdown to scan for inline code spans. docs/api is always skipped.
  docPaths: ["spec", "docs", "README.md"],
  // Tokens that look like wire names but are legitimately not vocabulary.
  allowlistPath: "spec/drift-allowlist.json",
  // The check fails once the allowlist reaches this size; keep it a short list of exceptions.
  maxAllowlist: 15,
});

console.log(formatDriftReport(report));
for (const [token, files] of Object.entries(report.unknown)) {
  console.error(`"${token}" is not in spec/VOCABULARY.md (${files.join(", ")})`);
}
process.exitCode = report.ok ? 0 : 1;
// #endregion drift
