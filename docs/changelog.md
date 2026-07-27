---
title: Changelog
---

# Changelog

All notable changes to Play Console Utils are documented in this file.

<!-- changelog-insert -->

## [1.1.1] - 2026-07-27

- chore: add store listing assets (2e51dfa)

**Full Changelog**: https://github.com/Visnalize/play-console-utils/compare/v1.1.0...v1.1.1


## [1.1.0] - 2026-07-26

- fix: generate release notes from commit log instead of PR-based API (d47f757)
- chore: enhance release workflow to update changelog and move release tag (3275159)
- chore: add release script for version bumping and tagging (3cbaeec)
- chore: rename content script folder (ecbdcec)
- chore: use toastify.js for toast messages (c87fe0a)
- feat: add quick-reply auto-translation feature (3cae1a9)
- chore: enhance docs with new features and toolbar icon functionality (4b6b82f)
- feat: popup UI for shortcuts to options page and external docs feat: toggle icon when browser url matches allowed list (271a346)
- feat: add automated changelog updates and release notes generation (8f7fb82)
- fix: correct privacy policy redirect link (92c13e2)
- chore: add privacy policy redirect and update nav link (6c2ff72)
- chore: update deploy-docs action workflow (183dff4)
- Create CNAME (776400f)
- docs: add privacy policy page (025d01e)

**Full Changelog**: https://github.com/Visnalize/play-console-utils/compare/v1.0.0...v1.1.0


## [1.0.0] - 2026-07-24

### Added

- Quick reply shortcut (Ctrl/Cmd + Enter by default) — while focused in a reply textarea/editable field, finds and clicks the "Publish reply" button (English/Spanish label variants), with a brief visual confirmation flash.
- Parse review shortcut (Alt + Click by default) — copies a structured JSON snippet (author, date, app slug, review content, avatar image URL) to the clipboard, with a toast notification.
- Configurable app slug mappings (Options page) — map each Play Console app label to a custom slug used in the copied JSON.
- Configurable shortcuts (Options page) — customize the quick-reply key combo and parse-review click modifier(s).
