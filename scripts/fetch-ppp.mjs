#!/usr/bin/env node
// Regenerates utils/ppp-data.ts from the World Bank's PPP conversion factor
// indicator (PA.NUS.PPP — "local currency units per international $").
//
// The dataset is committed rather than fetched at runtime: the extension then
// needs no extra host permission, works offline, and shows users no new
// install-time warning. The tradeoff is that the numbers only move when
// somebody reruns this script — `pnpm ppp:refresh`.
//
// World Bank publishes PPP against ISO-3166 countries but says nothing about
// which currency each one prices in, so CURRENCY_BY_COUNTRY below is the one
// hand-maintained input. A country missing from it is dropped from the output
// (and reported), because a PPP factor without its currency can't be rendered
// as a price.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const INDICATOR = 'PA.NUS.PPP';
// Official exchange rate (LCU per US$, period average). Needed because Play
// Console does not price every market in its own currency — Cambodia, Angola
// and Argentina are billed in USD, and much of non-euro Europe in EUR. A PPP
// factor alone cannot cross currencies: it says what a basket costs in KHR,
// not what that is worth in dollars. See utils/ppp.ts's quotePrice().
const FX_INDICATOR = 'PA.NUS.FCRF';
const COUNTRY_URL =
  'https://api.worldbank.org/v2/country?format=json&per_page=400';

// Both indicators are fetched as a date range and reduced to each country's
// latest year here, rather than asking the API for it with `mrnev=1`. That
// parameter is not reliable — it has spent long stretches answering 400/502
// while plain date-range queries kept working — and the range is needed for
// the exchange rates anyway, so one shape covers both.
const HISTORY_YEARS = 15;

const OUT_PATH = fileURLToPath(
  new URL('../utils/ppp-data.ts', import.meta.url),
);

