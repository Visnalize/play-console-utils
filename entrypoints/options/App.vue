<template>
  <main class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
    <h1 class="text-xl font-semibold">ConsoleTurbo — Options</h1>
    <AppMappingsSection />
    <CannedRepliesSection />
    <ShortcutsSection />
  </main>
</template>

<script setup lang="ts">
import AppMappingsSection from './AppMappingsSection.vue';
import CannedRepliesSection from './CannedRepliesSection.vue';
import ShortcutsSection from './ShortcutsSection.vue';
</script>
