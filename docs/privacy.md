---
title: Privacy Policy
---

# Privacy Policy for Play Console Utils

**Last updated: 2026-07-28**

Play Console Utils ("the extension") is a browser extension that adds productivity shortcuts to the Google Play Console review section: a configurable quick-reply key combo, a configurable modifier+click action that copies structured review data to your clipboard, an options page for configuring both plus per-app label mappings, and a toolbar icon/popup that indicate whether the current tab is a Play Console page.

This policy explains what data the extension accesses and, most importantly, what it does not do with it.

## Summary

- The extension does not collect, transmit, sell, or share any data — it has no server, no analytics, and makes no network requests of any kind itself.
- Review content and clipboard data never leave your device.
- Your extension settings (shortcuts, app mappings) are stored via Chrome's built-in `storage.sync` API so they follow you across your signed-in devices. That syncing is performed by Chrome/Google, not by the extension contacting anything — see "Extension settings" below for what that means.

## What the extension accesses

**Page content on Google Play Console.** The extension's content script only runs on pages matching `https://play.google.com/console/*`. When you use the "parse review" shortcut, it reads text already visible on the page — the review author's name, date, the review text, the reviewer's avatar image URL, and the currently selected app's name — and copies it as JSON to your clipboard. This happens only when you deliberately trigger the shortcut; nothing is read or copied automatically or in the background.

**Quick-reply translation (optional, on by default).** When you trigger the quick-reply shortcut, the extension reads the text you've typed in the reply box and, if the review is shown in a different language, translates it to match using Chrome's built-in on-device translation feature before publishing. This runs entirely on your device via your browser — no reply text, review text, or any other data is sent to the extension developer or any third-party server. You can turn this off in the options page.

**Extension settings.** Your configured quick-reply key combo, auto-translate toggle, parse-review modifier key, and app label→slug mappings are saved using the browser's built-in `storage` API, specifically `chrome.storage.sync`. If you're signed into Chrome with sync enabled, Chrome syncs this data through your Google account so it's available on your other signed-in devices — this is standard Chrome Sync infrastructure, not a server operated by the extension or its developer, and the data involved is limited to your shortcut key combo and app label/slug mappings (never review content or clipboard data). If you're not signed into Chrome sync, this data simply stays on your device, the same as before.

## What the extension does not do

- It does not make any network requests itself — there is no remote server this extension talks to.
- It does not use analytics, crash reporting, or telemetry of any kind.
- It does not collect or transmit review content, clipboard data, browsing history, or any other personal data — the only thing that may leave your device is your own settings, and only via Chrome's own sync feature, described above.
- It does not share data with third parties.

## Permissions

The extension requests the `storage` permission, used exclusively to save your own configuration (shortcuts and app mappings) via `chrome.storage.sync` (see "Extension settings" above). It also declares host permission for `https://play.google.com/console/*`, which is required for the quick-reply and parse-review content script to run there, and for a background script to read the URL of tabs on that host so it can show the colored toolbar icon only there (grayscale everywhere else). No URL or tab information for any other site is ever read.

## Data retention and deletion

Your settings live in Chrome's extension storage (synced or local, depending on your Chrome sign-in state) and are removed when you remove the extension. You can also clear them via your browser's settings without uninstalling. Clipboard contents are managed entirely by your operating system, not by the extension.

## Changes to this policy

If this extension's data practices change in the future, this document will be updated accordingly, and the "Last updated" date above will reflect the change.

## Contact

Questions about this policy can be directed to: <hey@visnalize.com>
