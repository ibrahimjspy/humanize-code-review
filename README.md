# GitHub PR Review Helper

A Manifest V3 Chrome extension that reduces GitHub pull request review noise by hiding low-signal files and showing review-focused metrics.

## MVP Features

- Auto-hides test files, snapshots, mocks, and common lock files.
- Keeps `package.json` visible and reports dependency diff counts when GitHub has the file diff loaded.
- Injects a sticky PR review summary panel on GitHub pull request pages.
- Counts business logic files and lines under configured source paths.
- Calculates a complexity label from business file count and changed LOC.
- Flags database, API contract, and auth-related changes from configurable keywords.
- Provides quick actions to show hidden files, show tests only, show business logic only, and refresh analysis.
- Stores settings in `chrome.storage.sync`.

## Develop

```sh
npm install
npm run check
```

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the generated `dist` folder.
6. Open a GitHub pull request page under `https://github.com/*/*/pull/*`.

## Settings

Use the extension popup or Chrome extension details page to open Options. You can edit:

- Hidden file patterns.
- Business logic paths.
- Ignored paths.
- Risk keyword JSON.
