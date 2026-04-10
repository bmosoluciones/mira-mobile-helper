<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * ChatPanel — Natural-language quick-entry (RF-M02).
 * Styled after the mockup: chat bubble, textarea with mic icon,
 * ZeroConf status below.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const transactionsStore = useTransactionsStore()

function onSend(): void {
  transactionsStore.parseChatInput()
  if (!transactionsStore.parsedCommand || transactionsStore.parsedCommand.action === 'none') {
    return
  }
  transactionsStore.applyParsedCommand()
}

const parsedSummary = computed(() => {
  if (!transactionsStore.parsedCommand) return null
  if (transactionsStore.parsedCommand.action === 'none') return t('chat.noTransaction')
  return [
    transactionsStore.parsedCommand.action,
    transactionsStore.parsedCommand.amount ?? '-',
    transactionsStore.parsedCommand.description ?? '-',
  ].join(' · ')
})
</script>

<template>
  <section class="panel-card">
    <div class="panel-header">
      <!-- speech-bubble icon (inline SVG, RNF-M01 Ligera) -->
      <svg class="panel-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1.15rem;height:1.15rem">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
      <h3>{{ t('chat.title') }}</h3>
    </div>

    <!-- Textarea + mic button row -->
    <div class="chat-mic-row">
      <textarea
        v-model="transactionsStore.chatInput"
        class="chat-textarea"
        rows="3"
        :placeholder="t('chat.placeholder')"
      />
      <!-- Mic icon — decorative placeholder for future voice input (RF-M02) -->
      <button class="chat-mic-btn" :title="t('chat.mic')" disabled aria-label="Voice input (coming soon)">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:1rem;height:1rem" aria-hidden="true">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z"/>
        </svg>
      </button>
    </div>

    <!-- Action buttons -->
    <div class="chat-action-row">
      <button class="primary-button" style="flex:1" @click="onSend">
        {{ t('chat.parse') }}
      </button>
    </div>

    <!-- Parsed result / ZeroConf status row -->
    <div v-if="parsedSummary" class="chat-status-row">
      <p class="chat-status-text">{{ parsedSummary }}</p>
    </div>
  </section>
</template>
