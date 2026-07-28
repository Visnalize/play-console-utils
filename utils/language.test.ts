import { describe, expect, it } from 'vitest';
import { extractTargetLanguageCode } from './language';

describe('extractTargetLanguageCode', () => {
  it('maps the "Translated from X -" banner to a language code', () => {
    expect(extractTargetLanguageCode('Translated from Portuguese -')).toBe(
      'pt',
    );
  });

  it('trims surrounding whitespace before matching', () => {
    expect(extractTargetLanguageCode('  Translated from Spanish -  ')).toBe(
      'es',
    );
  });

  it('returns null when there is no banner', () => {
    expect(extractTargetLanguageCode(null)).toBeNull();
    expect(extractTargetLanguageCode(undefined)).toBeNull();
    expect(extractTargetLanguageCode('')).toBeNull();
  });

  it('returns null for an unrecognized language name', () => {
    expect(extractTargetLanguageCode('Translated from Klingon -')).toBeNull();
  });

  it('returns null for unrelated text', () => {
    expect(extractTargetLanguageCode('See original')).toBeNull();
  });
});
