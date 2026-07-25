<template>
  <section>
    <h2>Keyboard shortcuts</h2>

    <div class="shortcut-row">
      <span class="shortcut-label">Quick reply (while typing a reply)</span>
      <ShortcutRecorder
        :model-value="quickReplyShortcut"
        :default-value="DEFAULT_QUICK_REPLY_SHORTCUT"
        @update:model-value="onQuickReplyChange"
      />
    </div>

    <div class="shortcut-row">
      <span class="shortcut-label"
        >Parse review (modifier + click on review text)</span
      >
      <label
        ><input v-model="parseReviewModifier.ctrlOrMeta" type="checkbox" />
        Ctrl/⌘</label
      >
      <label
        ><input v-model="parseReviewModifier.shift" type="checkbox" />
        Shift</label
      >
      <label
        ><input v-model="parseReviewModifier.alt" type="checkbox" /> Alt</label
      >
      <button type="button" class="reset" @click="resetParseReviewModifier">
        Reset
      </button>
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
import ShortcutRecorder from './ShortcutRecorder.vue';
import {
  autoTranslateReplyItem,
  DEFAULT_PARSE_REVIEW_MODIFIER,
  DEFAULT_QUICK_REPLY_SHORTCUT,
  hasAnyModifier,
  parseReviewModifierItem,
  quickReplyShortcutItem,
  type ModifierKeys,
  type QuickReplyShortcut,
} from '@/utils/shortcuts';

const quickReplyShortcut = ref<QuickReplyShortcut>({
  ...DEFAULT_QUICK_REPLY_SHORTCUT,
});
const parseReviewModifier = reactive<ModifierKeys>({
  ...DEFAULT_PARSE_REVIEW_MODIFIER,
});
const autoTranslateReply = ref(true);
const status = ref('');
let loaded = false;

onMounted(async () => {
  quickReplyShortcut.value = await quickReplyShortcutItem.getValue();
  Object.assign(parseReviewModifier, await parseReviewModifierItem.getValue());
  autoTranslateReply.value = await autoTranslateReplyItem.getValue();
  loaded = true;
});

function flashSaved() {
  status.value = 'Saved';
  setTimeout(() => {
    if (status.value === 'Saved') status.value = '';
  }, 1500);
}

async function onQuickReplyChange(value: QuickReplyShortcut) {
  quickReplyShortcut.value = value;
  await quickReplyShortcutItem.setValue(value);
  flashSaved();
}

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
