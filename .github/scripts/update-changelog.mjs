#!/usr/bin/env node
// Inserts a release's auto-generated notes into docs/changelog.md, right after
// the <!-- changelog-insert --> marker. Run by .github/workflows/release.yml.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , version, date, notes] = process.argv;
if (!version || !date || !notes) {
  console.error('Usage: update-changelog.mjs <version> <date> <notes>');
  process.exit(1);
}

const path = 'docs/changelog.md';
const changelog = readFileSync(path, 'utf8');
const marker = '<!-- changelog-insert -->';

if (changelog.includes(`## [${version}]`)) {
  console.log(`Changelog already has an entry for ${version}, skipping.`);
  process.exit(0);
}

if (!changelog.includes(marker)) {
  console.error(`Marker "${marker}" not found in ${path}`);
  process.exit(1);
}

const entry = `${marker}\n\n## [${version}] - ${date}\n\n${notes.trim()}\n`;
writeFileSync(path, changelog.replace(marker, entry));
console.log(`Added changelog entry for ${version}.`);
