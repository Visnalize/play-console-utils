import { describe, expect, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createPageBookmark, pageBookmarksItem } from './page-bookmarks';

describe('createPageBookmark', () => {
  it('trims the label and keeps the url as-is', () => {
    const bookmark = createPageBookmark(
      '  Brick 1100 reviews  ',
      'https://play.google.com/console/u/0/developers/123/app-list',
    );
    expect(bookmark.label).toBe('Brick 1100 reviews');
    expect(bookmark.url).toBe(
      'https://play.google.com/console/u/0/developers/123/app-list',
    );
  });

  it('assigns each bookmark a unique id', () => {
    const a = createPageBookmark('A', 'https://example.com/a');
    const b = createPageBookmark('B', 'https://example.com/b');
    expect(a.id).not.toBe(b.id);
  });
});

describe('pageBookmarksItem', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to an empty list', async () => {
    expect(await pageBookmarksItem.getValue()).toEqual([]);
  });

  it('persists saved bookmarks', async () => {
    const bookmark = createPageBookmark('Reviews', 'https://example.com');
    await pageBookmarksItem.setValue([bookmark]);
    expect(await pageBookmarksItem.getValue()).toEqual([bookmark]);
  });
});
