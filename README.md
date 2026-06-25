# GitHub PR Review Helper

A small Manifest V3 Chrome extension for engineers reviewing large GitHub pull requests.

It reduces review noise by hiding low-signal files, keeping business logic visible, and showing a quick summary before you start reading the diff.

## Why

Large pull requests often mix production code with test snapshots, generated files, package locks, and dependency churn. That makes it harder to answer the important review questions first:

- What business logic changed?
- How large is the real code change?
- Did this touch auth, APIs, or database migrations?
- Are package dependencies involved?
- Can I temporarily hide tests and lock files while reviewing behavior?

This extension gives reviewers those signals directly on GitHub PR pages.

## Features

- Automatically hides common test files, snapshots, mocks, and lock files.
- Keeps `package.json` visible so dependency changes are still reviewable.
- Adds a sticky PR summary panel on GitHub pull request pages.
- Counts business logic files and changed lines under configurable source paths.
- Calculates a complexity score: `Small`, `Medium`, `Large`, or `Massive`.
- Flags database, API contract, and auth-related changes from configurable keywords.
- Adds quick filter actions: show hidden files, show tests only, show business logic only, and refresh analysis.
- Stores preferences in `chrome.storage.sync` so settings can sync across browsers.

## Screenshot

Coming soon.

## Install From Source

Requirements:

- Node.js 20 or newer
- npm
- Chrome or another Chromium-based browser

Build the extension:

```sh
npm install
npm run build
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the generated `dist` folder.
5. Open a GitHub pull request under `https://github.com/*/*/pull/*`.

## Development

Run all validation:

```sh
npm run check
```

Build only:

```sh
npm run build
```

Type-check only:

```sh
npm run typecheck
```

The build script bundles TypeScript with esbuild and writes the unpacked extension to `dist/`.

## Project Structure

```text
manifest.json
scripts/
  build.mjs
src/
  background.ts
  content/
    github-pr.ts
  options/
    options.html
    options.ts
  popup/
    popup.html
    popup.ts
  shared/
    analyzer.ts
    settings.ts
```

Key files:

- `src/content/github-pr.ts` injects the GitHub PR panel, observes GitHub SPA updates, hides files, and wires filter actions.
- `src/shared/analyzer.ts` classifies changed files, computes business/test metrics, complexity, dependency summaries, and risk indicators.
- `src/shared/settings.ts` defines defaults and reads/writes settings through `chrome.storage.sync`.
- `src/options/options.ts` powers the extension settings page.

## Default Rules

Hidden by default:

```text
*.test.ts
*.test.tsx
*.spec.ts
*.spec.tsx
*.test.js
*.spec.js
__tests__/**
__mocks__/**
*.snap
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lockb
```

Business logic paths:

```text
src/
apps/
libs/
services/
packages/
```

Ignored paths:

```text
tests/
__tests__/
coverage/
dist/
build/
```

Risk groups:

- Database: migrations, TypeORM migrations, Prisma migrations, `schema.sql`
- API contract: GraphQL, schemas, DTOs, OpenAPI, Swagger, proto files, interfaces
- Auth: guards, JWT, auth, permissions, roles, RBAC

## Configuration

Open the extension popup and click Open Settings. You can edit:

- Hidden file patterns
- Business logic paths
- Ignored paths
- Risk keyword JSON

Settings are stored with `chrome.storage.sync`.

## Current Limitations

- GitHub changes its DOM often, so file detection may need maintenance over time.
- Dependency analysis works best when the `package.json` diff is expanded and visible.
- The extension uses file paths and visible diff content; it does not call GitHub APIs.
- Generated `dist/` output is intentionally not committed.

## Roadmap

- Add screenshots and demo GIFs.
- Add browser-based tests for analyzer behavior.
- Support shared repository config from `.github/pr-review-helper.json`.
- Add review time estimates.
- Add richer AI-assisted review focus hints.

## Contributing

Issues and pull requests are welcome. Please keep changes small, focused, and easy to review.

Before opening a PR:

```sh
npm run check
```

When changing GitHub DOM logic, include a short note about which GitHub PR page layout you tested.

## License

No license has been added yet. Add one before publishing the repository publicly.
