<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * CaptureView — Screen 1 of the mobile helper.
 *
 * Per PLAN.md:
 *  RF-M01: create transactions (income/expense)
 *  RF-M02: natural-language entry (MIRA Chat)
 *  RNF-M02: UX simple (two top KPI cards + FAB + chat + form)
 *  RNF-M03: fully offline
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ChatPanel from '@/components/ChatPanel.vue'
import KpiCards from '@/components/KpiCards.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const router = useRouter()
const masterDataStore = useMasterDataStore()
const transactionsStore = useTransactionsStore()
const canCapture = computed(() => masterDataStore.hasInitialMasterData)

function newEntry(): void {
  if (!canCapture.value) {
    void router.push('/setup')
    return
  }
  transactionsStore.resetDraft()
  // Scroll the form into view for quick access (RF-M01)
  document.getElementById('transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="capture-layout">
    <section v-if="!canCapture" class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">i</span>
        <h3>{{ t('capture.lockedTitle') }}</h3>
      </div>
      <p class="hint">{{ t('capture.lockedCopy') }}</p>
      <button class="primary-button" style="margin-top:0.75rem" @click="router.push('/setup')">
        {{ t('capture.openSetup') }}
      </button>
    </section>

    <template v-else>
    <!-- KPI summary — computed from local pending (offline-first, RNF-M03) -->
    <KpiCards />

    <!-- FAB for quick new entry (RF-M01) -->
    <div class="fab-row">
      <span class="fab-label">{{ t('capture.newEntry') }}</span>
      <button class="fab" :aria-label="t('capture.newEntry')" @click="newEntry">+</button>
    </div>

    <!-- MIRA Chat — natural-language entry (RF-M02) -->
    <ChatPanel />

    <!-- Manual transaction form (RF-M01) -->
    <TransactionForm id="transaction-form" />
    </template>
  </div>
</template>
