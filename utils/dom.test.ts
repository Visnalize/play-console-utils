import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UNKNOWN_AUTHOR,
  UNKNOWN_DATE,
  findButtonByText,
  getActiveAppLabel,
  getReplyText,
  getReviewAuthor,
  getReviewDate,
  isButtonDisabled,
} from './dom';
import { ACTIVE_APP_BUTTON, REVIEW_AUTHOR, REVIEW_DATE } from './selectors';

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

function fakeButton(attrs: {
  textContent?: string;
  ariaLabel?: string;
  disabled?: boolean;
  disabledAttr?: boolean;
  ariaDisabled?: string;
}): HTMLElement {
  return {
    textContent: attrs.textContent ?? '',
    disabled: attrs.disabled,
    hasAttribute: (name: string) =>
      name === 'disabled' && attrs.disabledAttr === true,
    getAttribute: (name: string) => {
      if (name === 'aria-label') return attrs.ariaLabel ?? null;
      if (name === 'aria-disabled') return attrs.ariaDisabled ?? null;
      return null;
    },
  } as unknown as HTMLElement;
}

function fakeScope(buttons: HTMLElement[]): ParentNode {
  return { querySelectorAll: () => buttons } as unknown as ParentNode;
}

describe('getReviewAuthor', () => {
  it('reads the author display name', () => {
    const container = fakeContainer({
      [REVIEW_AUTHOR]: { innerText: 'Jane Doe' },
    });
    expect(getReviewAuthor(container)).toBe('Jane Doe');
  });

  it('falls back when the selector is missing', () => {
    expect(getReviewAuthor(fakeContainer({}))).toBe(UNKNOWN_AUTHOR);
  });

  it('falls back when the container is null/undefined', () => {
    expect(getReviewAuthor(null)).toBe(UNKNOWN_AUTHOR);
    expect(getReviewAuthor(undefined)).toBe(UNKNOWN_AUTHOR);
  });
});

describe('getReviewDate', () => {
  it('truncates a long date string to the first two comma segments', () => {
    const container = fakeContainer({
      [REVIEW_DATE]: { innerText: 'July 1, 2024, 3:00:00 PM UTC' },
    });
    expect(getReviewDate(container)).toBe('July 1, 2024');
  });

  it('leaves a date with no commas as-is', () => {
    const container = fakeContainer({ [REVIEW_DATE]: { innerText: 'Today' } });
    expect(getReviewDate(container)).toBe('Today');
  });

  it('falls back when the selector is missing', () => {
    expect(getReviewDate(fakeContainer({}))).toBe(UNKNOWN_DATE);
  });
});

describe('getActiveAppLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the active app button's aria-label", () => {
    vi.stubGlobal('document', {
      querySelector: (selector: string) =>
        selector === ACTIVE_APP_BUTTON ? { ariaLabel: 'Brick 1100' } : null,
    });
    expect(getActiveAppLabel()).toBe('Brick 1100');
  });

  it('returns an empty string when the button is missing', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    expect(getActiveAppLabel()).toBe('');
  });
});

describe('findButtonByText', () => {
  it('matches on visible text, case-insensitively', () => {
    const target = fakeButton({ textContent: ' Publish reply ' });
    const scope = fakeScope([fakeButton({ textContent: 'Discard' }), target]);
    expect(findButtonByText(scope, ['publish reply'])).toBe(target);
  });

  it('matches an icon-only button on its aria-label', () => {
    const target = fakeButton({ ariaLabel: 'Next page' });
    expect(findButtonByText(fakeScope([target]), ['next page'])).toBe(target);
  });

  it('returns the first button matching any of the labels', () => {
    const spanish = fakeButton({ textContent: 'Descartar' });
    const scope = fakeScope([fakeButton({ textContent: 'Reply' }), spanish]);
    expect(findButtonByText(scope, ['discard', 'descartar'])).toBe(spanish);
  });

  it('returns undefined when nothing matches', () => {
    const scope = fakeScope([fakeButton({ textContent: 'Reply' })]);
    expect(findButtonByText(scope, ['publish'])).toBeUndefined();
  });
});

describe('isButtonDisabled', () => {
  it('detects the native disabled property', () => {
    expect(isButtonDisabled(fakeButton({ disabled: true }))).toBe(true);
  });

  it('detects the disabled attribute a custom element reflects', () => {
    expect(isButtonDisabled(fakeButton({ disabledAttr: true }))).toBe(true);
  });

  it('detects aria-disabled', () => {
    expect(isButtonDisabled(fakeButton({ ariaDisabled: 'true' }))).toBe(true);
  });

  it('reports an enabled button as enabled', () => {
    expect(
      isButtonDisabled(
        fakeButton({ textContent: 'Publish', ariaDisabled: 'false' }),
      ),
    ).toBe(false);
  });
});

describe('getReplyText', () => {
  it('reads a textarea from its value', () => {
    const el = { tagName: 'TEXTAREA', value: 'typed', innerText: '' };
    expect(getReplyText(el as unknown as HTMLElement)).toBe('typed');
  });

  it('reads a contenteditable from its innerText', () => {
    const el = { tagName: 'DIV', innerText: 'typed' };
    expect(getReplyText(el as unknown as HTMLElement)).toBe('typed');
  });
});
