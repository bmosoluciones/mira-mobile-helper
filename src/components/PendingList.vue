<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A. -->

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useTransactionsStore } from '@/stores/transactions'

const router = useRouter()
const { t } = useI18n()
const transactionsStore = useTransactionsStore()

function editPending(localId: string): void {
  transactionsStore.startEditing(localId)
  void router.push('/capture')
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-header">
      <h3>{{ t('pending.title') }}</h3>
      <p class="hint">{{ t('pending.subtitle') }}</p>
    </div>

    <p v-if="transactionsStore.pending.length === 0" class="hint">{{ t('pending.empty') }}</p>

    <article v-for="item in transactionsStore.pending" :key="item.localId" class="pending-item">
      <div>
        <p class="pending-title">{{ item.description || item.category || item.txType }}</p>
        <p class="pending-meta">
          {{ item.txDate }} · {{ item.txType }} · {{ item.amount.toFixed(2) }} · {{ item.paymentMethod }}
        </p>
        <p v-if="item.lastError" class="error-copy">{{ t('pending.error', { reason: item.lastError }) }}</p>
      </div>

      <div class="action-column">
        <button class="secondary-button compact-button" @click="editPending(item.localId)">
          {{ t('pending.edit') }}
        </button>
        <button class="ghost-button compact-button" @click="transactionsStore.removePending(item.localId)">
          {{ t('pending.remove') }}
        </button>
      </div>
    </article>
  </section>
</template>
