export const UNKNOWN_AUTHOR = 'Unknown Author';
export const UNKNOWN_DATE = 'Unknown Date';

export function extractAuthorFromContainer(
  container: Element | null | undefined,
): string {
  const text = container
    ?.querySelector<HTMLElement>('.author-display-name')
    ?.innerText?.trim();
  return text || UNKNOWN_AUTHOR;
}

export function extractDateFromContainer(
  container: Element | null | undefined,
): string {
  const raw = container
    ?.querySelector<HTMLElement>('.last-update-time')
    ?.innerText?.trim();
  if (!raw) return UNKNOWN_DATE;
  return raw.includes(',') ? raw.split(',').slice(0, 2).join(',').trim() : raw;
}

export function getActiveAppLabel(): string {
  return document.querySelector<HTMLElement>('.active-app-button')?.ariaLabel ?? '';
}