// ISO 3166-1 alpha-2 -> ISO 4217. De-facto currency, i.e. what a store would
// actually bill in: Ecuador and El Salvador are USD, not their retired ones.
const CURRENCY_BY_COUNTRY = {
  AD: 'EUR',
  AE: 'AED',
  AF: 'AFN',
  AG: 'XCD',
  AI: 'XCD',
  AL: 'ALL',
  AM: 'AMD',
  AO: 'AOA',
  AR: 'ARS',
  AS: 'USD',
  AT: 'EUR',
  AU: 'AUD',
  AW: 'AWG',
  AZ: 'AZN',
  BA: 'BAM',
  BB: 'BBD',
  BD: 'BDT',
  BE: 'EUR',
  BF: 'XOF',
  BG: 'BGN',
  BH: 'BHD',
  BI: 'BIF',
  BJ: 'XOF',
  BM: 'BMD',
  BN: 'BND',
  BO: 'BOB',
  BQ: 'USD',
  BR: 'BRL',
  BS: 'BSD',
  BT: 'BTN',
  BW: 'BWP',
  BY: 'BYN',
  BZ: 'BZD',
  CA: 'CAD',
  CD: 'CDF',
  CF: 'XAF',
  CG: 'XAF',
  CH: 'CHF',
  CI: 'XOF',
  CL: 'CLP',
  CM: 'XAF',
  CN: 'CNY',
  CO: 'COP',
  CR: 'CRC',
  CU: 'CUP',
  CV: 'CVE',
  CW: 'ANG',
  CY: 'EUR',
  CZ: 'CZK',
  DE: 'EUR',
  DJ: 'DJF',
  DK: 'DKK',
  DM: 'XCD',
  DO: 'DOP',
  DZ: 'DZD',
  EC: 'USD',
  EE: 'EUR',
  EG: 'EGP',
  ER: 'ERN',
  ES: 'EUR',
  ET: 'ETB',
  FI: 'EUR',
  FJ: 'FJD',
  FM: 'USD',
  FO: 'DKK',
  FR: 'EUR',
  GA: 'XAF',
  GB: 'GBP',
  GD: 'XCD',
  GE: 'GEL',
  GH: 'GHS',
  GI: 'GIP',
  GL: 'DKK',
  GM: 'GMD',
  GN: 'GNF',
  GQ: 'XAF',
  GR: 'EUR',
  GT: 'GTQ',
  GU: 'USD',
  GW: 'XOF',
  GY: 'GYD',
  HK: 'HKD',
  HN: 'HNL',
  HR: 'EUR',
  HT: 'HTG',
  HU: 'HUF',
  ID: 'IDR',
  IE: 'EUR',
  IL: 'ILS',
  IM: 'GBP',
  IN: 'INR',
  IQ: 'IQD',
  IR: 'IRR',
  IS: 'ISK',
  IT: 'EUR',
  JE: 'GBP',
  JM: 'JMD',
  JO: 'JOD',
  JP: 'JPY',
  KE: 'KES',
  KG: 'KGS',
  KH: 'KHR',
  KI: 'AUD',
  KM: 'KMF',
  KN: 'XCD',
  KP: 'KPW',
  KR: 'KRW',
  KW: 'KWD',
  KY: 'KYD',
  KZ: 'KZT',
  LA: 'LAK',
  LB: 'LBP',
  LC: 'XCD',
  LI: 'CHF',
  LK: 'LKR',
  LR: 'LRD',
  LS: 'LSL',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  LY: 'LYD',
  MA: 'MAD',
  MC: 'EUR',
  MD: 'MDL',
  ME: 'EUR',
  MG: 'MGA',
  MH: 'USD',
  MK: 'MKD',
  ML: 'XOF',
  MM: 'MMK',
  MN: 'MNT',
  MO: 'MOP',
  MP: 'USD',
  MR: 'MRU',
  MT: 'EUR',
  MU: 'MUR',
  MV: 'MVR',
  MW: 'MWK',
  MX: 'MXN',
  MY: 'MYR',
  MZ: 'MZN',
  NA: 'NAD',
  NC: 'XPF',
  NE: 'XOF',
  NG: 'NGN',
  NI: 'NIO',
  NL: 'EUR',
  NO: 'NOK',
  NP: 'NPR',
  NR: 'AUD',
  NZ: 'NZD',
  OM: 'OMR',
  PA: 'PAB',
  PE: 'PEN',
  PF: 'XPF',
  PG: 'PGK',
  PH: 'PHP',
  PK: 'PKR',
  PL: 'PLN',
  PR: 'USD',
  PS: 'ILS',
  PT: 'EUR',
  PW: 'USD',
  PY: 'PYG',
  QA: 'QAR',
  RO: 'RON',
  RS: 'RSD',
  RU: 'RUB',
  RW: 'RWF',
  SA: 'SAR',
  SB: 'SBD',
  SC: 'SCR',
  SD: 'SDG',
  SE: 'SEK',
  SG: 'SGD',
  SI: 'EUR',
  SK: 'EUR',
  SL: 'SLE',
  SM: 'EUR',
  SN: 'XOF',
  SO: 'SOS',
  SR: 'SRD',
  SS: 'SSP',
  ST: 'STN',
  SV: 'USD',
  SX: 'ANG',
  SY: 'SYP',
  SZ: 'SZL',
  TC: 'USD',
  TD: 'XAF',
  TG: 'XOF',
  TH: 'THB',
  TJ: 'TJS',
  TL: 'USD',
  TM: 'TMT',
  TN: 'TND',
  TO: 'TOP',
  TR: 'TRY',
  TT: 'TTD',
  TV: 'AUD',
  TW: 'TWD',
  TZ: 'TZS',
  UA: 'UAH',
  UG: 'UGX',
  US: 'USD',
  UY: 'UYU',
  UZ: 'UZS',
  VC: 'XCD',
  VE: 'VES',
  VG: 'USD',
  VI: 'USD',
  VN: 'VND',
  VU: 'VUV',
  WS: 'WST',
  XK: 'EUR',
  YE: 'YER',
  ZA: 'ZAR',
  ZM: 'ZMW',
  ZW: 'ZWG',
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await res.json();
  if (!Array.isArray(body) || !Array.isArray(body[1])) {
    throw new Error(`Unexpected World Bank response shape for ${url}`);
  }
  return body[1];
}

// The indicator endpoint mixes real countries with aggregates ("Euro area",
// "Sub-Saharan Africa"). Only the country endpoint distinguishes them —
// aggregates carry region id "NA".
async function getRealCountryCodes() {
  const countries = await getJson(COUNTRY_URL);
  return new Set(
    countries.filter((c) => c.region?.id !== 'NA').map((c) => c.iso2Code),
  );
}

