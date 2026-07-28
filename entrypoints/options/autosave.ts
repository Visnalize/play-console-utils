import {
  nextTick,
  reactive,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue';

const SAVED_MESSAGE = 'Saved';
const SAVED_VISIBLE_MS = 1500;
const DEBOUNCE_MS = 400;

interface ListItem<T> {
  getValue(): Promise<T[]>;
  setValue(value: T[]): Promise<void>;
}

export function useSaveStatus() {
  const status = ref('');

  function flashSaved() {
    status.value = SAVED_MESSAGE;
    setTimeout(() => {
      if (status.value === SAVED_MESSAGE) status.value = '';
    }, SAVED_VISIBLE_MS);
  }

  function showError(message: string) {
    status.value = message;
  }

  return { status, flashSaved, showError };
}

// The editable-list sections (app mappings, canned replies) are the same
// component modulo their row shape: load rows on mount, autosave on edit after
// a debounce, save immediately on removal, and focus the new row's first input.
export function useEditableList<T extends object>(config: {
  item: ListItem<T>;
  /** Drops incomplete rows and trims whitespace before persisting. */
  sanitize: (rows: T[]) => T[];
  /** Shown when chrome.storage.sync rejects the write (8KB per-item cap). */
  quotaMessage: string;
}) {
  const rows = reactive<T[]>([]) as T[];
  const { status, flashSaved, showError } = useSaveStatus();
  const firstInputs: (HTMLInputElement | null)[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let loaded = false;

  // Bound via :ref in the template so a newly added row can be focused.
  function setFirstInputRef(
    el: Element | ComponentPublicInstance | null,
    i: number,
  ) {
    firstInputs[i] = el instanceof HTMLInputElement ? el : null;
  }

  async function load() {
    const saved = await config.item.getValue();
    rows.push(...saved.map((row) => ({ ...row })));
    loaded = true;
  }

  function addRow(row: T) {
    rows.push(row);
    void nextTick(() => firstInputs[rows.length - 1]?.focus());
  }

  async function persist() {
    try {
      await config.item.setValue(config.sanitize(rows));
      flashSaved();
    } catch (err) {
      console.error('Play Console Utils: failed to save settings.', err);
      showError(config.quotaMessage);
    }
  }

  function removeRow(i: number) {
    rows.splice(i, 1);
    clearTimeout(saveTimer);
    void persist();
  }

  watch(
    rows,
    () => {
      if (!loaded) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void persist(), DEBOUNCE_MS);
    },
    { deep: true },
  );

  return { rows, status, load, addRow, removeRow, setFirstInputRef };
}
