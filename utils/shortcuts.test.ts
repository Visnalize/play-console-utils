import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANNED_REPLY_SHORTCUT,
  DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
  DEFAULT_NEXT_REVIEW_SHORTCUT,
  DEFAULT_PARSE_REVIEW_MODIFIER,
  DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
  DEFAULT_PREV_REVIEW_SHORTCUT,
  DEFAULT_QUICK_REPLY_SHORTCUT,
  formatShortcut,
  hasAnyModifier,
  matchesKeyShortcut,
  matchesParseReviewModifier,
} from './shortcuts';

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'Enter',
    ...init,
  } as KeyboardEvent;
}

function clickEvent(init: Partial<MouseEvent>): MouseEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as MouseEvent;
}

describe('matchesKeyShortcut', () => {
  it('matches the default quick-reply Ctrl/Cmd+Enter combo', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ ctrlKey: true, key: 'Enter' }),
        DEFAULT_QUICK_REPLY_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeyShortcut(
        keyEvent({ metaKey: true, key: 'Enter' }),
        DEFAULT_QUICK_REPLY_SHORTCUT,
      ),
    ).toBe(true);
  });

  it('rejects when a required modifier is missing', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ key: 'Enter' }),
        DEFAULT_QUICK_REPLY_SHORTCUT,
      ),
    ).toBe(false);
  });

  it('rejects when an extra modifier is held', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ ctrlKey: true, shiftKey: true, key: 'Enter' }),
        DEFAULT_QUICK_REPLY_SHORTCUT,
      ),
    ).toBe(false);
  });

  it('rejects a non-matching key', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ ctrlKey: true, key: 'k' }),
        DEFAULT_QUICK_REPLY_SHORTCUT,
      ),
    ).toBe(false);
  });

  it('matches a custom shortcut', () => {
    const custom = { ctrlOrMeta: false, shift: true, alt: true, key: 'k' };
    expect(
      matchesKeyShortcut(
        keyEvent({ shiftKey: true, altKey: true, key: 'k' }),
        custom,
      ),
    ).toBe(true);
  });

  it('matches the default canned-reply Ctrl/Cmd+K combo', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ ctrlKey: true, key: 'k' }),
        DEFAULT_CANNED_REPLY_SHORTCUT,
      ),
    ).toBe(true);
  });

  it('matches the default next/previous review Alt+Arrow combos', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ altKey: true, key: 'ArrowDown' }),
        DEFAULT_NEXT_REVIEW_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeyShortcut(
        keyEvent({ altKey: true, key: 'ArrowUp' }),
        DEFAULT_PREV_REVIEW_SHORTCUT,
      ),
    ).toBe(true);
  });

  it('rejects the next-review combo when Alt is missing', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ key: 'ArrowDown' }),
        DEFAULT_NEXT_REVIEW_SHORTCUT,
      ),
    ).toBe(false);
  });

  it('matches the default next/previous review-page Alt+Arrow combos', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({ altKey: true, key: 'ArrowRight' }),
        DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeyShortcut(
        keyEvent({ altKey: true, key: 'ArrowLeft' }),
        DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
      ),
    ).toBe(true);
  });
});

describe('matchesParseReviewModifier', () => {
  it('matches the default Alt+click', () => {
    expect(
      matchesParseReviewModifier(
        clickEvent({ altKey: true }),
        DEFAULT_PARSE_REVIEW_MODIFIER,
      ),
    ).toBe(true);
  });

  it('rejects a plain click with no modifiers', () => {
    expect(
      matchesParseReviewModifier(clickEvent({}), DEFAULT_PARSE_REVIEW_MODIFIER),
    ).toBe(false);
  });

  it('never matches when the configured modifier itself is empty', () => {
    const empty = { ctrlOrMeta: false, shift: false, alt: false };
    expect(matchesParseReviewModifier(clickEvent({}), empty)).toBe(false);
    expect(
      matchesParseReviewModifier(
        clickEvent({ altKey: true, ctrlKey: true, shiftKey: true }),
        empty,
      ),
    ).toBe(false);
  });

  it('matches a custom Ctrl/Cmd+Shift+click combo', () => {
    const custom = { ctrlOrMeta: true, shift: true, alt: false };
    expect(
      matchesParseReviewModifier(
        clickEvent({ ctrlKey: true, shiftKey: true }),
        custom,
      ),
    ).toBe(true);
  });
});

describe('hasAnyModifier', () => {
  it('is false only when every modifier is off', () => {
    expect(
      hasAnyModifier({ ctrlOrMeta: false, shift: false, alt: false }),
    ).toBe(false);
    expect(hasAnyModifier({ ctrlOrMeta: false, shift: false, alt: true })).toBe(
      true,
    );
  });
});

describe('formatShortcut', () => {
  it('formats the default quick-reply shortcut', () => {
    expect(formatShortcut(DEFAULT_QUICK_REPLY_SHORTCUT)).toBe('Ctrl/⌘ + Enter');
  });

  it('formats a modifier-only shortcut', () => {
    expect(formatShortcut(DEFAULT_PARSE_REVIEW_MODIFIER)).toBe('Alt');
  });

  it('formats an empty modifier set as "(none)"', () => {
    expect(
      formatShortcut({ ctrlOrMeta: false, shift: false, alt: false }),
    ).toBe('(none)');
  });
});
