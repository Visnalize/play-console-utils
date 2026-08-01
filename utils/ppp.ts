import { storage } from '@wxt-dev/storage';
import { PPP_COUNTRIES, type PppCountry } from './ppp-data';

// Purchasing-power-parity pricing: given a price in one country's currency,
// work out the price that costs the *same amount of real purchasing power*
// everywhere else.
//
//   internationalDollars = basePrice / basePpp
//   targetPrice          = internationalDollars * targetPpp
//
// That's the whole model, and it needs no exchange rate — a PPP conversion
// factor is already "local currency units per international $". The one
// exception is a row billed in a currency that isn't the market's own; see
// quotePrice().
//
// `customFactor` scales the result. Pure PPP charges the same real purchasing
// power everywhere, which is often lower than a publisher wants; the factor is
// the dial for "a bit above/below parity". It multiplies every market equally,
// the base country included, so the model stays one multiplication with no
// special cases — set it to 1 for untouched PPP.
//
// There is deliberately no "floor the discount at X% of base" knob: that bound
// would need an FX rate on *every* market rather than only the cross-currency
// ones, spreading exchange-rate drift across prices that currently have none.

export type RoundingMode = 'charm99' | 'charm90' | 'nice' | 'exact';

export const ROUNDING_MODES: { value: RoundingMode; label: string }[] = [
  { value: 'charm99', label: 'Charm — ends in .99' },
  { value: 'charm90', label: 'Charm — ends in .90' },
  { value: 'nice', label: 'Nice numbers (2 significant figures)' },
  { value: 'exact', label: 'Exact (no rounding)' },
];

export interface PppSettings {
  /** ISO 3166-1 alpha-2 code the base price is quoted in. */
  baseCountry: string;
  rounding: RoundingMode;
  /** Multiplier on every converted price. 1 = pure PPP. */
  customFactor: number;
  /** Whether filling should overwrite price fields that already have a value. */
  overwriteFilled: boolean;
}

// Half to double covers every sane pricing strategy and is a range a slider
// can actually express. It also means a typo can't quietly produce absurd
// prices — values outside the range clamp rather than apply.
export const MIN_CUSTOM_FACTOR = 0.5;
export const MAX_CUSTOM_FACTOR = 2;
export const CUSTOM_FACTOR_STEP = 0.25;

export const DEFAULT_PPP_SETTINGS: PppSettings = {
  baseCountry: 'US',
  rounding: 'charm99',
  customFactor: 1,
  overwriteFilled: true,
};

/** Falls back to 1 for a missing or nonsensical value rather than zeroing out. */
export function normalizeCustomFactor(value: number | undefined): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return 1;
  return Math.min(
    Math.max(value as number, MIN_CUSTOM_FACTOR),
    MAX_CUSTOM_FACTOR,
  );
}

export const pppSettingsItem = storage.defineItem<PppSettings>(
  'sync:pppSettings',
  { fallback: DEFAULT_PPP_SETTINGS, version: 1 },
);

// A charm ending is only legible on a currency quoted in hundredths and at a
// magnitude where the last two digits still read as "cents". ¥509.99 and
// ₦972.99 are noise, so charm modes fall back to `nice` outside this range.
const CHARM_MAX = 1000;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rounds to two significant figures, then to what the currency can express. */
function niceNumber(value: number, decimals: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  const snapped = Math.round(value / magnitude) * magnitude;
  return Math.max(
    roundTo(snapped, decimals),
    decimals > 0 ? 10 ** -decimals : 1,
  );
}

/** Nearest x.99 / x.90, ties going up. Never returns a non-positive price. */
function charmNumber(value: number, ending: number): number {
  // The two charm values bracketing `value`; `- ending` before flooring so a
  // value just above an ending (4.00 with .99) still sees 3.99 as a candidate
  // rather than jumping a whole unit to 4.99.
  const lower = Math.floor(value - ending) + ending;
  const upper = lower + 1;
  const best =
    Math.abs(upper - value) <= Math.abs(lower - value) ? upper : lower;
  return roundTo(Math.max(best, ending), 2);
}

export function roundPrice(
  value: number,
  decimals: number,
  mode: RoundingMode,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (mode === 'exact') return roundTo(value, decimals);
  if (mode === 'nice') return niceNumber(value, decimals);

  // charm99 / charm90
  if (decimals !== 2 || value >= CHARM_MAX) return niceNumber(value, decimals);
  return charmNumber(value, mode === 'charm99' ? 0.99 : 0.9);
}

export function getPppCountry(code: string): PppCountry | undefined {
  return PPP_COUNTRIES[code.toUpperCase()];
}

