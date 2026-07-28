<template>
  <section>
    <h2><Plug :size="16" /> App label → slug mapping</h2>
    <p>
      Map the app label shown in Play Console (the active app selector) to the
      slug you want used in copied review JSON. Parsing a review copies its JSON
      using the matching slug below — unmapped apps fall back to an
      auto-generated slug.
    </p>
    <table>
      <thead>
        <tr>
          <th>Play Console app label</th>
          <th>Slug</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td>
            <input
              :ref="(el) => setLabelRef(el, i)"
              v-model="row.label"
              type="text"
              placeholder="e.g. Brick 1100"
            />
          </td>
          <td>
            <input
              v-model="row.slug"
              type="text"
              placeholder="e.g. brick1100"
            />
          </td>
          <td>
            <button
              type="button"
              aria-label="Remove mapping"
              @click="removeRow(i)"
            >
              <Trash2 :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button type="button" class="add-row" @click="addRow">
      <Plus :size="16" /> Add mapping
    </button>
    <p role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>

<script setup lang="ts">
import {
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue';
import { Plug, Plus, Trash2 } from '@lucide/vue';
import { appMappingsItem, type AppMapping } from '@/utils/app-mapping';

const rows = reactive<AppMapping[]>([]);
const status = ref('');
const labelInputs: (HTMLInputElement | null)[] = [];
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let loaded = false;

function setLabelRef(el: Element | ComponentPublicInstance | null, i: number) {
  labelInputs[i] = el instanceof HTMLInputElement ? el : null;
}

onMounted(async () => {
  const saved = await appMappingsItem.getValue();
  rows.push(...saved.map((m) => ({ ...m })));
  loaded = true;
});

function addRow() {
  rows.push({ label: '', slug: '' });
  void nextTick(() => labelInputs[rows.length - 1]?.focus());
}

async function persist() {
  const cleaned = rows
    .map((r) => ({ label: r.label.trim(), slug: r.slug.trim() }))
    .filter((r) => r.label !== '' && r.slug !== '');
  try {
    await appMappingsItem.setValue(cleaned);
    status.value = 'Saved';
    setTimeout(() => {
      if (status.value === 'Saved') status.value = '';
    }, 1500);
  } catch (err) {
    // chrome.storage.sync caps each item at 8KB — a large mapping list can exceed
    // that even though the equivalent chrome.storage.local write always succeeded.
    console.error('Play Console Utils: failed to save app mappings.', err);
    status.value =
      'Save failed — you may have too many mappings for Chrome sync storage. Remove some and try again.';
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
    saveTimer = setTimeout(() => void persist(), 400);
  },
  { deep: true },
);
</script>
