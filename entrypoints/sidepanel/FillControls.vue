<template>
  <div class="flex flex-col gap-2">
    <button
      v-if="!filling"
      type="button"
      class="btn-block font-normal btn btn-primary"
      :disabled="fillable === 0"
      @click="$emit('fill')"
    >
      Fill prices
    </button>
    <button
      v-else
      type="button"
      class="btn-block btn-outline font-normal btn btn-error"
      @click="$emit('stop')"
    >
      Stop
    </button>

    <p class="opacity-60 text-xs leading-snug">
      Each price goes in through Play Console's own editor, one row at a time.
      Nothing is saved until you press Save in Play Console.
      <template v-if="convertedCount">
        {{ convertedCount }}
        {{ convertedCount === 1 ? 'market is' : 'markets are' }} billed in a
        currency that isn't their own, so those use an exchange rate as well as
        purchasing power — they'll drift as rates move.
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  filling: boolean;
  fillable: number;
  convertedCount: number;
}>();

defineEmits<{ fill: []; stop: [] }>();
</script>
