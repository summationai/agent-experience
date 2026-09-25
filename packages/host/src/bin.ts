/** `axe-host`: the package's own bin, the same as `axe host`. */
import { runHostCli } from "./cli";

runHostCli(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`axe host: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
