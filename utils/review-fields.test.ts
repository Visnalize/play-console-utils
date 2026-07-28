import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UNKNOWN_AUTHOR,
  UNKNOWN_DATE,
  extractAuthorFromContainer,
  extractDateFromContainer,
  getActiveAppLabel,
} from './review-fields';

// jsdom isn't a dependency of this project (see CLAUDE.md's testing notes) —
// fake just enough of the Element shape these functions actually touch,
// same approach shortcuts.test.ts uses for KeyboardEvent/MouseEvent.
function fakeContainer(
  matches: Record<string, { innerText: string } | undefined>,
): Element {
  return {
    querySelector: (selector: string) => matches[selector] ?? null,
  } as unknown as Element;
}

describe('extractAuthorFromContainer', () => {
  it('reads the author display name', () => {
    const container = fakeContainer({
      '.author-display-name': { innerText: 'Jane Doe' },
    });
    expect(extractAuthorFromContainer(container)).toBe('Jane Doe');
  });

  it('falls back when the selector is missing', () => {
    expect(extractAuthorFromContainer(fakeContainer({}))).toBe(UNKNOWN_AUTHOR);
  });

  it('falls back when the container is null/undefined', () => {
    expect(extractAuthorFromContainer(null)).toBe(UNKNOWN_AUTHOR);
    expect(extractAuthorFromContainer(undefined)).toBe(UNKNOWN_AUTHOR);
  });
});

describe('extractDateFromContainer', () => {
  it('truncates a long date string to the first two comma segments', () => {
    const container = fakeContainer({
      '.last-update-time': { innerText: 'July 1, 2024, 3:00:00 PM UTC' },
    });
    expect(extractDateFromContainer(container)).toBe('July 1, 2024');
  });

  it('leaves a date with no commas as-is', () => {
    const container = fakeContainer({
      '.last-update-time': { innerText: 'Today' },
    });
    expect(extractDateFromContainer(container)).toBe('Today');
  });

  it('falls back when the selector is missing', () => {
    expect(extractDateFromContainer(fakeContainer({}))).toBe(UNKNOWN_DATE);
  });
});

describe('getActiveAppLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the active app button's aria-label", () => {
    vi.stubGlobal('document', {
      querySelector: (selector: string) =>
        selector === '.active-app-button' ? { ariaLabel: 'Brick 1100' } : null,
    });
    expect(getActiveAppLabel()).toBe('Brick 1100');
  });

  it('returns an empty string when the button is missing', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    expect(getActiveAppLabel()).toBe('');
  });
});
