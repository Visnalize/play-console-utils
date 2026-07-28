<template>
  <section>
    <h2><Keyboard :size="16" /> Keyboard shortcuts</h2>

    <div class="shortcut-row">
      <span class="shortcut-label">Quick reply (while typing a reply)</span>
      <ShortcutRecorder
        :model-value="quickReply.current"
        :default-value="DEFAULT_QUICK_REPLY_SHORTCUT"
        @update:model-value="quickReply.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label"
        >Insert canned reply (while typing a reply)</span
      >
      <ShortcutRecorder
        :model-value="cannedReply.current"
        :default-value="DEFAULT_CANNED_REPLY_SHORTCUT"
        @update:model-value="cannedReply.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label">Next review</span>
      <ShortcutRecorder
        :model-value="nextReview.current"
        :default-value="DEFAULT_NEXT_REVIEW_SHORTCUT"
        @update:model-value="nextReview.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label">Previous review</span>
      <ShortcutRecorder
        :model-value="prevReview.current"
        :default-value="DEFAULT_PREV_REVIEW_SHORTCUT"
        @update:model-value="prevReview.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label">Next review page</span>
      <ShortcutRecorder
        :model-value="nextReviewPage.current"
        :default-value="DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT"
        @update:model-value="nextReviewPage.onChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label">Previous review page</span>
      <ShortcutRecorder
        :model-value="prevReviewPage.current"
        :default-value="DEFAULT_PREV_REVIEW_PAGE_SHORTCUT"
        @update:model-value="prevReviewPage.onChange"
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

const parseReviewModifier = reactive<ModifierKeys>({
  ...DEFAULT_PARSE_REVIEW_MODIFIER,
});
const autoTranslateReply = ref(true);
const status = ref('');
let loaded = false;

function flashSaved() {
  status.value = 'Saved';
  setTimeout(() => {
    if (status.value === 'Saved') status.value = '';
  }, 1500);
}

function makeShortcutRow(
  item: { setValue(v: KeyShortcut): Promise<void> },
  initial: KeyShortcut,
) {
  const row = reactive({
    current: { ...initial } as KeyShortcut,
    onChange: async (v: KeyShortcut) => {
      row.current = v;
      await item.setValue(v);
      flashSaved();
    },
  });
  return row;
}

const quickReply = makeShortcutRow(
  quickReplyShortcutItem,
  DEFAULT_QUICK_REPLY_SHORTCUT,
);
const cannedReply = makeShortcutRow(
  cannedReplyShortcutItem,
  DEFAULT_CANNED_REPLY_SHORTCUT,
);
const nextReview = makeShortcutRow(
  nextReviewShortcutItem,
  DEFAULT_NEXT_REVIEW_SHORTCUT,
);
const prevReview = makeShortcutRow(
  prevReviewShortcutItem,
  DEFAULT_PREV_REVIEW_SHORTCUT,
);
const nextReviewPage = makeShortcutRow(
  nextReviewPageShortcutItem,
  DEFAULT_NEXT_REVIEW_PAGE_SHORTCUT,
);
const prevReviewPage = makeShortcutRow(
  prevReviewPageShortcutItem,
  DEFAULT_PREV_REVIEW_PAGE_SHORTCUT,
);

onMounted(async () => {
  quickReply.current = await quickReplyShortcutItem.getValue();
  cannedReply.current = await cannedReplyShortcutItem.getValue();
  nextReview.current = await nextReviewShortcutItem.getValue();
  prevReview.current = await prevReviewShortcutItem.getValue();
  nextReviewPage.current = await nextReviewPageShortcutItem.getValue();
  prevReviewPage.current = await prevReviewPageShortcutItem.getValue();
  Object.assign(parseReviewModifier, await parseReviewModifierItem.getValue());
  autoTranslateReply.value = await autoTranslateReplyItem.getValue();
  loaded = true;
});

function resetParseReviewModifier() {
  Object.assign(parseReviewModifier, DEFAULT_PARSE_REVIEW_MODIFIER);
}

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
