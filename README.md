# Play Console Utils

A Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)) that adds small productivity utilities and shortcuts to the [Google Play Console](https://play.google.com/console/).

## Features

- ⚡ **Quick reply (Ctrl/Cmd + Enter by default)** — While focused in a reply textarea/editable field, press the configured shortcut to automatically find and click the "Publish reply" button (supports English and Spanish button labels), with a brief visual confirmation flash. If the review is in a different language, the reply is first translated to match it using Chrome's built-in on-device translation (toggle in Options; falls back to publishing as typed if unsupported or unavailable).
- 📝 **Canned reply templates (Ctrl/Cmd + K by default)** — While focused in a reply field, press the configured shortcut to open a floating picker of your saved reply templates (click a row, or press its number). Templates can include `{author}`, `{date}`, and `{app}` placeholders, filled in from the review you're replying to. Manage the template list from the Options page.
- ↕️ **Review navigation (Alt + ↓ / Alt + ↑, Alt + → / Alt + ← by default)** — Jump to the next/previous review in the list without touching the mouse. The review you land on is scrolled to, highlighted, and its reply box focused so you can start typing (or use Quick reply/Canned reply) immediately. Alt + → / Alt + ← page through the review list itself (clicking Play Console's own pagination controls). Either way, if you're leaving behind an unpublished draft, it's discarded automatically instead of being left stranded.
- 🔍 **Parse review (Alt + Click by default)** — Click a review's text while holding the configured modifier(s) to copy a structured JSON snippet to the clipboard containing the author name, date, app slug, review content, and avatar image URL. Shows a toast notification confirming the copy.
- ☁️ **Settings sync across devices** — Shortcuts, the auto-translate toggle, app slug mappings, and canned reply templates are all stored via Chrome sync, so they follow you to any other Chrome profile you're signed into.
- 📑 **Saved shortcuts (bookmarks)** — While on a Play Console page, bookmark it from the popup under a name of your choice for one-click access later. Saved shortcuts show up in the popup on every page, Play Console or not, and sync across devices alongside your other settings.
- 🛠️ **Fully customizable** — All features, including app slugs, keyboard shortcuts, and canned replies, can be configured to suit your workflow.

## Installation

[![Available in the Chrome web store](https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png)](https://chromewebstore.google.com/detail/play-console-utils/nmhdlfiiadbnjnclabgonbapkmhkahkn)

Or install the extension manually following these steps:

1. Download the latest release from [GitHub](https://github.com/visnalize/play-console-utils/releases).
2. Unzip the downloaded file.
3. Open Chrome and go to `chrome://extensions`.
4. Enable "Developer mode" (top right).
5. Click "Load unpacked" and select the unzipped folder.

## Development

Requires [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev          # Chrome dev build with hot reload, in .output/chrome-mv3-dev
pnpm dev:firefox  # Firefox dev build
```

Load the unpacked extension from `.output/chrome-mv3-dev` (`chrome://extensions` → Developer mode → Load unpacked).

The popup and options pages are Vue, styled with [Tailwind CSS](https://tailwindcss.com) v4 + [daisyUI](https://daisyui.com) 5 through the shared `assets/ui.css` (configured entirely in CSS — there's no `tailwind.config.js`). The content script keeps its own plain stylesheet so Tailwind's preflight can't leak into Play Console's page.

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

The `docs/` folder is a [VitePress](https://vitepress.dev) site — home page, privacy policy, and changelog — published to `https://pcu.visnalize.com`.

All SEO metadata is generated in [`docs/.vitepress/config.ts`](docs/.vitepress/config.ts): static tags (favicon, `theme-color`, keywords, Open Graph image, Twitter card) in `head`, and per-page `canonical`/`og:url`/`og:title`/`og:description` plus the home page's `SoftwareApplication` JSON-LD in `transformPageData`. `sitemap.xml` is emitted by VitePress from the `sitemap.hostname` option, and `docs/public/robots.txt` points at it. Page titles and descriptions come from each page's frontmatter `title`/`description` — add both when adding a page. The social preview image (`docs/public/og.png`, 1200×630) is rendered from [`store-listing/og-1200x630.html`](store-listing/og-1200x630.html) with headless Chrome:

```sh
# run from the repo root — Chrome needs an absolute file:// URL, not a relative path
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars \
  --window-size=1200,630 --force-device-scale-factor=1 \
  --screenshot=docs/public/og.png "file://$PWD/store-listing/og-1200x630.html"
```

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

[`scripts/release.mjs`](scripts/release.mjs) bumps `package.json`'s `version`, commits it, tags it (`v<version>`), and pushes the commit + tag to `origin/main` (after confirming you're on `main`, the working tree is clean, and `main` is up to date with `origin/main`). Pushing the tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which type-checks, lints, and tests the project, builds & zips both the Chrome and Firefox extensions, and publishes them as assets on a GitHub Release (notes generated from the commit log since the last tag — this repo commits straight to `main` rather than through PRs, so GitHub's PR-based release-notes generator would otherwise come up empty). It then commits the changelog update to `docs/changelog.md` on `main` and **moves the release tag onto that commit**, so the tag/release actually contains the changelog change instead of pointing one commit behind it.

That changelog commit is pushed with the default `GITHUB_TOKEN`, whose pushes don't trigger other workflows' `push` triggers — so [`deploy-docs.yml`](.github/workflows/deploy-docs.yml)'s path filter on `docs/**` never fires for it. Instead, `deploy-docs.yml` also listens for `release.yml` to finish via a `workflow_run` trigger and redeploys the docs site then (skipped if the release run failed).

`package.json`'s `version` is the single source of truth for the extension version — `wxt.config.ts` intentionally has no `version` field, so the built manifest always reflects it.
