// Play Console doesn't render every clickable control as a native <button> —
// e.g. the review-list paginator's prev/next controls are a `material-button`
// custom element — so this searches both instead of assuming native buttons.
const BUTTON_SELECTOR = 'button, material-button';

export function findButtonByText(
  scope: ParentNode,
  matches: string[],
): HTMLElement | undefined {
  return Array.from(
    scope.querySelectorAll<HTMLElement>(BUTTON_SELECTOR),
  ).find((btn) => {
    // Icon-only buttons (e.g. paginator prev/next) have no visible text, only
    // an aria-label — check both so one matcher covers labeled and icon buttons.
    const txt = `${btn.textContent ?? ''} ${btn.getAttribute('aria-label') ?? ''}`
      .trim()
      .toLowerCase();
    return matches.some((match) => txt.includes(match));
  });
}

// Custom button elements don't necessarily expose the native
// HTMLButtonElement.disabled IDL property, so check the attribute forms
// Angular Material-style components actually reflect it through too.
export function isButtonDisabled(btn: HTMLElement): boolean {
  return (
    (btn as HTMLButtonElement).disabled === true ||
    btn.hasAttribute('disabled') ||
    btn.getAttribute('aria-disabled') === 'true'
  );
}
