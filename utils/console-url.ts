export const CONSOLE_URL_MATCH_PATTERN = 'https://play.google.com/console/*';

export function isConsoleUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'https://play.google.com' &&
      parsed.pathname.startsWith('/console/')
    );
  } catch {
    return false;
  }
}