// How many decimal places the currency is actually quoted in — JPY/KRW/VND
// price in whole units, KWD/BHD in three. Intl knows this, so it doesn't need
// to be another hand-maintained table.
function currencyDecimals(currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
}

// Significant digits, not decimal places: hyperinflated currencies report
// factors like 2.7e-11, which fixed-point rounding would flatten to zero.
function round(value) {
  return Number(value.toPrecision(8));
}

// A PPP factor is quoted in the local currency of its year. Countries that
// have redenominated since — Venezuela dropped fourteen zeros across three
// reforms after its 2011 observation — would price absurdly, and a decade-old
// factor is stale even without a reform. Older observations are dropped and
// reported rather than shipped.
const MAX_AGE_YEARS = 10;

async function getHistory(indicator, fromYear, toYear) {
  return getJson(
    `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&date=${fromYear}:${toYear}`,
  );
}

/** Each country's most recent usable observation, as `{value, year}`. */
function latestByCountry(observations) {
  const latest = new Map();
  for (const obs of observations) {
    const code = obs.country?.id;
    const year = Number(obs.date);
    if (typeof obs.value !== 'number' || obs.value <= 0) continue;
    if (!code || !Number.isFinite(year)) continue;
    const seen = latest.get(code);
    if (!seen || year > seen.year) latest.set(code, { value: obs.value, year });
  }
  return latest;
}

/**
 * Exchange rates keyed `${code}:${year}`.
 *
 * Kept as a full history because each country's PPP observation is from its
 * own year, and the derived price level (`ppp / fx`) is only meaningful when
 * both come from the same one. Pairing a 2023 PPP with a 2024 rate would be
 * wildly wrong for a fast-inflating currency — Argentina, exactly the market
 * that needs this.
 */
function ratesByCountryYear(observations) {
  const rates = new Map();
  for (const obs of observations) {
    if (typeof obs.value !== 'number' || obs.value <= 0) continue;
    rates.set(`${obs.country?.id}:${obs.date}`, obs.value);
  }
  return rates;
}

/** The rate for that country's PPP year, else the closest year we do have. */
function rateFor(rates, code, year) {
  const exact = rates.get(`${code}:${year}`);
  if (exact !== undefined) return { fx: exact, fxYear: year };

  for (let gap = 1; gap <= MAX_AGE_YEARS; gap++) {
    for (const candidate of [year - gap, year + gap]) {
      const value = rates.get(`${code}:${candidate}`);
      if (value !== undefined) return { fx: value, fxYear: candidate };
    }
  }
  return null;
}

