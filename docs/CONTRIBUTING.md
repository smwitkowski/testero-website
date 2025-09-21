# Contributing Guide

## Storybook in CI

Our pull request workflow now builds Storybook headlessly so reviewers can explore the component catalogue without running it locally.

### Running Storybook locally

- `npm run storybook` – start Storybook in development mode on port 6006.
- `npm run storybook:verify` – confirm that the `.storybook/` directory exists; CI fails fast with the same command if Storybook has not been bootstrapped yet.
- `npm run storybook:build` – create a production build in `storybook-static/` that matches what CI uploads.

> If you are using pnpm locally, replace `npm run` with `pnpm` when executing the commands above.

### What CI does

1. Detects whether the repo uses npm or pnpm and installs dependencies accordingly.
2. Verifies that `.storybook/` is present. If it is missing, the workflow stops with the message: `Storybook not found: bootstrap it before CI (Task 5).`
3. Runs the headless Storybook build (`storybook build`) and uploads the generated `storybook-static/` directory as an artifact named **storybook-static**.

To download the artifact on a pull request, open the PR → **Checks** tab → select **Storybook CI** → scroll to **Artifacts** → download **storybook-static**. Unzip the archive locally and serve it with any static file server (e.g. `npx http-server storybook-static`).

### Troubleshooting

- **`.storybook` missing:** Run the Task 5 bootstrap (or copy an existing configuration) before re-running CI.
- **Story or MDX build failures:** Run `npm run storybook` locally to inspect the error output and ensure MDX/CSF stories compile without warnings.
- **Broken assets in the static build:** When importing local assets, use paths relative to the `public/` directory or configure `storybook build` with the correct `--static-dir` option.

### Version notes

Storybook v8+ uses the `storybook build` command, which our `storybook:build` script runs today. If you downgrade to Storybook v7, switch the script to `build-storybook -s public -o storybook-static` to maintain CI compatibility.
