# Play Console Utils

A Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)) that adds small productivity shortcuts to the [Google Play Console](https://play.google.com/console/) review section.

## Features

- **Quick reply (Ctrl/Cmd + Enter by default)** — While focused in a reply textarea/editable field, press the configured shortcut to automatically find and click the "Publish reply" button (supports English and Spanish button labels), with a brief visual confirmation flash. If the review is in a different language, the reply is first translated to match it using Chrome's built-in on-device translation (toggle in Options; falls back to publishing as typed if unsupported or unavailable).
- **Parse review (Alt + Click by default)** — Click a review's text while holding the configured modifier(s) to copy a structured JSON snippet to the clipboard containing the author name, date, app slug, review content, and avatar image URL. Shows a toast notification confirming the copy.
- **Configurable app slugs (Options page)** — Map each Play Console app label to your own slug, used in the JSON copied by the Parse review feature. Apps without a configured mapping fall back to an auto-generated slug.
- **Configurable shortcuts (Options page)** — Change the quick-reply key combo (click "Record" and press your combo) and the parse-review click modifier(s), independent of the app slug mapping. Changes apply immediately, no reload needed.
- **Active-state toolbar icon** — The toolbar icon is grayscale by default and switches to the full-color icon on tabs where the Play Console features are active (`https://play.google.com/console/*`).
- **Popup** — Click the toolbar icon for quick links to the Options page and the [documentation site](https://pcu.visnalize.com); on non-Play-Console tabs it shows a short reminder that the extension only works there.

## Development

Requires [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev          # Chrome dev build with hot reload, in .output/chrome-mv3-dev
pnpm dev:firefox  # Firefox dev build
```

Load the unpacked extension from `.output/chrome-mv3-dev` (`chrome://extensions` → Developer mode → Load unpacked).

## Configuring app slugs & shortcuts

Click the extension icon → **Options** in the popup (or right-click the icon → **Options**, or `chrome://extensions` → Play Console Utils → Details → Extension options).

- **App slugs**: add a row per app — the label as shown in Play Console's active-app selector, and the slug you want in the copied JSON.
- **Shortcuts**: click the quick-reply combo button and press your desired key combo (Esc cancels); check/uncheck modifiers for the parse-review click trigger (at least one must stay selected); toggle auto-translate for quick replies. All save automatically.

## Building & packaging

```sh
pnpm build        # production build, in .output/chrome-mv3
pnpm zip          # zips .output/chrome-mv3 for Chrome Web Store upload
```

## Other scripts

```sh
pnpm compile      # type-check with vue-tsc
pnpm lint         # eslint
pnpm format       # prettier --write
pnpm test         # vitest
```

## Docs & privacy policy site

The `docs/` folder is a [VitePress](https://vitepress.dev) site (currently just the privacy policy, at `docs/privacy/index.md`) published to `https://pcu.visnalize.com`.

```sh
pnpm docs:dev      # local dev server with hot reload
pnpm docs:build    # build static site to docs/.vitepress/dist
pnpm docs:preview  # preview the production build locally
```

Pushing changes under `docs/` to `main` triggers [`.github/workflows/deploy-docs.yml`](.github/workflows/deploy-docs.yml), which builds the site and deploys it to GitHub Pages.

## Releasing

```sh
pnpm release          # prompts for the version
pnpm release 1.2.0    # or pass it directly
```

[`scripts/release.mjs`](scripts/release.mjs) bumps `package.json`'s `version`, commits it, tags it (`v<version>`), and pushes the commit + tag to `origin/main` (after confirming you're on `main`, the working tree is clean, and `main` is up to date with `origin/main`). Pushing the tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which type-checks, lints, and tests the project, builds & zips both the Chrome and Firefox extensions, publishes them as assets on a GitHub Release (auto-generated release notes from commits/PRs since the last tag), and commits an update to `docs/changelog.md`.

`package.json`'s `version` is the single source of truth for the extension version — `wxt.config.ts` intentionally has no `version` field, so the built manifest always reflects it.
