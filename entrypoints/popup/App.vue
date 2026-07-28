<template>
  <main class="flex flex-col gap-4 p-4">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-base font-semibold">Play Console Utils</h1>
      <div class="flex shrink-0 gap-1">
        <button
          type="button"
          class="btn btn-sm btn-square btn-ghost"
          aria-label="Options"
          title="Options"
          @click="openOptions"
        >
          <Settings :size="16" />
        </button>
        <a
          href="https://pcu.visnalize.com"
          target="_blank"
          rel="noopener"
          class="btn btn-sm btn-square btn-ghost"
          aria-label="Documentation"
          title="Documentation"
        >
          <BookOpen :size="16" />
        </a>
      </div>
    </header>

    <p v-if="!isOnConsole" class="text-sm opacity-70">
      Open Google Play Console to use this extension<template
        v-if="bookmarks.length"
        >, or jump to a saved shortcut below</template
      >.
    </p>

    <template v-else>
      <form
        v-if="addingBookmark"
        class="flex items-center gap-1.5"
        @submit.prevent="saveBookmark"
      >
        <input
          ref="labelInputRef"
          v-model="newBookmarkLabel"
          type="text"
          class="input input-sm min-w-0 flex-1"
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
        class="flex items-center gap-1.5 text-sm text-success"
      >
        <BookmarkCheck :size="14" /> This page is saved as a shortcut.
      </p>
      <button
        v-else
        type="button"
        class="btn btn-sm btn-dash btn-block font-normal"
        @click="startAddingBookmark"
      >
        <BookmarkPlus :size="15" /> Bookmark this page
      </button>
    </template>

    <section v-if="bookmarks.length" class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-xs font-semibold tracking-wide uppercase opacity-60">
          Shortcuts
        </h2>
        <button
          type="button"
          class="btn btn-xs btn-ghost shrink-0 text-error"
          aria-label="Clear all shortcuts"
          title="Clear all shortcuts"
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
            :title="bookmark.url"
            class="btn btn-sm btn-ghost min-w-0 flex-1 justify-start border border-base-300 font-normal"
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

    <footer class="text-center text-xs opacity-60">
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
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Check,
  Settings,
  Trash2,
  X,
} from '@lucide/vue';
import { computed, nextTick, onMounted, ref } from 'vue';

const isOnConsole = ref(false);
const currentUrl = ref('');
const bookmarks = ref<PageBookmark[]>([]);
const addingBookmark = ref(false);
const newBookmarkLabel = ref('');
const labelInputRef = ref<HTMLInputElement | null>(null);

const isCurrentPageBookmarked = computed(() =>
  bookmarks.value.some((b) => b.url === currentUrl.value),
);

onMounted(async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  isOnConsole.value = isConsoleUrl(tab?.url);
  currentUrl.value = tab?.url ?? '';
  newBookmarkLabel.value = tab?.title ?? '';
  bookmarks.value = await pageBookmarksItem.getValue();
});

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
