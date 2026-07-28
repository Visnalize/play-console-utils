<template>
  <section>
    <h2><Plug :size="16" /> App label → slug mapping</h2>
    <p>
      Map the app label shown in Play Console (the active app selector) to the
      slug you want used in copied review JSON. Parsing a review copies its JSON
      using the matching slug below — unmapped apps fall back to an
      auto-generated slug.
    </p>
    <table>
      <thead>
        <tr>
          <th>Play Console app label</th>
          <th>Slug</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td>
            <input
              :ref="(el) => setFirstInputRef(el, i)"
              v-model="row.label"
              type="text"
              placeholder="e.g. Brick 1100"
            />
          </td>
          <td>
            <input
              v-model="row.slug"
              type="text"
              placeholder="e.g. brick1100"
            />
          </td>
          <td>
            <button
              type="button"
              aria-label="Remove mapping"
              @click="removeRow(i)"
            >
              <Trash2 :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button
      type="button"
      class="add-row"
      @click="addRow({ label: '', slug: '' })"
    >
      <Plus :size="16" /> Add mapping
    </button>
    <p role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Plug, Plus, Trash2 } from '@lucide/vue';
import { appMappingsItem, type AppMapping } from '@/utils/apps';
import { useEditableList } from './autosave';

const { rows, status, load, addRow, removeRow, setFirstInputRef } =
  useEditableList<AppMapping>({
    item: appMappingsItem,
    sanitize: (rows) =>
      rows
        .map((r) => ({ label: r.label.trim(), slug: r.slug.trim() }))
        .filter((r) => r.label !== '' && r.slug !== ''),
    quotaMessage:
      'Save failed — you may have too many mappings for Chrome sync storage. Remove some and try again.',
  });

onMounted(load);
</script>
