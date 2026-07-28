<template>
  <section>
    <h2><Keyboard :size="16" /> Keyboard shortcuts</h2>

    <div v-for="row in keyShortcutRows" :key="row.label" class="shortcut-row">
      <span class="shortcut-label">{{ row.label }}</span>
      <ShortcutRecorder
        :model-value="row.current"
        :default-value="row.fallback"
        @update:model-value="row.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label"
        >Parse review (modifier + click on review text)</span
      >
      <span class="shortcut-modifiers">
        <label
          ><input v-model="parseReviewModifier.ctrlOrMeta" type="checkbox" />
          Ctrl/⌘</label
        >
        <label
          ><input v-model="parseReviewModifier.shift" type="checkbox" />
          Shift</label
        >
        <label
          ><input v-model="parseReviewModifier.alt" type="checkbox" />
          Alt</label
        >
        <button type="button" class="reset" @click="resetParseReviewModifier">
          <RotateCcw :size="14" /> Reset
        </button>
      </span>
    </div>
    <p v-if="!hasAnyModifier(parseReviewModifier)" class="warning">
      Select at least one modifier — parsing stays off until you do.
    </p>

    <div class="shortcut-row">
      <label
        ><input v-model="autoTranslateReply" type="checkbox" /> Translate reply
        to match the review's language before publishing</label
      >
    </div>
    <p class="hint">
      Uses Chrome's built-in on-device translation. Requires a Chrome version
      that supports it — falls back to publishing your reply as typed otherwise.
    </p>

    <p role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { Keyboard, RotateCcw } from '@lucide/vue';
import ShortcutRecorder from './ShortcutRecorder.vue';
import { useSaveStatus } from './autosave';
import {
  autoTranslateReplyItem,
  cannedReplyShortcutItem,
  DEFAULT_CANNED_REPLY_SHORTCUT,
  DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
  DEFAULT_NEXT_REVIEW_SHORTCUT,
  DEFAULT_PARSE_REVIEW_MODIFIER,
  DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
  DEFAULT_PREV_REVIEW_SHORTCUT,
  DEFAULT_QUICK_REPLY_SHORTCUT,
  hasAnyModifier,
  nextReviewPageShortcutItem,
  nextReviewShortcutItem,
  parseReviewModifierItem,
  prevReviewPageShortcutItem,
  prevReviewShortcutItem,
  quickReplyShortcutItem,
  type KeyShortcut,
  type ModifierKeys,
} from '@/utils/shortcuts';

interface ShortcutItem {
  getValue(): Promise<KeyShortcut>;
  setValue(value: KeyShortcut): Promise<void>;
}

const { status, flashSaved } = useSaveStatus();
const parseReviewModifier = reactive<ModifierKeys>({
  ...DEFAULT_PARSE_REVIEW_MODIFIER,
});
const autoTranslateReply = ref(true);
let loaded = false;

function makeShortcutRow(
  label: string,
  item: ShortcutItem,
  fallback: KeyShortcut,
) {
  const row = reactive({
    label,
    item,
    fallback,
    current: { ...fallback } as KeyShortcut,
    onChange: async (value: KeyShortcut) => {
      row.current = value;
      await item.setValue(value);
      flashSaved();
    },
  });
  return row;
}

const keyShortcutRows = [
  makeShortcutRow(
    'Quick reply (while typing a reply)',
    quickReplyShortcutItem,
    DEFAULT_QUICK_REPLY_SHORTCUT,
  ),
  makeShortcutRow(
    'Insert canned reply (while typing a reply)',
    cannedReplyShortcutItem,
    DEFAULT_CANNED_REPLY_SHORTCUT,
  ),
  makeShortcutRow(
    'Next review',
    nextReviewShortcutItem,
    DEFAULT_NEXT_REVIEW_SHORTCUT,
  ),
  makeShortcutRow(
    'Previous review',
    prevReviewShortcutItem,
    DEFAULT_PREV_REVIEW_SHORTCUT,
  ),
  makeShortcutRow(
    'Next review page',
    nextReviewPageShortcutItem,
    DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
  ),
  makeShortcutRow(
    'Previous review page',
    prevReviewPageShortcutItem,
    DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
  ),
];

onMounted(async () => {
  await Promise.all(
    keyShortcutRows.map(async (row) => {
      row.current = await row.item.getValue();
    }),
  );
  Object.assign(parseReviewModifier, await parseReviewModifierItem.getValue());
  autoTranslateReply.value = await autoTranslateReplyItem.getValue();
  loaded = true;
});

function resetParseReviewModifier() {
  Object.assign(parseReviewModifier, DEFAULT_PARSE_REVIEW_MODIFIER);
}

// An all-unchecked modifier set would silently disable parsing, so it's shown
// as a warning instead of being saved.
watch(
  parseReviewModifier,
  async () => {
    if (!loaded || !hasAnyModifier(parseReviewModifier)) return;
    await parseReviewModifierItem.setValue({ ...parseReviewModifier });
    flashSaved();
  },
  { deep: true },
);

watch(autoTranslateReply, async (value) => {
  if (!loaded) return;
  await autoTranslateReplyItem.setValue(value);
  flashSaved();
});
</script>