export function listPppCountries(): (PppCountry & { code: string })[] {
  return Object.entries(PPP_COUNTRIES)
    .map(([code, country]) => ({ code, ...country }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A pricing target, whether it came from a country row or a currency row. */
export interface PriceTarget {
  /** The market's *own* currency — not necessarily what the row is billed in. */
  currency: string;
  ppp: number;
  /**
   * Local currency units per US dollar. Absent (or null, which is how the
   * dataset spells it) when the World Bank publishes no rate — that market
   * can still be priced in its own currency, just not converted into another.
   */
  fx?: number | null;
  decimals: number;
  /** ISO 3166-1 alpha-2, absent when only the currency could be identified. */
  code?: string;
  name: string;
  /**
   * True when `ppp` is the mean across every country sharing the currency,
   * because the row named a currency but no country we recognise (most EUR
   * rows). The price is representative rather than exact for that market.
   */
  approximate: boolean;
}

/** The PPP-adjusted amount in the target's own currency, before rounding. */
function localAmount(
  basePrice: number,
  base: Pick<PppCountry, 'ppp'>,
  target: Pick<PppCountry, 'ppp'>,
  customFactor?: number,
): number {
  if (!Number.isFinite(basePrice) || basePrice <= 0 || base.ppp <= 0) return 0;
  const internationalDollars = basePrice / base.ppp;
  return (
    internationalDollars * target.ppp * normalizeCustomFactor(customFactor)
  );
}

export function convertPrice(
  basePrice: number,
  base: Pick<PppCountry, 'ppp'>,
  target: Pick<PppCountry, 'ppp' | 'decimals'>,
  options: { rounding: RoundingMode; customFactor?: number },
): number {
  return roundPrice(
    localAmount(basePrice, base, target, options.customFactor),
    target.decimals,
    options.rounding,
  );
}

export interface QuotedPrice {
  amount: number;
  /** The currency the amount is in — the row's, which may not be the market's. */
  currency: string;
  decimals: number;
  /** True when a market exchange rate was needed to get here. */
  converted: boolean;
}

/**
 * The price for a market, expressed in whatever currency its row is billed in.
 *
 * **Play Console does not price every market in its own currency.** Cambodia,
 * Angola and Argentina are billed in USD; much of non-euro Europe in EUR. A
 * PPP factor cannot cross that gap on its own — it says a basket costs
 * `ppp × X` riel and nothing about what a riel is worth in dollars, so writing
 * the riel figure into a USD field overcharges by the exchange rate (for KHR,
 * about four thousand times).
 *
 * Crossing currencies therefore goes through the market rate:
 *
 *   local = intlDollars × ppp(market)      — same real purchasing power
 *   usd   = local / fx(market)             — what that is actually worth
 *   quote = usd × fx(quote currency)
 *
 * When the row already bills in the market's own currency the rate cancels
 * out and this is exactly the old pure-PPP calculation.
 *
 * **Returns null rather than guessing.** Without a rate for either side the
 * honest answer is "can't price this row", and the caller drops it — a
 * skipped market is recoverable, a mispriced one is not. Note the caveat this
 * introduces: a converted price rides on an annual exchange rate and drifts
 * as currencies move, unlike a pure-PPP one, which needs no rate at all.
 */
export function quotePrice(
  basePrice: number,
  base: Pick<PppCountry, 'ppp'>,
  target: PriceTarget,
  quoteCurrency: string | null | undefined,
  options: { rounding: RoundingMode; customFactor?: number },
): QuotedPrice | null {
  const local = localAmount(basePrice, base, target, options.customFactor);
  if (local <= 0) return null;

  const quote = quoteCurrency || target.currency;
  if (quote === target.currency) {
    return {
      amount: roundPrice(local, target.decimals, options.rounding),
      currency: quote,
      decimals: target.decimals,
      converted: false,
    };
  }

  const rate = getCurrencyRate(quote);
  if (rate === undefined || !target.fx) return null;

  const decimals = getCurrencyDecimals(quote) ?? target.decimals;
  return {
    amount: roundPrice((local / target.fx) * rate, decimals, options.rounding),
    currency: quote,
    decimals,
    converted: true,
  };
}

export function formatPrice(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Expresses a quoted price back in the base country's currency — the inverse
 * of quotePrice(). That's what makes a list of twenty currencies comparable
 * at a glance: "INR 249" says nothing next to "BRL 14", but "≈ USD 3.10" next
 * to "≈ USD 2.80" does.
 *
 * Deliberately unrounded beyond the base currency's decimals: this is a
 * read-only comparison figure, never something that gets written to a field,
 * so charm rounding it would only obscure the real spread.
 */
export function toBaseCurrency(
  price: number,
  quoteCurrency: string,
  base: Pick<PppCountry, 'ppp'>,
  target: { ppp: number; currency: string; fx?: number | null },
): number {
  if (!Number.isFinite(price) || price <= 0 || target.ppp <= 0) return 0;

  if (quoteCurrency === target.currency) {
    return (price / target.ppp) * base.ppp;
  }

  const rate = getCurrencyRate(quoteCurrency);
  if (rate === undefined || !rate || !target.fx) return 0;
  // quote -> USD -> the market's own currency -> international dollars.
  const local = (price / rate) * target.fx;
  return (local / target.ppp) * base.ppp;
}

/** Percent difference from `from` to `to`; null when there's no baseline. */
export function percentChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to)) return null;
  return ((to - from) / from) * 100;
}

// Anything that is never a decimal point: ordinary, non-breaking and narrow
// no-break spaces (fr-FR) and the apostrophes de-CH groups with.
const GROUP_ONLY = /[\s\u00a0\u202f'\u2019]/g;

// A run of digits, possibly carrying group and decimal separators.
const PRICE_NUMBER_RE = /\d[\d.,\s\u00a0\u202f'\u2019]*\d|\d/;

/**
 * Reads the number out of a price as Play Console renders it — "INR 100.00",
 * "₹1,234.50", "IDR 15.000", "1 234,56 zł".
 *
 * Which of `.` and `,` is the decimal point depends on the console's display
 * language, so it's inferred rather than assumed:
 *
 *   - both present → the last one is the decimal point (no locale puts the
 *     group separator after it);
 *   - one kind, appearing more than once → all of them are group separators;
 *   - one kind, once, with exactly three digits after it → group separator.
 *     "35,000" and "15.000" are ambiguous in isolation, but a currency with
 *     decimals always renders them ("USD 1,500.00"), so a bare three-digit tail
 *     is grouping every time.
 *
 * Returns null when there's no number at all, which is how an unpriced row
 * ("INR", or an empty cell) is told apart from one priced at zero.
 */
export function parsePriceValue(text: string): number | null {
  const match = PRICE_NUMBER_RE.exec(text ?? '');
  if (!match) return null;

  // Spaces and apostrophes are only ever group separators.
  const raw = match[0].replace(GROUP_ONLY, '');
  const separators = raw.match(/[.,]/g) ?? [];

  let normalized = raw;
  if (separators.length > 0) {
    const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
    const decimalPart = raw.slice(last + 1);
    const bothKinds = new Set(separators).size > 1;
    const isDecimal =
      bothKinds || (separators.length === 1 && decimalPart.length !== 3);

    normalized = isDecimal
      ? `${raw.slice(0, last).replace(/[.,]/g, '')}.${decimalPart}`
      : raw.replace(/[.,]/g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// --- Matching a pricing-table row to a country -----------------------------
//
// Play Console labels price rows with a country name and/or a currency code,
// in the console's own display language. Names are matched first (precise);
// a currency-only row falls back to the mean PPP of the countries using it,
// which is the best available answer for a row like "EUR" that covers twenty
// different economies.

function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// The World Bank's spellings are not Play Console's. Only names that actually
// differ need an entry.
const NAME_ALIASES: Record<string, string> = {
  bahamas: 'BS',
  bolivia: 'BO',
  brunei: 'BN',
  capeverde: 'CV',
  czechrepublic: 'CZ',
  democraticrepublicofthecongo: 'CD',
  egypt: 'EG',
  gambia: 'GM',
  hongkong: 'HK',
  iran: 'IR',
  ivorycoast: 'CI',
  laos: 'LA',
  macao: 'MO',
  macau: 'MO',
  micronesia: 'FM',
  moldova: 'MD',
  myanmar: 'MM',
  netherlands: 'NL',
  russia: 'RU',
  slovakia: 'SK',
  southkorea: 'KR',
  northkorea: 'KP',
  stkittsandnevis: 'KN',
  stlucia: 'LC',
  stvincentandthegrenadines: 'VC',
  swaziland: 'SZ',
  syria: 'SY',
  taiwan: 'TW',
  tanzania: 'TZ',
  turkey: 'TR',
  unitedstatesofamerica: 'US',
  venezuela: 'VE',
  vietnam: 'VN',
  yemen: 'YE',
};

const AMBIGUOUS = Symbol('ambiguous');

function buildNameIndex(): Map<string, string> {
  const index = new Map<string, string | typeof AMBIGUOUS>();

  const add = (key: string, code: string) => {
    if (!key) return;
    const existing = index.get(key);
    if (existing === undefined) index.set(key, code);
    else if (existing !== code) index.set(key, AMBIGUOUS);
  };

  for (const [code, country] of Object.entries(PPP_COUNTRIES)) {
    add(normalizeName(country.name), code);
    // "Korea, Rep." also answers to "Korea" — unless another country claims
    // the same prefix, in which case the key is dropped as ambiguous.
    const [head] = country.name.split(',');
    add(normalizeName(head), code);
  }
  // Aliases are authoritative: they describe what Play Console actually
  // renders, so they overwrite anything the World Bank names collided on.
  // An alias for a country the generator dropped (no recent observation, e.g.
  // Venezuela) is skipped — otherwise the lookup below would resolve a code
  // that isn't in the dataset and matchPriceTarget would read from undefined.
  for (const [key, code] of Object.entries(NAME_ALIASES)) {
    if (PPP_COUNTRIES[code]) index.set(key, code);
    else index.delete(key);
  }

  const resolved = new Map<string, string>();
  for (const [key, code] of index) {
    if (code !== AMBIGUOUS) resolved.set(key, code);
  }
  return resolved;
}

const NAME_INDEX = buildNameIndex();

interface CurrencyGroup {
  ppp: number;
  decimals: number;
  countries: string[];
  /** Units of this currency per US dollar; absent when no member reports one. */
  usdRate?: number;
}

/**
 * `fx` arrives with the dataset, but only after a `pnpm ppp:refresh` that
 * postdates it being added to the generator. Reading it defensively means an
 * older committed dataset still works — cross-currency rows are simply
 * skipped — instead of failing to build.
 */
function fxOf(country: PppCountry): number | undefined {
  const value = (country as PppCountry & { fx?: number | null }).fx;
  return typeof value === 'number' && value > 0 ? value : undefined;
}

/** Median, not mean: one stale member shouldn't drag a shared rate around. */
function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildCurrencyIndex(): Map<string, CurrencyGroup> {
  const groups = new Map<
    string,
    { ppps: number[]; rates: number[]; decimals: number; countries: string[] }
  >();
  for (const [code, country] of Object.entries(PPP_COUNTRIES)) {
    const group = groups.get(country.currency) ?? {
      ppps: [],
      rates: [],
      decimals: country.decimals,
      countries: [],
    };
    group.ppps.push(country.ppp);
    const fx = fxOf(country);
    // Every member of a shared currency quotes the same rate against the
    // dollar, so any of them answers for the group; several is just redundancy
    // against a missing or stale figure.
    if (fx !== undefined) group.rates.push(fx);
    group.countries.push(code);
    groups.set(country.currency, group);
  }

  const index = new Map<string, CurrencyGroup>();
  for (const [currency, group] of groups) {
    index.set(currency, {
      ppp: group.ppps.reduce((sum, p) => sum + p, 0) / group.ppps.length,
      decimals: group.decimals,
      countries: group.countries,
      usdRate: currency === 'USD' ? 1 : median(group.rates),
    });
  }
  return index;
}

const CURRENCY_INDEX = buildCurrencyIndex();

/** Units of `currency` per US dollar, or undefined if the data has no rate. */
export function getCurrencyRate(currency: string): number | undefined {
  return CURRENCY_INDEX.get(currency)?.usdRate;
}

export function getCurrencyDecimals(currency: string): number | undefined {
  return CURRENCY_INDEX.get(currency)?.decimals;
}

const CURRENCY_CODE_RE = /\b[A-Z]{3}\b/g;

/**
 * Identifies which market a pricing-table row is for, from its visible text.
 * Returns null when the row names neither a country we know nor a currency.
 */
export function matchPriceTarget(rowText: string): PriceTarget | null {
  const normalized = normalizeName(rowText);

  // Longest name first so "United States" isn't shadowed by a shorter key that
  // also happens to appear in the row.
  let bestKey = '';
  for (const key of NAME_INDEX.keys()) {
    if (key.length > bestKey.length && normalized.includes(key)) bestKey = key;
  }
  if (bestKey) {
    const code = NAME_INDEX.get(bestKey)!;
    const country = PPP_COUNTRIES[code];
    return {
      currency: country.currency,
      ppp: country.ppp,
      fx: fxOf(country),
      decimals: country.decimals,
      code,
      name: country.name,
      approximate: false,
    };
  }

  for (const match of rowText.match(CURRENCY_CODE_RE) ?? []) {
    const group = CURRENCY_INDEX.get(match);
    if (!group) continue;
    // A single-country currency identifies its country exactly; a shared one
    // (EUR, XOF, XCD) can only offer the mean across its members.
    const sole = group.countries.length === 1 ? group.countries[0] : undefined;
    return {
      currency: match,
      ppp: group.ppp,
      fx: group.usdRate,
      decimals: group.decimals,
      code: sole,
      name: sole ? PPP_COUNTRIES[sole].name : match,
      approximate: sole === undefined,
    };
  }

  return null;
}
