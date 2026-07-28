<template>
  <section class="page-section">
    <h2 class="section-title">
      <MessageSquareQuote :size="24" /> Canned reply templates
    </h2>
    <p class="opacity-70 mt-2 text-sm">
      Use <code class="kbd kbd-xs">{author}</code>,
      <code class="kbd kbd-xs">{date}</code>, and
      <code class="kbd kbd-xs">{app}</code> — they're filled in from the review
      you're replying to when you pick a template.
    </p>
    <table class="table table-sm my-3">
      <thead>
        <tr>
          <th>Label</th>
          <th>Reply content</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="row.id">
          <td class="align-top">
            <input
              :ref="(el) => setFirstInputRef(el, i)"
              v-model="row.label"
              type="text"
              class="w-full input input-sm"
              placeholder="e.g. Already fixed"
            />
          </td>
          <td>
            <textarea
              v-model="row.content"
              rows="3"
              class="w-full textarea textarea-sm"
              placeholder="e.g. Hi {author}, thanks for the report — this was fixed in the latest update. Please try updating {app}!"
            ></textarea>
          </td>
          <td class="w-0 align-top">
            <button
              type="button"
              class="remove-btn"
              aria-label="Remove canned reply"
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
      class="font-normal btn btn-sm btn-soft"
      @click="addRow(createCannedReply('', ''))"
    >
      <Plus :size="16" /> Add canned reply
    </button>
    <p class="mt-2 save-status" role="status" aria-live="polite">
      {{ status }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { MessageSquareQuote, Plus, Trash2 } from '@lucide/vue';
import {
  cannedRepliesItem,
  createCannedReply,
  type CannedReply,
} from '@/utils/canned-replies';
import { useEditableList } from './autosave';

const { rows, status, load, addRow, removeRow, setFirstInputRef } =
  useEditableList<CannedReply>({
    item: cannedRepliesItem,
    sanitize: (rows) =>
      rows
        .map((r) => ({
          id: r.id,
          label: r.label.trim(),
          content: r.content.trim(),
        }))
        .filter((r) => r.label !== ''),
    quotaMessage:
      'Save failed — you may have too many canned replies for Chrome sync storage. Remove some and try again.',
  });

onMounted(load);
</script>
