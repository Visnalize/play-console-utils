<template>
  <span class="shortcut-recorder">
    <button type="button" :class="{ recording }" @click="startRecording">
      {{ recording ? 'Press a key…' : display }}
    </button>
    <button
      type="button"
      class="reset"
      @click="$emit('update:modelValue', { ...defaultValue })"
    >
      <RotateCcw :size="14" /> Reset
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { formatShortcut, type KeyShortcut } from '@/utils/shortcuts';
import { RotateCcw } from '@lucide/vue';

const props = defineProps<{
  modelValue: KeyShortcut;
  defaultValue: KeyShortcut;
}>();
const emit = defineEmits<{ 'update:modelValue': [KeyShortcut] }>();

const recording = ref(false);
const display = computed(() => formatShortcut(props.modelValue));

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt']);

function onKeydown(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') {
    stopRecording();
    return;
  }
  if (MODIFIER_KEYS.has(e.key)) return;

  emit('update:modelValue', {
    ctrlOrMeta: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key,
  });
  stopRecording();
}

function startRecording() {
  recording.value = true;
  window.addEventListener('keydown', onKeydown, true);
}

function stopRecording() {
  recording.value = false;
  window.removeEventListener('keydown', onKeydown, true);
}

onBeforeUnmount(stopRecording);
</script>
