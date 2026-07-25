import { getLanguageCodeFromName } from './language-names';

export const ORIGINAL_LANGUAGE_HEADER_SELECTOR =
  '[debug-id="original-language-area-header"]';

const TRANSLATED_FROM_RE = /Translated from\s+(.+?)\s*-\s*$/i;

// Play Console only renders this banner when the review's original language
// differs from the console's display language, so its absence means the
// review is already in the console's language — treated by callers as "no
// translation needed", not as a detection failure.
export function extractTargetLanguageCode(
  headerText: string | null | undefined,
): string | null {
  const match = headerText?.trim().match(TRANSLATED_FROM_RE);
  if (!match) return null;
  return getLanguageCodeFromName(match[1]);
}
