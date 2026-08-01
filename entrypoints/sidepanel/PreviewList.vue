<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div
      v-for="row in rows"
      :key="row.market"
      class="hover:bg-base-300 px-2 py-1 border-base-300 border-t"
      :class="{ 'opacity-40': row.skipped }"
    >
      <div class="flex justify-between items-baseline gap-3 text-sm">
        <span class="min-w-0 truncate">
          {{ row.market }}
          <span
            v-if="row.approximate"
            class="opacity-60 cursor-help"
            :title="`Averaged across all ${row.currency} countries`"
            >≈</span
          >
        </span>
        <span class="tabular-nums shrink-0">{{ displayPrice(row) }}</span>
      </div>
      <!-- Only when there's a difference worth showing. An unpriced market has
           nothing to compare against, and without the rounds-to-zero check
           every row grows a "was … no change" line once a fill finishes. -->
      <div
        v-if="hasChange(row)"
        class="flex justify-between items-baseline gap-3 text-xs"
      >
        <span class="opacity-60 min-w-0 truncate"
          >was {{ displayCurrent(row) }}</span
        >
        <span class="tabular-nums shrink-0" :class="changeClass(row.change)">{{
          changeLabel(row.change)
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PppPreviewRow } from '@/utils/messages';

const props = defineProps<{
  rows: PppPreviewRow[];
  showBase: boolean;
  baseCurrency: string;
}>();

// A view switch, not a setting: both figures already came over on the scan,
// so this re-renders without touching the page or the stored config.
function displayPrice(row: PppPreviewRow): string {
  return props.showBase
    ? `${props.baseCurrency} ${row.priceBase}`
    : `${row.currency} ${row.price}`;
}

function displayCurrent(row: PppPreviewRow): string {
  return props.showBase
    ? `${props.baseCurrency} ${row.currentBase}`
    : `${row.currency} ${row.current}`;
}

function hasChange(row: PppPreviewRow): boolean {
  return row.change !== null && Math.round(row.change) !== 0;
}

// Rounded to whole percent — the panel is narrow and a decimal here is noise.
// The arrow carries the direction too, so the colour isn't the only signal.
function changeLabel(change: number | null): string {
  if (change === null) return '';
  const pct = Math.round(change);
  return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
}

function changeClass(change: number | null): string {
  return (change ?? 0) > 0 ? 'text-success' : 'text-primary';
}
</script>
