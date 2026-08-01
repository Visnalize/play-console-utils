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
  shortcutKeyOf,
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

// A letter shortcut matched on e.key alone silently never fires on macOS,
// where Option is a compose key: Option+P reports 'π'. No shipped default is
// a letter+Alt combo, but any shortcut the user records could be.
const ALT_P = { ctrlOrMeta: false, shift: false, alt: true, key: 'p' };

describe('letter shortcuts across keyboard layouts', () => {
  it('matches Alt+P when macOS reports the composed character', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'π',
          code: 'KeyP',
        } as Partial<KeyboardEvent>),
        ALT_P,
      ),
    ).toBe(true);
  });

  it('still matches Alt+P where the key value is plain', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'p',
          code: 'KeyP',
        } as Partial<KeyboardEvent>),
        ALT_P,
      ),
    ).toBe(true);
  });

  it('matches regardless of the key value casing', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'P',
          code: 'KeyP',
        } as Partial<KeyboardEvent>),
        ALT_P,
      ),
    ).toBe(true);
  });

  it('does not match a different physical key that composed to the same char', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'π',
          code: 'KeyQ',
        } as Partial<KeyboardEvent>),
        ALT_P,
      ),
    ).toBe(false);
  });

  // A shortcut recorded before this normalisation existed stored the composed
  // character; it has to keep working rather than silently stop matching.
  it('still honours a shortcut stored as the composed character', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'π',
          code: 'KeyP',
        } as Partial<KeyboardEvent>),
        { ctrlOrMeta: false, shift: false, alt: true, key: 'π' },
      ),
    ).toBe(true);
  });

  it('leaves named keys matching on their key value', () => {
    expect(
      matchesKeyShortcut(
        keyEvent({
          altKey: true,
          key: 'ArrowDown',
          code: 'ArrowDown',
        } as Partial<KeyboardEvent>),
        DEFAULT_NEXT_REVIEW_SHORTCUT,
      ),
    ).toBe(true);
  });
});

describe('shortcutKeyOf', () => {
  it('records the physical letter, not the composed character', () => {
    expect(
      shortcutKeyOf(
        keyEvent({ key: 'π', code: 'KeyP' } as Partial<KeyboardEvent>),
      ),
    ).toBe('p');
    expect(
      shortcutKeyOf(
        keyEvent({ key: '¡', code: 'Digit1' } as Partial<KeyboardEvent>),
      ),
    ).toBe('1');
  });

  it('falls back to the key value for named keys', () => {
    expect(
      shortcutKeyOf(
        keyEvent({ key: 'ArrowUp', code: 'ArrowUp' } as Partial<KeyboardEvent>),
      ),
    ).toBe('ArrowUp');
  });
});

describe('formatShortcut', () => {
  it('formats the default quick-reply shortcut', () => {
    expect(formatShortcut(DEFAULT_QUICK_REPLY_SHORTCUT)).toBe('Ctrl/⌘ + Enter');
  });

  it('formats a modifier-only shortcut', () => {
    expect(formatShortcut(DEFAULT_PARSE_REVIEW_MODIFIER)).toBe('Alt');
  });

  it('upper-cases a single-character key so it reads as a key cap', () => {
    expect(formatShortcut(DEFAULT_CANNED_REPLY_SHORTCUT)).toBe('Ctrl/⌘ + K');
  });

  it('formats an empty modifier set as "(none)"', () => {
    expect(
      formatShortcut({ ctrlOrMeta: false, shift: false, alt: false }),
    ).toBe('(none)');
  });
});
