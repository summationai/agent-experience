// app/.well-known/axe.json/route.ts — the same three handlers, so the manifest
// is served at the well-known path without a rewrite.
// #region all
export { GET, POST, OPTIONS } from "../../axe/[...axe]/route";
// #endregion all
