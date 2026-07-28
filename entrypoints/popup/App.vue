<template>
  <main>
    <header class="popup-header">
      <h1>Play Console Utils</h1>
      <div class="header-actions">
        <button
          type="button"
          class="icon-btn"
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
          class="icon-btn"
          aria-label="Documentation"
          title="Documentation"
        >
          <BookOpen :size="16" />
        </a>
      </div>
    </header>

    <p v-if="!isOnConsole" class="guidance">
      Open Google Play Console to use this extension<template
        v-if="bookmarks.length"
        >, or jump to a saved shortcut below</template
      >.
    </p>

    <template v-else>
      <form
        v-if="addingBookmark"
        class="bookmark-form"
        @submit.prevent="saveBookmark"
      >
        <input
          ref="labelInputRef"
          v-model="newBookmarkLabel"
          type="text"
          placeholder="Shortcut name"
        />
        <button type="submit" aria-label="Save shortcut">
          <Check :size="15" />
        </button>
        <button type="button" aria-label="Cancel" @click="cancelAddingBookmark">
          <X :size="15" />
        </button>
      </form>
      <p v-else-if="isCurrentPageBookmarked" class="hint">
        <BookmarkCheck :size="14" /> This page is saved as a shortcut.
      </p>
      <button
        v-else
        type="button"
        class="bookmark-btn"
        @click="startAddingBookmark"
      >
        <BookmarkPlus :size="15" /> Bookmark this page
      </button>
    </template>

    <section v-if="bookmarks.length" class="bookmarks">
      <div class="bookmarks-header">
        <h2>Shortcuts</h2>
        <button
          type="button"
          aria-label="Clear all shortcuts"
          title="Clear all shortcuts"
          @click="clearAllBookmarks"
        >
          <Trash2 :size="13" /> Clear all
        </button>
      </div>
      <ul class="bookmark-list">
        <li v-for="bookmark in bookmarks" :key="bookmark.id">
          <a
            :href="bookmark.url"
            target="_blank"
            rel="noopener"
            :title="bookmark.url"
          >
            <span>{{ bookmark.label }}</span>
          </a>
          <button
            type="button"
            aria-label="Remove shortcut"
            @click="removeBookmark(bookmark.id)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
    </section>

    <footer>
      By
      <a href="https://visnalize.com" target="_blank" rel="noopener"
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
