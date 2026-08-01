# Play Console Utils

A Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)) that adds small productivity utilities and shortcuts to the [Google Play Console](https://play.google.com/console/).

## Features

Every shortcut below is the default and can be rebound from the Options page.

- ⚡ **Quick reply** (Ctrl/Cmd + Enter) — Publish a reply without leaving the keyboard. If the review is in another language, the reply is translated to match it first, using Chrome's built-in on-device translation (toggleable in Options; publishes as typed if unavailable).
- 📝 **Canned reply templates** (Ctrl/Cmd + K) — Open a floating picker of your saved templates and choose one with a number key. Templates support `{author}`, `{date}` and `{app}` placeholders, filled in from the review you're replying to.
- ↕️ **Review navigation** (Alt + ↓/↑, Alt + →/←) — Jump between reviews, or page through the list. The review you land on is scrolled to, highlighted, and its reply box focused; any unpublished draft you leave behind is discarded rather than stranded.
- 🌍 **PPP pricing** — Open a price editor, then "Open PPP pricing panel" from the popup. Type one base price and see it converted for every market at [purchasing power parity](https://data.worldbank.org/indicator/PA.NUS.PPP) — each row alongside what you charge there today and the percentage change, with a toggle to re-express the list in your base currency. Fill every row in one pass, with progress and a Stop button. Base country, rounding (charm `.99`/`.90`, nice numbers, or exact), a custom factor for sitting above or below parity, and the overwrite toggle all live in the panel. World Bank data for 200+ countries ships with the extension, so nothing is fetched at runtime, and filling drives Play Console's own editor — nothing is saved until you press Save on the page.
- 🔍 **Parse review** (Alt + Click) — Click a review's text to copy it as JSON: author, date, app slug, content, and avatar URL.
- 📑 **Saved shortcuts** — Bookmark any Play Console page from the popup and jump back to it in one click, from anywhere.
- ☁️ **Synced settings** — Shortcuts, app slug mappings, templates and bookmarks travel with your Chrome profile.

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
pnpm ppp:refresh  # regenerate utils/ppp-data.ts from the World Bank API
```

`pnpm ppp:refresh` runs [`scripts/fetch-ppp.mjs`](scripts/fetch-ppp.mjs), which pulls the World Bank's `PA.NUS.PPP` (PPP conversion factor) and `PA.NUS.FCRF` (official exchange rate) indicators and rewrites [`utils/ppp-data.ts`](utils/ppp-data.ts), the committed conversion table behind the PPP pricing feature. It's the only place a network call happens; the extension itself never fetches anything. The script reports what it dropped and why — countries with no currency mapping, observations older than ten years, missing exchange rates — so read its output after a refresh. The generated file is in `.prettierignore` so reformatting can't churn it.

## Docs & privacy policy site

The `docs/` folder is a [VitePress](https://vitepress.dev) site — home page, privacy policy, and changelog — published to `https://pcu.visnalize.com`.

All SEO metadata is generated in [`docs/.vitepress/config.ts`](docs/.vitepress/config.ts) (static tags in `head`; per-page canonical/Open Graph tags and the home page's JSON-LD in `transformPageData`), driven by each page's frontmatter `title`/`description` — so add both when adding a page. The social preview image (`docs/public/og.png`, 1200×630) is rendered from [`store-listing/og-1200x630.html`](store-listing/og-1200x630.html) with headless Chrome:

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

[`scripts/release.mjs`](scripts/release.mjs) bumps `package.json`'s `version`, commits, tags it `v<version>`, and pushes both to `origin/main` (refusing unless you're on a clean, up-to-date `main`). The tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml): it type-checks, lints and tests, builds & zips the Chrome and Firefox extensions onto a GitHub Release, then commits the `docs/changelog.md` update and **moves the tag onto that commit** so the release contains it.

Two workflow details worth knowing before editing them:

- Release notes come from the commit log since the last tag, not from PRs — this repo commits straight to `main`, so GitHub's PR-based generator would come up empty.
- The changelog commit is pushed with the default `GITHUB_TOKEN`, whose pushes don't fire other workflows' `push` triggers. So [`deploy-docs.yml`](.github/workflows/deploy-docs.yml) also listens for `release.yml` via `workflow_run` and redeploys then (skipped if the release failed).

`package.json`'s `version` is the single source of truth — `wxt.config.ts` intentionally has no `version` field, so the built manifest always reflects it.