async function main() {
  const toYear = new Date().getFullYear();
  const fromYear = toYear - HISTORY_YEARS;

  const [realCodes, pppHistory, fxHistory] = await Promise.all([
    getRealCountryCodes(),
    getHistory(INDICATOR, fromYear, toYear),
    getHistory(FX_INDICATOR, fromYear, toYear),
  ]);

  const names = new Map(
    pppHistory
      .filter((obs) => obs.country?.id)
      .map((obs) => [obs.country.id, obs.country.value.trim()]),
  );
  const latestPpp = new Map(
    [...latestByCountry(pppHistory)].filter(([code]) => realCodes.has(code)),
  );
  if (latestPpp.size === 0) {
    throw new Error(
      `No usable ${INDICATOR} observations in ${fromYear}-${toYear}.`,
    );
  }

  const newestYear = Math.max(...[...latestPpp.values()].map((o) => o.year));
  const minYear = newestYear - MAX_AGE_YEARS;
  const rates = ratesByCountryYear(fxHistory);

  const rows = [];
  const missingCurrency = [];
  const stale = [];
  const missingRate = [];
  const mismatchedRateYear = [];

  for (const [code, observation] of latestPpp) {
    const { year } = observation;
    const name = names.get(code) ?? code;

    if (year < minYear) {
      stale.push(`${code} (${name}) — ${year}`);
      continue;
    }

    const currency = CURRENCY_BY_COUNTRY[code];
    if (!currency) {
      missingCurrency.push(`${code} (${name})`);
      continue;
    }

    // A country that bills in dollars needs no rate to reach dollars, and the
    // World Bank doesn't publish one for the US itself.
    const rate =
      currency === 'USD' ? { fx: 1, fxYear: year } : rateFor(rates, code, year);

    if (!rate) missingRate.push(`${code} (${name})`);
    else if (rate.fxYear !== year) {
      mismatchedRateYear.push(
        `${code} (${name}) — PPP ${year}, rate ${rate.fxYear}`,
      );
    }

    rows.push({
      code,
      name,
      currency,
      decimals: currencyDecimals(currency),
      ppp: round(observation.value),
      year,
      fx: rate ? round(rate.fx) : null,
    });
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));

  if (!rows.some((r) => r.code === 'US')) {
    throw new Error(
      'No US observation — the default base country would break.',
    );
  }

  const years = rows.map((r) => r.year);
  const entries = rows
    .map(
      (r) =>
        `  ${r.code}: { name: ${JSON.stringify(r.name)}, currency: '${r.currency}', decimals: ${r.decimals}, ppp: ${r.ppp}, fx: ${r.fx}, year: ${r.year} },`,
    )
    .join('\n');

  const file = `// GENERATED FILE — do not edit by hand.
// Regenerate with \`pnpm ppp:refresh\` (scripts/fetch-ppp.mjs).
//
// Sources, both World Bank, both taken from the same year per country:
//   ${INDICATOR}    — PPP conversion factor, GDP (LCU per international $)
//   ${FX_INDICATOR}  — official exchange rate (LCU per US$, period average)
//
// Each country reports its own most recent non-empty year, so \`year\` varies
// by row. \`fx\` exists so a market can be priced in a currency that isn't its
// own — Play Console bills several countries in USD or EUR — which PPP alone
// cannot express. It is null where the World Bank publishes no rate.

export interface PppCountry {
  /** Country name as the World Bank spells it. */
  name: string;
  /** ISO 4217 code the country prices in. */
  currency: string;
  /** Decimal places the currency is quoted in (0 for JPY, 3 for KWD). */
  decimals: number;
  /** Local currency units per international dollar. */
  ppp: number;
  /**
   * Local currency units per US dollar, at the market rate, for the same year
   * as \`ppp\`. Null when unpublished — such a market can still be priced in
   * its own currency, just not converted into another one.
   */
  fx: number | null;
  /** Year the observation is from. */
  year: number;
}

export const PPP_DATA_SOURCE = {
  indicator: '${INDICATOR}',
  fxIndicator: '${FX_INDICATOR}',
  name: 'World Bank — PPP conversion factor, GDP',
  countries: ${rows.length},
  withExchangeRate: ${rows.filter((r) => r.fx !== null).length},
  earliestYear: ${Math.min(...years)},
  latestYear: ${Math.max(...years)},
};

export const PPP_COUNTRIES: Record<string, PppCountry> = {
${entries}
};
`;

  await writeFile(OUT_PATH, file);

  console.log(`Wrote ${rows.length} countries to utils/ppp-data.ts`);
  console.log(`Years ${Math.min(...years)}–${Math.max(...years)}`);
  if (stale.length > 0) {
    console.warn(
      `\nDropped ${stale.length} country/countries whose latest observation predates ${minYear}:\n  ${stale.join('\n  ')}`,
    );
  }
  if (missingCurrency.length > 0) {
    console.warn(
      `\nDropped ${missingCurrency.length} country/countries with PPP data but no entry in CURRENCY_BY_COUNTRY:\n  ${missingCurrency.join('\n  ')}\n` +
        'Add them to the map in this script if they should be priced.',
    );
  }
  if (missingRate.length > 0) {
    console.warn(
      `\n${missingRate.length} country/countries have no ${FX_INDICATOR} rate. They can still be priced in their own currency, but not in a different one:\n  ${missingRate.join('\n  ')}`,
    );
  }
  if (mismatchedRateYear.length > 0) {
    console.warn(
      `\n${mismatchedRateYear.length} country/countries fell back to a rate from a different year than their PPP figure. The derived price level is approximate for these:\n  ${mismatchedRateYear.join('\n  ')}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
