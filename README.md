# Play Console Utils

A Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)) that adds small productivity shortcuts to the [Google Play Console](https://play.google.com/console/) review section.

## Features

- **Quick reply (Ctrl/Cmd + Enter by default)** — While focused in a reply textarea/editable field, press the configured shortcut to automatically find and click the "Publish reply" button (supports English and Spanish button labels), with a brief visual confirmation flash.
- **Parse review (Alt + Click by default)** — Click a review's text while holding the configured modifier(s) to copy a structured JSON snippet to the clipboard containing the author name, date, app slug, review content, and avatar image URL. Shows a toast notification confirming the copy.
- **Configurable app slugs (Options page)** — Map each Play Console app label to your own slug, used in the JSON copied by the Parse review feature. Apps without a configured mapping fall back to an auto-generated slug.
- **Configurable shortcuts (Options page)** — Change the quick-reply key combo (click "Record" and press your combo) and the parse-review click modifier(s), independent of the app slug mapping. Changes apply immediately, no reload needed.

## Development

Requires [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev          # Chrome dev build with hot reload, in .output/chrome-mv3-dev
pnpm dev:firefox  # Firefox dev build
```

Load the unpacked extension from `.output/chrome-mv3-dev` (`chrome://extensions` → Developer mode → Load unpacked).

## Configuring app slugs & shortcuts

Right-click the extension icon → **Options** (or `chrome://extensions` → Play Console Utils → Details → Extension options).

- **App slugs**: add a row per app — the label as shown in Play Console's active-app selector, and the slug you want in the copied JSON.
- **Shortcuts**: click the quick-reply combo button and press your desired key combo (Esc cancels); check/uncheck modifiers for the parse-review click trigger (at least one must stay selected). Both save automatically.

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
