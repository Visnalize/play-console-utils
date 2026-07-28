<template>
  <section class="page-section">
    <h2 class="section-title"><Keyboard :size="24" /> Keyboard shortcuts</h2>

    <div class="flex flex-col gap-3 mt-3">
      <div
        v-for="row in keyShortcutRows"
        :key="row.label"
        class="flex flex-wrap justify-between items-center gap-3"
      >
        <span class="min-w-64 text-sm">{{ row.label }}</span>
        <ShortcutRecorder
          :model-value="row.current"
          :default-value="row.fallback"
          @update:model-value="row.onChange"
        />
      </div>

      <div class="flex flex-wrap justify-between items-center gap-3">
        <span class="min-w-64 text-sm"
          >Parse review (modifier + click on review text)</span
        >
        <span class="inline-flex items-center gap-3">
          <label class="text-sm label"
            ><input
              v-model="parseReviewModifier.ctrlOrMeta"
              type="checkbox"
              class="checkbox checkbox-sm"
            />
            Ctrl/⌘</label
          >
          <label class="text-sm label"
            ><input
              v-model="parseReviewModifier.shift"
              type="checkbox"
              class="checkbox checkbox-sm"
            />
            Shift</label
          >
          <label class="text-sm label"
            ><input
              v-model="parseReviewModifier.alt"
              type="checkbox"
              class="checkbox checkbox-sm"
            />
            Alt</label
          >
          <button
            type="button"
            class="opacity-70 font-normal btn btn-sm btn-ghost"
            @click="resetParseReviewModifier"
          >
            <RotateCcw :size="14" /> Reset
          </button>
        </span>
      </div>
      <div
        v-if="!hasAnyModifier(parseReviewModifier)"
        role="alert"
        class="py-2 text-sm alert alert-warning"
      >
        Select at least one modifier — parsing stays off until you do.
      </div>

      <div>
        <label class="text-sm label"
          ><input
            v-model="autoTranslateReply"
            type="checkbox"
            class="checkbox checkbox-sm"
          />
          Translate reply to match the review's language before
          publishing</label
        >
        <p class="opacity-70 mt-1 text-sm">
          Uses Chrome's built-in on-device translation. Requires a Chrome
          version that supports it — falls back to publishing your reply as
          typed otherwise.
        </p>
      </div>
    </div>

    <p class="mt-3 save-status" role="status" aria-live="polite">
      {{ status }}
    </p>
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
