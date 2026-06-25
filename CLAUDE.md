# CLAUDE.md

Guidance for AI assistants and contributors working in this repository.

## Project Overview

This is a Manifest V3 Chrome extension that helps engineers review large GitHub pull requests by hiding low-signal files and surfacing review metrics.

The extension runs only on GitHub PR URLs matching:

```text
https://github.com/*/*/pull/*
```

Core behavior:

- Hide test files, snapshots, mocks, and lock files by default.
- Keep `package.json` visible.
- Inject a floating PR review summary panel.
- Count business logic files and LOC.
- Calculate complexity from business files and changed lines.
- Flag database, API contract, and auth-related risk indicators.
- Store user settings in `chrome.storage.sync`.

## Commands

Install dependencies:

```sh
npm install
```

Run all checks:

```sh
npm run check
```

Type-check:

```sh
npm run typecheck
```

Build the unpacked extension:

```sh
npm run build
```

The build output goes to `dist/`.

## Repository Layout

```text
manifest.json
scripts/build.mjs
src/background.ts
src/content/github-pr.ts
src/options/options.html
src/options/options.ts
src/popup/popup.html
src/popup/popup.ts
src/shared/analyzer.ts
src/shared/settings.ts
```

Important modules:

- `src/content/github-pr.ts` handles GitHub DOM detection, MutationObserver refreshes, file visibility, and panel rendering.
- `src/shared/analyzer.ts` contains pure classification and analysis logic.
- `src/shared/settings.ts` owns default settings and Chrome storage persistence.
- `src/options/options.ts` validates and saves editable settings.

## Development Rules

- Keep `src/shared/analyzer.ts` as pure as practical. Do not add DOM or Chrome API dependencies there.
- Keep GitHub DOM selectors localized to `src/content/github-pr.ts`.
- Do not commit `node_modules/` or `dist/`.
- Prefer small, focused changes. Avoid unrelated refactors.
- Use TypeScript strictness instead of broad `any` types.
- Keep extension permissions minimal. Do not add host permissions beyond what a feature needs.
- Do not introduce network calls unless the feature explicitly requires them.
- Preserve `package.json` visibility even when lock files are hidden.

## Validation Expectations

Run this before committing code changes:

```sh
npm run check
```

For docs-only changes, a build is usually not required, but it is safe to run `npm run check` if behavior or examples changed.

When changing GitHub PR DOM behavior, manually test on a real PR Files changed page and note any layout assumptions.

## Open Source Notes

- Add a license before publishing publicly.
- Add screenshots or demo GIFs when the UI stabilizes.
- Keep README instructions current when commands, paths, or extension loading steps change.
