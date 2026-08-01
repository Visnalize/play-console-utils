<template>
  <div class="flex flex-col gap-3">
    <label class="block text-sm">
      <span class="block mb-1">Base price — {{ baseLabel }}</span>
      <input
        ref="input"
        v-model="basePrice"
        type="text"
        inputmode="decimal"
        class="w-full input input-sm"
        :placeholder="basePlaceholder"
        :disabled="disabled"
      />
    </label>

    <div>
      <div class="flex justify-between items-baseline gap-2 mb-1 text-sm">
        <span>Custom factor</span>
        <span class="opacity-70 tabular-nums">{{ factorLabel }}</span>
      </div>
      <input
        v-model.number="customFactor"
        type="range"
        class="w-full range range-xs range-primary"
        :min="MIN_CUSTOM_FACTOR"
        :max="MAX_CUSTOM_FACTOR"
        :step="CUSTOM_FACTOR_STEP"
        :disabled="disabled"
      />
    </div>

    <!-- The dials you set once, tucked away so the price list stays the
         focus of a narrow panel. -->
    <details class="text-sm">
      <summary class="opacity-70 cursor-pointer">Settings</summary>
      <div class="flex flex-col gap-2 mt-2">
        <label class="block">
          <span class="block opacity-70 mb-1">Base country</span>
          <select
            v-model="baseCountry"
            class="w-full select-sm select"
            :disabled="disabled"
          >
            <option v-for="c in countries" :key="c.code" :value="c.code">
              {{ c.name }} ({{ c.currency }})
            </option>
          </select>
        </label>
        <label class="block">
          <span class="block opacity-70 mb-1">Rounding</span>
          <select
            v-model="rounding"
            class="w-full select-sm select"
            :disabled="disabled"
          >
            <option v-for="m in ROUNDING_MODES" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </label>
        <label class="text-sm label">
          <input
            v-model="overwriteFilled"
            type="checkbox"
            class="checkbox checkbox-sm"
            :disabled="disabled"
          />
          Overwrite prices that already have a value
        </label>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  CUSTOM_FACTOR_STEP,
  MAX_CUSTOM_FACTOR,
  MIN_CUSTOM_FACTOR,
  ROUNDING_MODES,
  type RoundingMode,
} from '@/utils/ppp';
import type { PppCountry } from '@/utils/ppp-data';

defineProps<{
  baseLabel: string;
  basePlaceholder: string;
  countries: (PppCountry & { code: string })[];
  disabled: boolean;
}>();

const basePrice = defineModel<string>('basePrice', { required: true });
const baseCountry = defineModel<string>('baseCountry', { required: true });
const rounding = defineModel<RoundingMode>('rounding', { required: true });
const customFactor = defineModel<number>('customFactor', { required: true });
const overwriteFilled = defineModel<boolean>('overwriteFilled', {
  required: true,
});

const input = ref<HTMLInputElement | null>(null);

// A bare "1.15" doesn't say much; the percentage is what the user is thinking.
const factorLabel = computed(() => {
  const f = customFactor.value;
  if (Math.abs(f - 1) < 0.001) return 'Raw PPP';
  const pct = Math.round((f - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
});

defineExpose({
  focus: () => input.value?.focus(),
});
</script>
