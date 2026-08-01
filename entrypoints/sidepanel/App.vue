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
      <PriceInputs
        ref="priceInputs"
        v-model:base-price="basePrice"
        v-model:base-country="settings.baseCountry"
        v-model:rounding="settings.rounding"
        v-model:custom-factor="settings.customFactor"
        v-model:overwrite-filled="settings.overwriteFilled"
        :base-label="baseLabel"
        :base-placeholder="basePlaceholder"
        :countries="countries"
        :disabled="filling"
      />

      <!-- A distinct, shaded surface for the scanned results — set apart from
           the plain controls above so "what you set" and "what it found" read
           as two different zones in a narrow panel. -->
      <div
        class="flex flex-col flex-1 gap-2 bg-base-200/70 p-3 border border-base-300 rounded-box min-h-0"
      >
        <PreviewToolbar
          v-model:show-base="showBase"
          :filling="filling"
          :progress="progress"
          :summary="summary"
          :base-currency="baseCurrency"
          :base-toggle-label="baseToggleLabel"
          @rescan="rescan"
        />
        <PreviewList
          :rows="rows"
          :show-base="showBase"
          :base-currency="baseCurrency"
        />
      </div>

      <FillControls
        :filling="filling"
        :fillable="fillable"
        :converted-count="convertedCount"
        @fill="startFill"
        @stop="stopFill"
      />
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { Globe } from '@lucide/vue';
import FillControls from './FillControls.vue';
import PreviewList from './PreviewList.vue';
import PreviewToolbar from './PreviewToolbar.vue';
import PriceInputs from './PriceInputs.vue';
import {
  DEFAULT_PPP_SETTINGS,
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
const priceInputs = ref<InstanceType<typeof PriceInputs> | null>(null);
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
  priceInputs.value?.focus();
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
