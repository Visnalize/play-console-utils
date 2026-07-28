export function flashHighlight(el: Element) {
  el.classList.remove('quote-ext-highlight');
  void (el as HTMLElement).offsetWidth; // force reflow so the animation restarts on repeat captures
  el.classList.add('quote-ext-highlight');
  el.addEventListener(
    'animationend',
    () => el.classList.remove('quote-ext-highlight'),
    { once: true },
  );
}
