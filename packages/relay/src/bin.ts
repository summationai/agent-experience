/** `axe-relay`: the package's own bin, the same as `axe relay`. */
import { runRelayCli } from "./cli";

runRelayCli(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`axe relay: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
