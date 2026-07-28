<template>
  <section>
    <h2><MessageSquareQuote :size="16" /> Canned reply templates</h2>
    <p class="hint">
      Use <code>{author}</code>, <code>{date}</code>, and <code>{app}</code> —
      they're filled in from the review you're replying to when you pick a
      template.
    </p>
    <table>
      <thead>
        <tr>
          <th>Label</th>
          <th>Reply content</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="row.id">
          <td>
            <input
              :ref="(el) => setLabelRef(el, i)"
              v-model="row.label"
              type="text"
              placeholder="e.g. Already fixed"
            />
          </td>
          <td>
            <textarea
              v-model="row.content"
              rows="3"
              placeholder="e.g. Hi {author}, thanks for the report — this was fixed in the latest update. Please try updating {app}!"
            ></textarea>
          </td>
          <td>
            <button
              type="button"
              aria-label="Remove canned reply"
              @click="removeRow(i)"
            >
              <Trash2 :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button type="button" class="add-row" @click="addRow">
      <Plus :size="16" /> Add canned reply
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
import { MessageSquareQuote, Plus, Trash2 } from '@lucide/vue';
import {
  cannedRepliesItem,
  createCannedReply,
  type CannedReply,
} from '@/utils/canned-replies';

const rows = reactive<CannedReply[]>([]);
const status = ref('');
const labelInputs: (HTMLInputElement | null)[] = [];
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let loaded = false;

function setLabelRef(el: Element | ComponentPublicInstance | null, i: number) {
  labelInputs[i] = el instanceof HTMLInputElement ? el : null;
}

onMounted(async () => {
  const saved = await cannedRepliesItem.getValue();
  rows.push(...saved.map((r) => ({ ...r })));
  loaded = true;
});

function addRow() {
  rows.push(createCannedReply('', ''));
  void nextTick(() => labelInputs[rows.length - 1]?.focus());
}

async function persist() {
  const cleaned = rows
    .map((r) => ({ id: r.id, label: r.label.trim(), content: r.content.trim() }))
    .filter((r) => r.label !== '');
  try {
    await cannedRepliesItem.setValue(cleaned);
    status.value = 'Saved';
    setTimeout(() => {
      if (status.value === 'Saved') status.value = '';
    }, 1500);
  } catch (err) {
    // chrome.storage.sync caps each item at 8KB — a large template library
    // can exceed that even though the equivalent chrome.storage.local write
    // always succeeded.
    console.error('Play Console Utils: failed to save canned replies.', err);
    status.value =
      'Save failed — you may have too many canned replies for Chrome sync storage. Remove some and try again.';
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
