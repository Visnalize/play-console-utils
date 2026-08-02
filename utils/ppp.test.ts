import { describe, expect, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { PPP_COUNTRIES } from './ppp-data';
import {
  DEFAULT_PPP_SETTINGS,
  MAX_CUSTOM_FACTOR,
  MIN_CUSTOM_FACTOR,
  convertPrice,
  normalizeCustomFactor,
  getPppCountry,
  listPppCountries,
  matchPriceTarget,
  parsePriceValue,
  percentChange,
  pppSettingsItem,
  getCurrencyRate,
  quotePrice,
  roundPrice,
  toBaseCurrency,
} from './ppp';

describe('the bundled dataset', () => {
  it('anchors the US at a PPP of exactly 1', () => {
    // Every conversion divides by the base country's factor, and US is the
    // default base — a drifting value here would silently reprice everything.
    expect(PPP_COUNTRIES.US.ppp).toBe(1);
  });

  it('gives every country a positive factor and a 3-letter currency', () => {
    for (const [code, country] of Object.entries(PPP_COUNTRIES)) {
      expect(country.ppp, code).toBeGreaterThan(0);
      expect(country.currency, code).toMatch(/^[A-Z]{3}$/);
      expect(country.decimals, code).toBeGreaterThanOrEqual(0);
    }
  });

  it('knows the zero-decimal currencies price in whole units', () => {
    expect(PPP_COUNTRIES.JP.decimals).toBe(0);
    expect(PPP_COUNTRIES.VN.decimals).toBe(0);
    expect(PPP_COUNTRIES.KW.decimals).toBe(3);
  });
});

describe('roundPrice', () => {
  it('rounds to the nearest charm ending below when that is closer', () => {
    expect(roundPrice(114.27, 2, 'charm99')).toBe(113.99);
    expect(roundPrice(9.13, 2, 'charm99')).toBe(8.99);
  });

  it('does not jump a whole unit for a value just above an ending', () => {
    expect(roundPrice(4.0, 2, 'charm99')).toBe(3.99);
  });

  it('breaks ties upward', () => {
    expect(roundPrice(9.49, 2, 'charm99')).toBe(9.99);
  });

  it('never returns a price below one charm unit', () => {
    expect(roundPrice(0.31, 2, 'charm99')).toBe(0.99);
    expect(roundPrice(0.2, 2, 'charm90')).toBe(0.9);
  });

  it('supports a .90 ending', () => {
    expect(roundPrice(114.27, 2, 'charm90')).toBe(113.9);
  });

  // Charm endings are meaningless where there are no cents to end in, and
  // read as noise on large amounts — both fall back to nice numbers.
  it('falls back to nice numbers for zero-decimal currencies', () => {
    expect(roundPrice(509.0, 0, 'charm99')).toBe(510);
    expect(roundPrice(23558, 0, 'charm99')).toBe(24000);
  });

  it('falls back to nice numbers above the charm ceiling', () => {
    expect(roundPrice(972.99, 2, 'charm99')).toBe(972.99);
    expect(roundPrice(1234.5, 2, 'charm99')).toBe(1200);
  });

  it('rounds to two significant figures in nice mode', () => {
    expect(roundPrice(114.27, 2, 'nice')).toBe(110);
    expect(roundPrice(9.13, 0, 'nice')).toBe(9);
    expect(roundPrice(0.875, 3, 'nice')).toBe(0.88);
  });

  it('only clamps to currency precision in exact mode', () => {
    expect(roundPrice(114.278, 2, 'exact')).toBe(114.28);
    expect(roundPrice(509.6, 0, 'exact')).toBe(510);
  });

  it('returns 0 for a non-positive or non-finite input', () => {
    expect(roundPrice(0, 2, 'charm99')).toBe(0);
    expect(roundPrice(-5, 2, 'exact')).toBe(0);
    expect(roundPrice(Number.NaN, 2, 'nice')).toBe(0);
  });
});

describe('convertPrice', () => {
  const us = { ppp: 1 };

  it('converts through international dollars', () => {
    // 4.99 int'l $ x 20.088629 INR = 100.24, nearest .99 below = 99.99
    expect(
      convertPrice(4.99, us, PPP_COUNTRIES.IN, { rounding: 'charm99' }),
    ).toBe(99.99);
  });

  it('is an identity for the base country itself', () => {
    expect(
      convertPrice(4.99, us, PPP_COUNTRIES.US, { rounding: 'exact' }),
    ).toBe(4.99);
  });

  it('honours a non-US base country', () => {
    // A price set in India converts back to roughly the same int'l dollars.
    const backToUs = convertPrice(100.24, PPP_COUNTRIES.IN, PPP_COUNTRIES.US, {
      rounding: 'exact',
    });
    expect(backToUs).toBeCloseTo(4.99, 2);
  });

  it('produces whole units for zero-decimal currencies', () => {
    const jpy = convertPrice(4.99, us, PPP_COUNTRIES.JP, {
      rounding: 'charm99',
    });
    expect(Number.isInteger(jpy)).toBe(true);
  });

  it('scales every market by the custom factor', () => {
    const raw = convertPrice(4.99, us, PPP_COUNTRIES.IN, { rounding: 'exact' });
    const up = convertPrice(4.99, us, PPP_COUNTRIES.IN, {
      rounding: 'exact',
      customFactor: 2,
    });
    expect(up).toBeCloseTo(raw * 2, 2);
  });

  // Otherwise the factor would be a global rescale identical to just typing a
  // different base price, and would silently rewrite the base country's own
  // row if it's on the page.
  it('does not apply the factor to the base country itself', () => {
    expect(
      convertPrice(4.99, us, PPP_COUNTRIES.US, {
        rounding: 'exact',
        customFactor: 0.5,
      }),
    ).toBeCloseTo(4.99, 2);
  });

  it('treats a missing factor as pure PPP', () => {
    expect(
      convertPrice(4.99, us, PPP_COUNTRIES.IN, { rounding: 'exact' }),
    ).toBe(
      convertPrice(4.99, us, PPP_COUNTRIES.IN, {
        rounding: 'exact',
        customFactor: 1,
      }),
    );
  });

  it('returns 0 rather than throwing on a bad base price', () => {
    expect(
      convertPrice(Number.NaN, us, PPP_COUNTRIES.IN, { rounding: 'charm99' }),
    ).toBe(0);
    expect(
      convertPrice(4.99, { ppp: 0 }, PPP_COUNTRIES.IN, { rounding: 'exact' }),
    ).toBe(0);
  });
});

describe('matchPriceTarget', () => {
  it('matches a plain country name', () => {
    expect(matchPriceTarget('India')).toMatchObject({
      code: 'IN',
      currency: 'INR',
      approximate: false,
    });
  });

  it('matches a name embedded in surrounding row text', () => {
    expect(matchPriceTarget('India\tINR\t100.00')).toMatchObject({
      code: 'IN',
    });
  });

  it('prefers the longest matching name', () => {
    expect(matchPriceTarget('Dominican Republic')?.code).toBe('DO');
    expect(matchPriceTarget('Dominica')?.code).toBe('DM');
    expect(matchPriceTarget('Papua New Guinea')?.code).toBe('PG');
    expect(matchPriceTarget('Guinea-Bissau')?.code).toBe('GW');
  });

  it('accepts the spellings Play Console uses instead of the World Bank ones', () => {
    expect(matchPriceTarget('South Korea')?.code).toBe('KR');
    expect(matchPriceTarget('Vietnam')?.code).toBe('VN');
    expect(matchPriceTarget('Turkey')?.code).toBe('TR');
    expect(matchPriceTarget('Russia')?.code).toBe('RU');
    expect(matchPriceTarget('Czech Republic')?.code).toBe('CZ');
  });

  it('ignores case, accents and punctuation', () => {
    expect(matchPriceTarget("CÔTE D'IVOIRE")?.code).toBe('CI');
  });

  it('falls back to an unambiguous currency code', () => {
    expect(matchPriceTarget('JPY 500')).toMatchObject({
      currency: 'JPY',
      approximate: false,
      code: 'JP',
    });
  });

  it('averages a shared currency and flags it approximate', () => {
    const eur = matchPriceTarget('EUR 4.99');
    expect(eur?.currency).toBe('EUR');
    expect(eur?.approximate).toBe(true);
    expect(eur?.code).toBeUndefined();
    expect(eur!.ppp).toBeGreaterThan(0);
  });

  // Vatican City has no World Bank observation, so it only ever resolves by
  // currency. The match is legitimately approximate — what matters is that
  // callers label the row from the page, not from `name` (which is the bare
  // currency code here). See scanPrices() in pricing.content/fill.ts.
  it('resolves an unlisted market by currency, flagged approximate', () => {
    expect(getPppCountry('VA')).toBeUndefined();
    const match = matchPriceTarget('Vatican City EUR 4.99');
    expect(match?.currency).toBe('EUR');
    expect(match?.approximate).toBe(true);
    expect(match?.code).toBeUndefined();
    expect(match?.name).toBe('EUR');
  });

  it('returns null for a row it cannot identify', () => {
    expect(matchPriceTarget('Total')).toBeNull();
    expect(matchPriceTarget('')).toBeNull();
  });

  // The generator drops countries whose newest observation is too old to
  // price with (Venezuela's is 2011, three redenominations ago). An alias
  // still pointing at one of those used to resolve to a missing dataset entry
  // and throw when the row was read.
  it('does not resolve an alias for a country the generator dropped', () => {
    for (const name of ['Venezuela', 'Yemen', 'Cuba']) {
      // Either the row goes unmatched, or it matched on something real —
      // what it must never do is hand back a code with no dataset entry.
      const match = matchPriceTarget(name);
      if (match?.code) expect(PPP_COUNTRIES[match.code], name).toBeDefined();
    }
    // These three are genuinely absent right now, so they must not match at
    // all — if a refresh brings one back, tighten this rather than delete it.
    expect(PPP_COUNTRIES.VE).toBeUndefined();
    expect(matchPriceTarget('Venezuela')).toBeNull();
  });

  it('never resolves a country code that is missing from the dataset', () => {
    // Every country name in the dataset must round-trip to a real entry.
    for (const country of listPppCountries()) {
      const match = matchPriceTarget(country.name);
      expect(match, country.name).not.toBeNull();
      if (match?.code)
        expect(PPP_COUNTRIES[match.code], country.name).toBeDefined();
    }
  });
});

describe('normalizeCustomFactor', () => {
  it('passes an in-range factor through', () => {
    expect(normalizeCustomFactor(1.25)).toBe(1.25);
  });

  // A zero or negative factor would zero out every price; a typo like "100"
  // instead of "1.00" would multiply them by a hundred. Neither should ship.
  it('falls back to 1 for a missing or non-positive value', () => {
    expect(normalizeCustomFactor(undefined)).toBe(1);
    expect(normalizeCustomFactor(0)).toBe(1);
    expect(normalizeCustomFactor(-2)).toBe(1);
    expect(normalizeCustomFactor(Number.NaN)).toBe(1);
  });

  it('clamps to the allowed range', () => {
    expect(normalizeCustomFactor(0.001)).toBe(MIN_CUSTOM_FACTOR);
    expect(normalizeCustomFactor(100)).toBe(MAX_CUSTOM_FACTOR);
  });
});

describe('lookups', () => {
  it('is case-insensitive on the country code', () => {
    expect(getPppCountry('in')).toBe(PPP_COUNTRIES.IN);
    expect(getPppCountry('ZZ')).toBeUndefined();
  });

  it('lists every country sorted by name', () => {
    const list = listPppCountries();
    expect(list.length).toBe(Object.keys(PPP_COUNTRIES).length);
    const names = list.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('parsePriceValue', () => {
  it('reads a price with a currency code in front of it', () => {
    expect(parsePriceValue('INR 100.00')).toBe(100);
    expect(parsePriceValue('USD 4.99')).toBe(4.99);
  });

  it('reads a symbol-prefixed price with grouping', () => {
    expect(parsePriceValue('₹1,234.50')).toBe(1234.5);
  });

  it('treats a lone three-digit tail as grouping, not decimals', () => {
    // A currency with decimals always renders them ("USD 1,500.00"), so the
    // only way to see one separator with three digits after it is grouping.
    expect(parsePriceValue('VND 35,000')).toBe(35000);
    expect(parsePriceValue('IDR 15.000')).toBe(15000);
  });

  it('takes the last separator as the decimal point when both appear', () => {
    expect(parsePriceValue('EUR 1.234,56')).toBe(1234.56);
    expect(parsePriceValue('USD 1,234.56')).toBe(1234.56);
  });

  it('treats a repeated separator as grouping throughout', () => {
    expect(parsePriceValue('COP 1.234.567')).toBe(1234567);
  });

  it('handles space and apostrophe grouping', () => {
    expect(parsePriceValue('1 234,56 zl')).toBe(1234.56);
    expect(parsePriceValue("CHF 1'234.50")).toBe(1234.5);
  });

  it('returns null for a cell with no number, so unpriced is not zero', () => {
    // hasPriceValue()'s counterpart: "INR" alone means the row is unset, and
    // the preview must not claim a 100% drop from a price that never existed.
    expect(parsePriceValue('INR')).toBeNull();
    expect(parsePriceValue('')).toBeNull();
    expect(parsePriceValue('—')).toBeNull();
  });
});

describe('toBaseCurrency', () => {
  it('is the inverse of the PPP step', () => {
    const target = { ppp: 20, currency: 'XYZ' };
    expect(toBaseCurrency(200, 'XYZ', { ppp: 1 }, target)).toBe(10);
  });

  it('round-trips an unrounded conversion back to the base price', () => {
    const base = getPppCountry('US')!;
    const target = getPppCountry('IN')!;
    const converted = convertPrice(4.99, base, target, { rounding: 'exact' });
    expect(toBaseCurrency(converted, 'INR', base, target)).toBeCloseTo(4.99, 2);
  });

  it('is zero rather than Infinity for a nonsense target', () => {
    expect(
      toBaseCurrency(10, 'XYZ', { ppp: 1 }, { ppp: 0, currency: 'XYZ' }),
    ).toBe(0);
  });

  it('refuses a cross-currency inverse with no exchange rate', () => {
    // Same guard as quotePrice: without a rate there is no honest answer,
    // and a silent 0 is what keeps a wrong number off the screen.
    expect(
      toBaseCurrency(10, 'USD', { ppp: 1 }, { ppp: 20, currency: 'XYZ' }),
    ).toBe(0);
  });
});

describe('quotePrice — pricing a market in a currency that is not its own', () => {
  // Play Console bills Cambodia, Angola and Argentina in USD, and much of
  // non-euro Europe in EUR. Writing the market's own-currency figure into
  // those fields overcharges by roughly the exchange rate.
  const us = getPppCountry('US')!;
  const exact = { rounding: 'exact' as const };

  it('bills in the market currency when that is what the row uses', () => {
    const india = matchPriceTarget('India')!;
    const quoted = quotePrice(4.99, us, india, 'INR', exact)!;
    expect(quoted.currency).toBe('INR');
    expect(quoted.converted).toBe(false);
    // Identical to the pure-PPP path — no rate involved, nothing to drift.
    expect(quoted.amount).toBe(convertPrice(4.99, us, india, exact));
  });

  it('treats a missing quote currency as the market currency', () => {
    const india = matchPriceTarget('India')!;
    expect(quotePrice(4.99, us, india, null, exact)).toEqual(
      quotePrice(4.99, us, india, 'INR', exact),
    );
  });

  it('crosses into USD via the market exchange rate', () => {
    const cambodia = matchPriceTarget('Cambodia')!;
    const local = quotePrice(4.99, us, cambodia, 'KHR', exact)!;
    const usd = quotePrice(4.99, us, cambodia, 'USD', exact)!;

    expect(usd.currency).toBe('USD');
    expect(usd.converted).toBe(true);
    expect(usd.decimals).toBe(2);
    // The whole point: the riel figure is thousands, the dollar one is single
    // digits. Writing the former into a USD field is the bug this fixes.
    expect(local.amount).toBeGreaterThan(1000);
    expect(usd.amount).toBeGreaterThan(0);
    expect(usd.amount).toBeLessThan(4.99);
    // Rounded to the dollar cent, so compare at that precision.
    expect(usd.amount).toBeCloseTo(local.amount / cambodia.fx!, 2);
  });

  it('crosses into EUR, and agrees with going via USD', () => {
    const poland = matchPriceTarget('Poland')!;
    const eur = quotePrice(4.99, us, poland, 'EUR', exact)!;
    const usd = quotePrice(4.99, us, poland, 'USD', exact)!;
    expect(eur.currency).toBe('EUR');
    expect(eur.amount).toBeCloseTo(usd.amount * getCurrencyRate('EUR')!, 2);
  });

  it('uses the quote currency decimals, not the market ones', () => {
    // JPY has none of its own; billed in dollars the price gains cents.
    const japan = matchPriceTarget('Japan')!;
    expect(quotePrice(4.99, us, japan, 'JPY', exact)!.decimals).toBe(0);
    expect(quotePrice(4.99, us, japan, 'USD', exact)!.decimals).toBe(2);
  });

  it('is an identity for the base country billed in its own currency', () => {
    const usa = matchPriceTarget('United States')!;
    expect(quotePrice(4.99, us, usa, 'USD', exact)!.amount).toBeCloseTo(
      4.99,
      6,
    );
  });

  it('refuses rather than guessing when the market has no rate', () => {
    // A skipped market is recoverable; a mispriced one is not.
    const noRate = { ...matchPriceTarget('India')!, fx: undefined };
    expect(quotePrice(4.99, us, noRate, 'USD', exact)).toBeNull();
    // Its own currency still works — that path needs no rate at all.
    expect(quotePrice(4.99, us, noRate, 'INR', exact)).not.toBeNull();
  });

  it('refuses a quote currency the dataset has no rate for', () => {
    const india = matchPriceTarget('India')!;
    expect(quotePrice(4.99, us, india, 'ZZZ', exact)).toBeNull();
  });

  it('round-trips a converted price back to the base currency', () => {
    const cambodia = matchPriceTarget('Cambodia')!;
    const usd = quotePrice(4.99, us, cambodia, 'USD', exact)!;
    // Not exact: the dollar figure was rounded to cents on the way out, and
    // a cent of a Cambodian price is a lot of base-currency precision.
    expect(toBaseCurrency(usd.amount, 'USD', us, cambodia)).toBeCloseTo(
      4.99,
      1,
    );
  });
});

describe('the bundled exchange rates', () => {
  it('covers all but a couple of countries', () => {
    const withRate = Object.values(PPP_COUNTRIES).filter(
      (c) => typeof (c as { fx?: number | null }).fx === 'number',
    );
    // Two (Turkmenistan, West Bank and Gaza) have no published rate. Any
    // larger gap than that means the refresh went wrong.
    expect(
      Object.keys(PPP_COUNTRIES).length - withRate.length,
    ).toBeLessThanOrEqual(5);
  });

  it('anchors the dollar at exactly 1', () => {
    expect(getCurrencyRate('USD')).toBe(1);
  });

  it('gives every shared currency one rate for all its members', () => {
    // EUR is quoted by twenty economies; they must not disagree, or a
    // German row and an Irish row would price differently in dollars.
    for (const currency of ['EUR', 'XOF', 'XAF']) {
      const members = Object.values(PPP_COUNTRIES).filter(
        (c) => c.currency === currency,
      );
      const rates = members
        .map((c) => (c as { fx?: number | null }).fx)
        .filter((fx): fx is number => typeof fx === 'number');
      expect(rates.length, currency).toBeGreaterThan(1);
      const spread = Math.max(...rates) / Math.min(...rates);
      expect(spread, currency).toBeLessThan(1.2);
    }
  });
});

describe('percentChange', () => {
  it('reports a drop as negative and a rise as positive', () => {
    expect(percentChange(100, 75)).toBe(-25);
    expect(percentChange(100, 150)).toBe(50);
  });

  it('has no answer without a baseline to compare against', () => {
    expect(percentChange(0, 10)).toBeNull();
  });
});

describe('pppSettingsItem', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to a US base with charm .99 rounding', async () => {
    expect(await pppSettingsItem.getValue()).toEqual(DEFAULT_PPP_SETTINGS);
    expect(DEFAULT_PPP_SETTINGS.baseCountry).toBe('US');
    expect(DEFAULT_PPP_SETTINGS.rounding).toBe('charm99');
  });

  it('round-trips an edited setting', async () => {
    await pppSettingsItem.setValue({
      baseCountry: 'GB',
      rounding: 'nice',
      customFactor: 1.25,
      overwriteFilled: false,
    });
    expect((await pppSettingsItem.getValue()).baseCountry).toBe('GB');
  });
});
