<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A. -->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSyncStore } from '@/stores/sync'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const syncStore = useSyncStore()
const transactionsStore = useTransactionsStore()

const statusCopy = computed(() => {
  if (!syncStore.statusMessage) {
    return t('sync.idle')
  }
  return syncStore.statusMessage.startsWith('sync.')
    ? t(syncStore.statusMessage)
    : syncStore.statusMessage
})
</script>

<template>
  <section class="hero-card">
    <div>
      <p class="eyebrow">{{ t('sync.title') }}</p>
      <h2 class="hero-title">{{ t('sync.pendingCount', { count: transactionsStore.pendingCount }) }}</h2>
      <p class="hero-copy">{{ statusCopy }}</p>
    </div>

    <label class="field-block">
      <span>{{ t('sync.pairingCode') }}</span>
      <input
        v-model="syncStore.pairingCode"
        class="text-input"
        inputmode="numeric"
        maxlength="6"
        :placeholder="t('sync.pairingPlaceholder')"
      />
    </label>

    <label class="field-block">
      <span>{{ t('sync.pairingPayload') }}</span>
      <textarea
        v-model="syncStore.pairingPayloadText"
        class="chat-input compact"
        rows="4"
        :placeholder="t('sync.pairingPayloadPlaceholder')"
      />
    </label>

    <button class="sync-button" :disabled="!syncStore.canSync" @click="syncStore.synchronize">
      {{ syncStore.isSyncing ? t('sync.syncing') : t('sync.button') }}
    </button>
  </section>
</template>
