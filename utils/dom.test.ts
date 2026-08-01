import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UNKNOWN_AUTHOR,
  UNKNOWN_DATE,
  findButtonByText,
  getActiveAppLabel,
  getReplyText,
  getReviewAuthor,
  getReviewDate,
  getReviewText,
  hasPriceValue,
  isButtonDisabled,
  isPriceInput,
  toPriceRow,
} from './dom';
import {
  ACTIVE_APP_BUTTON,
  COLUMN_HEADER,
  PRICE_GROUP_TOGGLE,
  PRICE_CELL_TEXT,
  PRICE_REGION_CELL,
  PRICE_VALUE_CELL,
  REVIEW_AUTHOR,
  REVIEW_DATE,
  REVIEW_TEXT,
} from './selectors';

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

describe('getReviewText', () => {
  it('reads the review body, not the whole container', () => {
    const container = fakeContainer({
      [REVIEW_TEXT]: { innerText: ' Great app! ' },
    });
    expect(getReviewText(container)).toBe('Great app!');
  });

  it('returns an empty string when the selector is missing', () => {
    expect(getReviewText(fakeContainer({}))).toBe('');
    expect(getReviewText(null)).toBe('');
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

function fakeInput(attrs: {
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  value?: string;
}): HTMLInputElement {
  return {
    disabled: attrs.disabled ?? false,
    readOnly: attrs.readOnly ?? false,
    value: attrs.value ?? '',
    getAttribute: (name: string) =>
      name === 'type' ? (attrs.type ?? null) : null,
  } as unknown as HTMLInputElement;
}

function fakeRow(innerText: string, inputs: HTMLInputElement[]): HTMLElement {
  return {
    innerText,
    querySelector: () => null,
    querySelectorAll: () => inputs,
  } as unknown as HTMLElement;
}

// Models the real Play Console price row: <ess-cell essfield="…"> columns
// whose value sits in a nested .main-text span, and no input anywhere.
function fakeCell(
  mainText: string | null,
  extras: { inputs?: HTMLInputElement[] } = {},
): Element {
  return {
    innerText: mainText ?? '',
    querySelector: (selector: string) => {
      if (selector === PRICE_CELL_TEXT) {
        return mainText === null ? null : { innerText: mainText };
      }
      return null;
    },
    querySelectorAll: () => extras.inputs ?? [],
  } as unknown as Element;
}

function fakeGridRow(cells: {
  region?: Element;
  price?: Element;
  header?: boolean;
  groupToggle?: boolean;
}): HTMLElement {
  return {
    innerText: 'whole row text that should not be used',
    querySelector: (selector: string) => {
      if (selector === COLUMN_HEADER) return cells.header ? {} : null;
      if (selector === PRICE_GROUP_TOGGLE) return cells.groupToggle ? {} : null;
      if (selector === PRICE_REGION_CELL) return cells.region ?? null;
      if (selector === PRICE_VALUE_CELL) return cells.price ?? null;
      return null;
    },
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
}

describe('isPriceInput', () => {
  it('accepts a typeless or text input', () => {
    expect(isPriceInput(fakeInput({}))).toBe(true);
    expect(isPriceInput(fakeInput({ type: 'text' }))).toBe(true);
    expect(isPriceInput(fakeInput({ type: 'number' }))).toBe(true);
  });

  it('rejects the input types that are never a price', () => {
    expect(isPriceInput(fakeInput({ type: 'checkbox' }))).toBe(false);
    expect(isPriceInput(fakeInput({ type: 'search' }))).toBe(false);
    expect(isPriceInput(fakeInput({ type: 'HIDDEN' }))).toBe(false);
  });

  it('rejects fields a write could not stick to', () => {
    expect(isPriceInput(fakeInput({ disabled: true }))).toBe(false);
    expect(isPriceInput(fakeInput({ readOnly: true }))).toBe(false);
  });
});

describe('toPriceRow on the real Play Console grid', () => {
  it('reads the market from the region cell, not the whole row', () => {
    const result = toPriceRow(
      fakeGridRow({
        region: fakeCell('India'),
        price: fakeCell('INR 100.00'),
      }),
    );
    // The row's own text also carries the currency and the tax percentage;
    // matching on that instead is what made rows resolve to the wrong market.
    expect(result?.text).toBe('India');
    expect(result?.valueText).toBe('INR 100.00');
  });

  it('makes the price cell itself the click target, since the row has no input', () => {
    // Clicking the cell opens the editor; the .ess-edit-icon inside it is
    // only the visible affordance and needs no handling of its own.
    const priceCell = fakeCell('INR 100.00');
    const result = toPriceRow(
      fakeGridRow({ region: fakeCell('India'), price: priceCell }),
    );
    expect(result?.edit).toBe(priceCell);
    expect(result?.input).toBeNull();
  });

  it('still yields a row when the price is not set yet', () => {
    const result = toPriceRow(
      fakeGridRow({
        region: fakeCell('Japan'),
        price: fakeCell(''),
      }),
    );
    expect(result?.text).toBe('Japan');
    expect(result?.valueText).toBe('');
  });

  it('falls back to the cell text when there is no .main-text span', () => {
    const result = toPriceRow(
      fakeGridRow({ region: fakeCell(null), price: fakeCell(null) }),
    );
    // Both cells are empty, so there is nothing to identify the row by.
    expect(result).toBeNull();
  });

  it('ignores a grid row with no region cell', () => {
    expect(toPriceRow(fakeGridRow({ price: fakeCell('INR 1.00') }))).toBeNull();
  });

  // "Other countries / regions (USD)" is a collapsible group, not a market:
  // same row markup, empty price cell, nothing to edit — but its label carries
  // a currency code, so it used to match USD and show an averaged price for a
  // row that can't be filled.
  it('ignores a collapsible group header', () => {
    expect(
      toPriceRow(
        fakeGridRow({
          groupToggle: true,
          region: fakeCell('Other countries / regions (USD)'),
          price: fakeCell(''),
        }),
      ),
    ).toBeNull();
  });

  // The header row has the same essfield columns as a data row, so without
  // this it gets scanned and inflates the "matched N of M" count.
  it('ignores the header row', () => {
    expect(
      toPriceRow(
        fakeGridRow({
          header: true,
          region: fakeCell('Region'),
          price: fakeCell('Price'),
        }),
      ),
    ).toBeNull();
  });
});

describe('toPriceRow fallback for input-based price forms', () => {
  it('pairs a row with its first usable input', () => {
    const search = fakeInput({ type: 'search' });
    const price = fakeInput({ value: '4.99' });
    const result = toPriceRow(fakeRow('  India INR  ', [search, price]));
    expect(result).toMatchObject({
      input: price,
      text: 'India INR',
      valueText: '4.99',
      edit: null,
    });
  });

  it('ignores a row with no usable input', () => {
    expect(toPriceRow(fakeRow('India', []))).toBeNull();
    expect(
      toPriceRow(fakeRow('India', [fakeInput({ disabled: true })])),
    ).toBeNull();
  });

  it('ignores a row with no visible text to identify it by', () => {
    expect(toPriceRow(fakeRow('   ', [fakeInput({})]))).toBeNull();
  });
});

describe('hasPriceValue', () => {
  const row = (valueText: string) =>
    ({ valueText }) as unknown as Parameters<typeof hasPriceValue>[0];

  it('is true only when the cell shows an actual number', () => {
    expect(hasPriceValue(row('INR 100.00'))).toBe(true);
    expect(hasPriceValue(row('JPY 480'))).toBe(true);
    // A currency with no amount is an unset price, not a filled one.
    expect(hasPriceValue(row('INR'))).toBe(false);
    expect(hasPriceValue(row(''))).toBe(false);
  });
});
