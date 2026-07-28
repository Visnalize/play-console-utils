import { describe, expect, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { appMappingsItem, resolveAppSlug, slugify } from './apps';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Brick 1100')).toBe('brick-1100');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify('My Cool App!')).toBe('my-cool-app');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Weird--Label--  ')).toBe('weird-label');
  });

  it('falls back to "app" for an empty/symbol-only label', () => {
    expect(slugify('   ')).toBe('app');
    expect(slugify('!!!')).toBe('app');
  });
});

describe('resolveAppSlug', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('auto-slugifies and reports unmatched when no mapping exists', async () => {
    const result = await resolveAppSlug('Brick 1100');
    expect(result).toEqual({ slug: 'brick-1100', matched: false });
  });

  it('returns the exact mapped slug', async () => {
    await appMappingsItem.setValue([
      { label: 'Brick 1100', slug: 'brick1100' },
    ]);
    const result = await resolveAppSlug('Brick 1100');
    expect(result).toEqual({ slug: 'brick1100', matched: true });
  });

  it('matches case-insensitively', async () => {
    await appMappingsItem.setValue([
      { label: 'Brick 1100', slug: 'brick1100' },
    ]);
    const result = await resolveAppSlug('brick 1100');
    expect(result).toEqual({ slug: 'brick1100', matched: true });
  });

  it('falls back to a substring match, like the original .includes() behavior', async () => {
    await appMappingsItem.setValue([
      { label: 'Brick 1100', slug: 'brick1100' },
    ]);
    const result = await resolveAppSlug('Brick 1100 (com.example.brick1100)');
    expect(result).toEqual({ slug: 'brick1100', matched: true });
  });
});
