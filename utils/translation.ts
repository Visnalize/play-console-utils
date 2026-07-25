// Chrome's on-device Translator/LanguageDetector globals (stable since
// Chrome 138 for many language pairs). Not yet in TS's lib.dom.d.ts, so
// declared here rather than assumed available.
type BuiltInAvailability =
  'unavailable' | 'downloadable' | 'downloading' | 'available';

interface BuiltInTranslator {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface BuiltInTranslatorStatic {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<BuiltInAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<BuiltInTranslator>;
}

interface BuiltInLanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface BuiltInLanguageDetector {
  detect(text: string): Promise<BuiltInLanguageDetectionResult[]>;
  destroy(): void;
}

interface BuiltInLanguageDetectorStatic {
  availability(): Promise<BuiltInAvailability>;
  create(): Promise<BuiltInLanguageDetector>;
}

declare global {
  var Translator: BuiltInTranslatorStatic | undefined;
  var LanguageDetector: BuiltInLanguageDetectorStatic | undefined;
}

export function isTranslationSupported(): boolean {
  return typeof Translator !== 'undefined';
}

// Compares only the primary subtag ("zh" out of "zh-Hans") since detected
// and mapped codes don't always agree on script/region suffixes.
export function languagesMatch(a: string, b: string): boolean {
  return a.split('-')[0].toLowerCase() === b.split('-')[0].toLowerCase();
}

export async function detectLanguage(text: string): Promise<string | null> {
  if (typeof LanguageDetector === 'undefined') return null;
  if ((await LanguageDetector.availability()) === 'unavailable') return null;

  const detector = await LanguageDetector.create();
  try {
    const [best] = await detector.detect(text);
    return best?.detectedLanguage ?? null;
  } finally {
    detector.destroy();
  }
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | null> {
  if (typeof Translator === 'undefined') return null;
  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage,
  });
  if (availability === 'unavailable') return null;

  const translator = await Translator.create({
    sourceLanguage,
    targetLanguage,
  });
  try {
    return await translator.translate(text);
  } finally {
    translator.destroy();
  }
}
