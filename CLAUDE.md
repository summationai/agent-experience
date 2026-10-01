@AGENTS.md

## The entry point we design for

A developer finds this package from the first lines of the README, or from a post, and asks their coding agent something like:

> hey, can you add this to our admin app (js/apps/admin-app)? https://github.com/summationai/agent-experience — it's the Body Spray SDK, @summationai/axe on npm. supposed to make our app work with AI agents

That is the whole request. The developer may be inexperienced, has no context on this repository, and won't say "run `surface init`", "use the agent web", or "wire `identify`". Treat it as the standard:

- **From that message alone, a coding agent reaches a working integration.** It finds the CLI and the integration prompt (`npx @summationai/axe surface prompt`), runs `surface init --agent-web`, finishes the parts only the application can supply (`identify`, `session`, `loginUrl`, the profile's sign-in state), and verifies the result: typecheck, tests, and the `/agent` checks.
- **It works when the agent cannot run the CLI.** An agent's permissions may refuse downloaded code (`npx`); it then needs one clear next step, such as asking the person to run a single command, not a reconstruction of the generator from the package's source.
- **The first lines a developer or agent reads point there.** The README, each package's README, and `--help` lead with installing Surface, not with the hand-written `createAXE` API.
- **No step depends on knowledge from this repository's history.** A manual step `init` prints, or one the agent has to guess, is a gap in the CLI, the generated files, or the prompt, not the integrator's job.
- **Falling short is a bug in the package:** an agent that stops at `yarn add`, writes sample actions by hand, edits code the integration does not need, or leaves the app without the agent web.

To check a change against it, run that message in a fresh agent with no context, in a fresh checkout of a real application, with this branch's build installed from a local registry (Verdaccio, the `@summationai` scope pointed at it). Then read its report: where it found its instructions, what it could not finish, and what slowed it down.
