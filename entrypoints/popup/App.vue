<template>
  <main>
    <h1>Play Console Utils</h1>

    <p v-if="!isOnConsole" class="guidance">
      This extension only works on the Google Play Console review section.
      Open an app's reviews page in Play Console to use the quick-reply and
      review-parsing shortcuts.
    </p>

    <ul v-else class="links">
      <li>
        <button type="button" @click="openOptions">Options</button>
      </li>
      <li>
        <a href="https://pcu.visnalize.com" target="_blank" rel="noopener">
          Documentation
        </a>
      </li>
    </ul>

    <footer>
      By <a href="https://visnalize.com" target="_blank" rel="noopener"
        >Visnalize</a
      >
    </footer>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { isConsoleUrl } from '@/utils/console-url';

const isOnConsole = ref(false);

onMounted(async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  isOnConsole.value = isConsoleUrl(tab?.url);
});

function openOptions() {
  void browser.runtime.openOptionsPage();
}
</script>
