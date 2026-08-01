<template>
  <main class="flex flex-col gap-3 p-4 h-screen">
    <header class="flex items-center gap-2">
      <Globe :size="18" />
      <h1 class="font-semibold text-base">PPP pricing</h1>
    </header>

    <!-- `&& !result`: this branch replaces the entire panel, so one failed
         message must not throw away a fill that already finished — and the
         rescan that runs right after a fill is exactly such a message. -->
    <p v-if="unreachable && !result" class="opacity-70 text-sm">
      Open a Play Console price editor in this tab. If the page was already open
      when the extension was installed, reload it first.
    </p>

    <template v-else>
      <label class="block text-sm">
        <span class="block mb-1">Base price — {{ baseLabel }}</span>
        <input
          ref="priceInput"
          v-model="basePrice"
          type="text"
          inputmode="decimal"
          class="w-full input input-sm"
          :placeholder="basePlaceholder"
          :disabled="filling"
        />
      </label>

      <div>
        <div class="flex justify-between items-baseline gap-2 mb-1 text-sm">
          <span>Custom factor</span>
          <span class="opacity-70 tabular-nums">{{ factorLabel }}</span>
        </div>
        <input
          v-model.number="settings.customFactor"
          type="range"
          class="w-full range range-xs range-primary"
          :min="MIN_CUSTOM_FACTOR"
          :max="MAX_CUSTOM_FACTOR"
          :step="CUSTOM_FACTOR_STEP"
          :disabled="filling"
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
              v-model="settings.baseCountry"
              class="w-full select-sm select"
              :disabled="filling"
            >
              <option v-for="c in countries" :key="c.code" :value="c.code">
                {{ c.name }} ({{ c.currency }})
              </option>
            </select>
          </label>
          <label class="block">
            <span class="block opacity-70 mb-1">Rounding</span>
            <select
              v-model="settings.rounding"
              class="w-full select-sm select"
              :disabled="filling"
            >
              <option
                v-for="m in ROUNDING_MODES"
                :key="m.value"
                :value="m.value"
              >
                {{ m.label }}
              </option>
            </select>
          </label>
          <label class="text-sm label">
            <input
              v-model="settings.overwriteFilled"
              type="checkbox"
              class="checkbox checkbox-sm"
              :disabled="filling"
            />
            Overwrite prices that already have a value
          </label>
        </div>
      </details>

      <div class="flex justify-between items-center gap-2">
        <!-- While filling, the summary line becomes the progress bar: the
             plan's length is exact (every row is in the DOM before the walk
             starts), so this is a real fraction rather than a guess. -->
        <div
          v-if="filling"
          class="flex flex-1 items-center gap-2 min-w-0"
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
        <!-- Both are disabled mid-fill anyway; hiding them gives the bar the
             whole row instead of squeezing it into what's left. -->
        <div v-if="!filling" class="flex items-center shrink-0">
          <!-- btn-active on its own reads the same as btn-ghost's hover
               state, so the tinted icon is what makes "on" unambiguous. -->
          <div class="tooltip tooltip-end" :data-tip="baseToggleLabel">
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              :class="{ 'btn-active text-primary': showBase }"
              :aria-pressed="showBase"
              :aria-label="baseToggleLabel"
              :disabled="filling || !baseCurrency"
              @click="showBase = !showBase"
            >
              <Coins :size="13" />
            </button>
          </div>
          <div class="tooltip tooltip-end" data-tip="Rescan price rows">
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              aria-label="Rescan price rows"
              :disabled="filling"
              @click="rescan"
            >
              <RefreshCw :size="13" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div
          v-for="row in rows"
          :key="row.market"
          class="hover:bg-base-300 px-2 py-1 border-base-200 border-t"
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
          <!-- Only when there's a difference worth showing. An unpriced market
               has nothing to compare against, and without the rounds-to-zero
               check every row grows a "was … no change" line once a fill
               finishes. -->
          <div
            v-if="hasChange(row)"
            class="flex justify-between items-baseline gap-3 text-xs"
          >
            <span class="opacity-60 min-w-0 truncate"
              >was {{ displayCurrent(row) }}</span
            >
            <span
              class="tabular-nums shrink-0"
              :class="changeClass(row.change)"
              >{{ changeLabel(row.change) }}</span
            >
          </div>
        </div>
      </div>

      <button
        v-if="!filling"
        type="button"
        class="btn-block font-normal btn btn-primary"
        :disabled="fillable === 0"
        @click="startFill"
      >
        Fill prices
      </button>
      <button
        v-else
        type="button"
        class="btn-block btn-outline font-normal btn btn-error"
        @click="stopFill"
      >
        Stop
      </button>

      <p class="opacity-60 text-xs leading-snug">
        Each price goes in through Play Console's own editor, one row at a time.
        Nothing is saved until you press Save in Play Console.
        <template v-if="convertedCount">
          {{ convertedCount }}
          {{ convertedCount === 1 ? 'market is' : 'markets are' }} billed in a
          currency that isn't their own, so those use an exchange rate as well
          as purchasing power — they'll drift as rates move.
        </template>
      </p>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { Coins, Globe, RefreshCw } from '@lucide/vue';
import {
  CUSTOM_FACTOR_STEP,
  DEFAULT_PPP_SETTINGS,
  MAX_CUSTOM_FACTOR,
  MIN_CUSTOM_FACTOR,
  ROUNDING_MODES,
  getPppCountry,
  listPppCountries,
  pppSettingsItem,
  type PppSettings,
} from '@/utils/ppp';
import {
  PPP_ABORT,
  PPP_FILL,
  PPP_PROGRESS,
  PPP_SCAN,
  type PppFillResult,
  type PppPreviewRow,
  type PppScanResult,
  type PricingMessage,
} from '@/utils/messages';

