<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-semibold text-xs uppercase opacity-60 tracking-wide">
        Preview
      </h2>
      <!-- Both are disabled mid-fill anyway; hiding them gives the summary
           line below the whole row instead of squeezing it into what's left. -->
      <div v-if="!filling" class="flex items-center gap-1">
        <div class="tooltip tooltip-left" :data-tip="baseToggleLabel">
          <!-- btn-active on its own reads the same as btn-ghost's hover
               state, so the tinted icon is what makes "on" unambiguous. -->
          <button
            type="button"
            class="btn btn-xs btn-ghost btn-square"
            :class="{ 'btn-active text-primary': showBase }"
            :aria-pressed="showBase"
            :aria-label="baseToggleLabel"
            :disabled="!baseCurrency"
            @click="showBase = !showBase"
          >
            <Coins :size="13" />
          </button>
        </div>
        <!-- Rescan drives what the whole preview shows, so it gets a labelled,
             outlined button rather than a bare ghost icon — the fill button's
             only real counterpart. -->
        <button
          type="button"
          class="gap-1 btn btn-xs btn-outline btn-primary"
          @click="$emit('rescan')"
        >
          <RefreshCw :size="12" />
          Rescan
        </button>
      </div>
    </div>

    <!-- While filling, the summary line becomes the progress bar: the plan's
         length is exact (every row is in the DOM before the walk starts), so
         this is a real fraction rather than a guess. -->
    <div
      v-if="filling"
      class="flex items-center gap-2"
      role="status"
      :aria-label="`Filled ${progress.done} of ${progress.total} prices`"
    >
      <progress
        class="flex-1 progress progress-primary"
        :value="progress.done"
        :max="Math.max(progress.total, 1)"
      />
      <span class="opacity-70 tabular-nums text-xs shrink-0">
        {{ progress.done }}/{{ progress.total }}
      </span>
    </div>
    <p v-else class="opacity-70 text-sm">{{ summary }}</p>
  </div>
</template>

<script setup lang="ts">
import { Coins, RefreshCw } from '@lucide/vue';

defineProps<{
  filling: boolean;
  progress: { done: number; total: number };
  summary: string;
  baseCurrency: string;
  baseToggleLabel: string;
}>();

defineEmits<{ rescan: [] }>();

const showBase = defineModel<boolean>('showBase', { required: true });
</script>
