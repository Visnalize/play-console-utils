<template>
  <main class="flex flex-col gap-4 p-4">
    <header class="flex justify-between items-center gap-2">
      <h1 class="font-semibold text-base">Play Console Utils</h1>
      <div class="flex gap-1 shrink-0">
        <div class="tooltip-bottom tooltip" data-tip="Options">
          <button
            type="button"
            class="btn btn-sm btn-square btn-ghost"
            aria-label="Options"
            @click="openOptions"
          >
            <Settings :size="16" />
          </button>
        </div>
        <div
          class="tooltip-bottom tooltip tooltip-end"
          data-tip="Documentation"
        >
          <a
            href="https://pcu.visnalize.com"
            target="_blank"
            rel="noopener"
            class="btn btn-sm btn-square btn-ghost"
            aria-label="Documentation"
          >
            <BookOpen :size="16" />
          </a>
        </div>
      </div>
    </header>

    <p v-if="!isOnConsole" class="opacity-70 text-sm">
      Open Google Play Console to use this extension<template
        v-if="bookmarks.length"
        >, or jump to a saved shortcut below</template
      >.
    </p>

    <template v-else>
      <!-- Enabled only where it can actually do something: a price editor
           with rows we recognise. The title carries the why and the shortcut,
           so the control stays a single button. -->
      <button
        type="button"
        class="btn-block font-normal btn btn-sm btn-primary"
        :disabled="!canOpenPpp"
        @click="openPppPanel"
      >
        <Globe :size="15" /> Open PPP pricing panel
      </button>

      <form
        v-if="addingBookmark"
        class="flex items-center gap-1.5"
        @submit.prevent="saveBookmark"
      >
        <input
          ref="labelInputRef"
          v-model="newBookmarkLabel"
          type="text"
          class="flex-1 min-w-0 input input-sm"
          placeholder="Shortcut name"
        />
        <button
          type="submit"
          class="btn btn-sm btn-square btn-primary"
          aria-label="Save shortcut"
        >
          <Check :size="15" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-square btn-ghost"
          aria-label="Cancel"
          @click="cancelAddingBookmark"
        >
          <X :size="15" />
        </button>
      </form>
      <p
        v-else-if="isCurrentPageBookmarked"
        class="flex items-center gap-1.5 text-success text-sm"
      >
        <BookmarkCheck :size="14" /> This page is saved as a shortcut.
      </p>
      <button
        v-else
        type="button"
        class="btn-block font-normal btn btn-sm btn-dash"
        @click="startAddingBookmark"
      >
        <BookmarkPlus :size="15" /> Bookmark this page
      </button>
    </template>

    <section v-if="bookmarks.length" class="flex flex-col gap-1.5">
      <div class="flex justify-between items-center gap-2">
        <h2 class="opacity-60 font-semibold text-xs uppercase tracking-wide">
          Shortcuts
        </h2>
        <button
          type="button"
          class="text-error btn btn-xs btn-ghost shrink-0"
          aria-label="Clear all shortcuts"
          @click="clearAllBookmarks"
        >
          <Trash2 :size="13" /> Clear all
        </button>
      </div>
      <ul class="flex flex-col gap-1">
        <li
          v-for="bookmark in bookmarks"
          :key="bookmark.id"
          class="flex items-center gap-1"
        >
          <a
            :href="bookmark.url"
            target="_blank"
            rel="noopener"
            class="flex-1 justify-start border border-base-300 min-w-0 font-normal btn btn-sm btn-ghost"
          >
            <span class="truncate">{{ bookmark.label }}</span>
          </a>
          <button
            type="button"
            class="remove-btn"
            aria-label="Remove shortcut"
            @click="removeBookmark(bookmark.id)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
    </section>

    <footer class="opacity-60 text-xs text-center">
      By
      <a
        href="https://visnalize.com"
        target="_blank"
        rel="noopener"
        class="link link-primary"
        >Visnalize</a
      >
    </footer>
  </main>
</template>

<script setup lang="ts">
import { isConsoleUrl } from '@/utils/console-url';
import {
  createPageBookmark,
  pageBookmarksItem,
  type PageBookmark,
} from '@/utils/bookmarks';
import {
  PPP_SCAN,
  type PppScanResult,
  type PricingMessage,
} from '@/utils/messages';
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Check,
  Globe,
  Settings,
  Trash2,
  X,
} from '@lucide/vue';
import { computed, nextTick, onMounted, ref } from 'vue';

const isOnConsole = ref(false);
const currentUrl = ref('');
const currentTabId = ref<number | undefined>();
const ppp = ref<PppScanResult | null>(null);
// The content script only injects on page load, so a Play Console tab that was
// already open when the extension was installed or reloaded won't answer.
const pppUnreachable = ref(false);
const bookmarks = ref<PageBookmark[]>([]);
const addingBookmark = ref(false);
const newBookmarkLabel = ref('');
const labelInputRef = ref<HTMLInputElement | null>(null);

const isCurrentPageBookmarked = computed(() =>
  bookmarks.value.some((b) => b.url === currentUrl.value),
);

const canOpenPpp = computed(() => (ppp.value?.scanned ?? 0) > 0);

onMounted(async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  isOnConsole.value = isConsoleUrl(tab?.url);
  currentUrl.value = tab?.url ?? '';
  currentTabId.value = tab?.id;
  newBookmarkLabel.value = tab?.title ?? '';
  bookmarks.value = await pageBookmarksItem.getValue();

  if (isOnConsole.value && tab?.id !== undefined) {
    try {
      // Counts only — no base price or settings needed just to enable a
      // button. Typed as PricingMessage so the compiler checks the payload;
      // tabs.sendMessage itself takes `any`, which is how a missing required
      // field once shipped as a silently disabled button.
      const message: PricingMessage = { type: PPP_SCAN, basePrice: 0 };
      ppp.value = await browser.tabs.sendMessage(tab.id, message);
    } catch {
      // No content script listening on that tab — see pppUnreachable above.
      pppUnreachable.value = true;
    }
  }
});

async function openPppPanel() {
  if (currentTabId.value === undefined) return;
  await browser.sidePanel.open({ tabId: currentTabId.value });
  window.close();
}

function openOptions() {
  void browser.runtime.openOptionsPage();
}

function startAddingBookmark() {
  addingBookmark.value = true;
  void nextTick(() => labelInputRef.value?.focus());
}

function cancelAddingBookmark() {
  addingBookmark.value = false;
}

async function saveBookmark() {
  const label = newBookmarkLabel.value.trim();
  if (!label || !currentUrl.value) return;
  const updated = [
    ...bookmarks.value,
    createPageBookmark(label, currentUrl.value),
  ];
  bookmarks.value = updated;
  await pageBookmarksItem.setValue(updated);
  addingBookmark.value = false;
}

async function removeBookmark(id: string) {
  const updated = bookmarks.value.filter((b) => b.id !== id);
  bookmarks.value = updated;
  await pageBookmarksItem.setValue(updated);
}

async function clearAllBookmarks() {
  const count = bookmarks.value.length;
  if (!count) return;
  const confirmed = confirm(
    `Delete all ${count} saved shortcut${count === 1 ? '' : 's'}? This can't be undone.`,
  );
  if (!confirmed) return;
  bookmarks.value = [];
  await pageBookmarksItem.setValue([]);
}
</script>
