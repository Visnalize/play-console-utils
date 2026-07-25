import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectLanguage,
  isTranslationSupported,
  languagesMatch,
  translateText,
} from './translation';

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Translator;
  delete (globalThis as Record<string, unknown>).LanguageDetector;
});

describe('languagesMatch', () => {
  it('matches identical codes', () => {
    expect(languagesMatch('pt', 'pt')).toBe(true);
  });

  it('ignores case and script/region subtags', () => {
    expect(languagesMatch('EN', 'en')).toBe(true);
    expect(languagesMatch('zh-Hans', 'zh')).toBe(true);
  });

  it('rejects different primary subtags', () => {
    expect(languagesMatch('en', 'pt')).toBe(false);
  });
});

describe('isTranslationSupported', () => {
  it('is false when the global Translator API is absent', () => {
    expect(isTranslationSupported()).toBe(false);
  });

  it('is true when the global Translator API is present', () => {
    (globalThis as Record<string, unknown>).Translator = {};
    expect(isTranslationSupported()).toBe(true);
  });
});

describe('detectLanguage', () => {
  it('returns null when LanguageDetector is unavailable', async () => {
    await expect(detectLanguage('hello')).resolves.toBeNull();
  });

  it('returns null when availability reports unavailable', async () => {
    (globalThis as Record<string, unknown>).LanguageDetector = {
      availability: vi.fn().mockResolvedValue('unavailable'),
      create: vi.fn(),
    };
    await expect(detectLanguage('hello')).resolves.toBeNull();
  });

  it('detects and destroys the detector', async () => {
    const destroy = vi.fn();
    const detect = vi.fn().mockResolvedValue([{ detectedLanguage: 'pt', confidence: 0.9 }]);
    (globalThis as Record<string, unknown>).LanguageDetector = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ detect, destroy }),
    };

    await expect(detectLanguage('ola')).resolves.toBe('pt');
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe('translateText', () => {
  it('returns null when Translator is unavailable', async () => {
    await expect(translateText('hi', 'en', 'pt')).resolves.toBeNull();
  });

  it('returns null when availability reports unavailable', async () => {
    (globalThis as Record<string, unknown>).Translator = {
      availability: vi.fn().mockResolvedValue('unavailable'),
      create: vi.fn(),
    };
    await expect(translateText('hi', 'en', 'pt')).resolves.toBeNull();
  });

  it('translates and destroys the translator', async () => {
    const destroy = vi.fn();
    const translate = vi.fn().mockResolvedValue('ola');
    (globalThis as Record<string, unknown>).Translator = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ translate, destroy }),
    };

    await expect(translateText('hi', 'en', 'pt')).resolves.toBe('ola');
    expect(translate).toHaveBeenCalledWith('hi');
    expect(destroy).toHaveBeenCalledOnce();
  });
});
