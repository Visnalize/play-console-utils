#!/usr/bin/env node
// Bumps package.json's version, commits it, tags it, and pushes — triggering
// .github/workflows/release.yml. See README.md's "Releasing" section.
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function capture(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

async function prompt(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const branch = capture('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    throw new Error(`Refusing to release from branch "${branch}" — switch to main first.`);
  }

  if (capture('git status --porcelain')) {
    throw new Error('Working tree is not clean — commit or stash changes before releasing.');
  }

  run('git fetch origin main --quiet');
  if (capture('git rev-list HEAD..origin/main --count') !== '0') {
    throw new Error('Local main is behind origin/main — pull before releasing.');
  }

  let version = process.argv[2] ?? (await prompt('Enter release version (e.g. 1.2.0): '));
  version = version.replace(/^v/, '').trim();
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/.test(version)) {
    throw new Error(`Invalid version "${version}" — expected semver like 1.2.0`);
  }

  const tag = `v${version}`;
  if (capture(`git tag -l ${tag}`)) {
    throw new Error(`Tag ${tag} already exists locally.`);
  }

  const proceed = await prompt(
    `About to bump package.json to ${version}, commit, tag ${tag}, and push both to origin/main. Continue? [y/N] `,
  );
  if (!/^y(es)?$/i.test(proceed)) {
    console.log('Aborted.');
    return;
  }

  run(`pnpm pkg set version="${version}"`);
  run('git add package.json');
  run(`git commit -m "chore: release ${tag}"`);
  run(`git tag ${tag}`);
  run('git push origin main');
  run(`git push origin ${tag}`);

  console.log(`Pushed ${tag} — release workflow will build, publish, and update the changelog.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