const SCAN_DEBOUNCE_MS = 250;

const basePrice = ref('');
const rows = ref<PppPreviewRow[]>([]);
const scanned = ref(0);
const unreachable = ref(false);
const filling = ref(false);
/** Renders every row in the base country's currency, for cross-market compare. */
const showBase = ref(false);
/** Fill progress, broadcast by the walk. `total` is the plan length. */
const progress = ref({ done: 0, total: 0 });
const result = ref<PppFillResult | null>(null);
const settings = reactive<PppSettings>({ ...DEFAULT_PPP_SETTINGS });
const priceInput = ref<HTMLInputElement | null>(null);
const countries = listPppCountries();

let tabId: number | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let loaded = false;

const base = computed(() => getPppCountry(settings.baseCountry));
const baseLabel = computed(() =>
  base.value
    ? `${base.value.name} (${base.value.currency})`
    : settings.baseCountry,
);
const basePlaceholder = computed(() =>
  base.value && base.value.decimals === 0 ? '499' : '4.99',
);
const fillable = computed(() => rows.value.filter((r) => !r.skipped).length);
// Rows that needed a market exchange rate, not just PPP — worth saying once,
// since those prices carry a caveat the pure-PPP ones don't.
const convertedCount = computed(
  () => rows.value.filter((r) => r.converted).length,
);
const baseCurrency = computed(() => base.value?.currency ?? '');
const baseToggleLabel = computed(() =>
  baseCurrency.value
    ? `Show every price in ${baseCurrency.value}`
    : 'Show every price in the base currency',
);

// A view switch, not a setting: both figures already came over on the scan, so
// this re-renders without touching the page or the stored config.
function displayPrice(row: PppPreviewRow): string {
  return showBase.value
    ? `${baseCurrency.value} ${row.priceBase}`
    : `${row.currency} ${row.price}`;
}

function displayCurrent(row: PppPreviewRow): string {
  return showBase.value
    ? `${baseCurrency.value} ${row.currentBase}`
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

// A bare "1.15" doesn't say much; the percentage is what the user is thinking.
const factorLabel = computed(() => {
  const f = settings.customFactor;
  if (Math.abs(f - 1) < 0.001) return 'Raw PPP';
  const pct = Math.round((f - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
});

const parsedPrice = computed(() => {
  const n = Number(basePrice.value.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
});

const summary = computed(() => {
  if (result.value) {
    const { filled, gaveUp, aborted } = result.value;
    if (gaveUp) {
      return `Stopped after ${filled} — Play Console's price editor didn't respond as expected.`;
    }
    if (aborted) return `Stopped at ${filled} price${plural(filled)}.`;
    return `Filled ${filled} price${plural(filled)}. Review, then Save in Play Console.`;
  }
  if (!basePrice.value.trim()) return 'Enter a base price to preview.';
  if (!parsedPrice.value) return 'Enter a positive number.';
  if (scanned.value === 0) return 'No price rows on this page.';
  const skipped = rows.value.length - fillable.value;
  return (
    `Matched ${rows.value.length} of ${scanned.value} price rows` +
    (skipped > 0 ? ` · ${skipped} already priced` : '')
  );
});

function plural(n: number) {
  return n === 1 ? '' : 's';
}

async function send<T>(message: PricingMessage): Promise<T | null> {
  if (tabId === undefined) return null;
  try {
    const response = (await browser.tabs.sendMessage(tabId, message)) as T;
    unreachable.value = false;
    return response;
  } catch {
    unreachable.value = true;
    return null;
  }
}

async function scan() {
  if (!parsedPrice.value) {
    rows.value = [];
    return;
  }
  const res = await send<PppScanResult>({
    type: PPP_SCAN,
    basePrice: parsedPrice.value,
    settings: { ...settings },
  });
  if (!res) return;
  rows.value = res.rows;
  scanned.value = res.scanned;
}

async function rescan() {
  await scan();
  result.value = null;
}

function queueScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => void scan(), SCAN_DEBOUNCE_MS);
}

async function startFill() {
  result.value = null;
  // Seeded from the scan so the bar has a denominator on the first frame,
  // before the walk's own first broadcast arrives.
  progress.value = { done: 0, total: fillable.value };
  filling.value = true;
  const res = await send<PppFillResult>({
    type: PPP_FILL,
    basePrice: parsedPrice.value,
    settings: { ...settings },
  });
  filling.value = false;
  result.value = res;
  await scan();
}

function stopFill() {
  void send({ type: PPP_ABORT });
}

function onProgress(message: PricingMessage) {
  if (message?.type !== PPP_PROGRESS) return;
  progress.value = { done: message.done, total: message.total };
}

// Chrome keeps one panel instance per window, so switching tabs would
// otherwise leave it talking to the tab it was opened on.
function onTabChanged({ tabId: next }: { tabId: number }) {
  tabId = next;
  result.value = null;
  void scan();
}

onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  Object.assign(settings, await pppSettingsItem.getValue());
  loaded = true;

  browser.runtime.onMessage.addListener(onProgress);
  browser.tabs.onActivated.addListener(onTabChanged);
  await scan();
  priceInput.value?.focus();
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(onProgress);
  browser.tabs.onActivated.removeListener(onTabChanged);
});

watch(basePrice, () => {
  result.value = null;
  queueScan();
});

watch(
  settings,
  async () => {
    if (!loaded) return;
    await pppSettingsItem.setValue({ ...settings });
    result.value = null;
    queueScan();
  },
  { deep: true },
);
</script>
