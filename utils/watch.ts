import type { ContentScriptContext } from 'wxt/utils/content-script-context';

interface WatchableItem<T> {
  getValue(): Promise<T>;
  watch(callback: (value: T) => void): () => void;
}

// Content scripts read every setting the same way: load the current value,
// then keep it fresh so options-page edits apply live without a page reload —
// and stop watching if the extension reloads while the tab stays open.
// Returns a getter rather than the value so callers always see the latest one.
export async function watchValue<T>(
  ctx: ContentScriptContext,
  item: WatchableItem<T>,
): Promise<() => T> {
  // Cast because awaiting collapses T to Awaited<T>; no setting is a promise.
  let value = (await item.getValue()) as T;
  const unwatch = item.watch((next) => {
    value = next;
  });
  ctx.onInvalidated(unwatch);
  return () => value;
}
