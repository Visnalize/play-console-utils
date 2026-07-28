export function isReplyField(el: Element): boolean {
  return el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function getFocusedReplyField(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !isReplyField(active)) return null;
  return active;
}

export function findReplyFieldIn(container: Element): HTMLElement | null {
  return (
    Array.from(
      container.querySelectorAll<HTMLElement>('textarea, [contenteditable]'),
    ).find(isReplyField) ?? null
  );
}

export function getReplyText(el: HTMLElement): string {
  return el.tagName === 'TEXTAREA'
    ? (el as HTMLTextAreaElement).value
    : el.innerText;
}

export function setReplyText(el: HTMLElement, text: string) {
  if (el.tagName === 'TEXTAREA') {
    (el as HTMLTextAreaElement).value = text;
  } else {
    el.innerText = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
