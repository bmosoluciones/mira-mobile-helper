<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * PendingView — Screen 2 of the mobile helper.
 *
 * Per PLAN.md:
 *  RF-M04: show list of pending transactions
 *  RF-M05: edit pending transactions
 *  RF-M06: manual sync trigger
 *  RF-M07: QR pairing button with Android scanner and manual fallback
 *  RF-M08: Zeroconf discovery (triggered on sync)
 *  RF-M10: show sync status
 *  RNF-M02: UX simple — one screen covers the full sync flow
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { QrScannerError, scanPairingQr } from '@/services/qrScanner'
import { useSyncStore } from '@/stores/sync'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const router = useRouter()
const syncStore = useSyncStore()
const transactionsStore = useTransactionsStore()

const showPairingPanel = ref(false)
const lastSyncCopy = computed(() =>
  syncStore.lastSyncAgeDays === null
    ? t('pending.lastSyncNever')
    : t('pending.lastSyncDays', { count: syncStore.lastSyncAgeDays }),
)

function editPending(localId: string): void {
  transactionsStore.startEditing(localId)
  void router.push('/capture')
}

async function scanQr(): Promise<void> {
  showPairingPanel.value = true
  try {
    const rawPayload = await scanPairingQr()
    syncStore.applyPairingPayload(rawPayload)
  } catch (error) {
    if (error instanceof QrScannerError) {
      switch (error.code) {
        case 'cancelled':
          syncStore.setSyncStatus('sync.qrCancelled')
          return
        case 'permission_denied':
          syncStore.setSyncStatus('sync.cameraDenied')
          return
        case 'unavailable':
          syncStore.setSyncStatus('sync.qrUnavailable')
          return
        default:
          syncStore.setSyncStatus('sync.qrInvalid')
          return
      }
    }
    syncStore.setSyncStatus('sync.qrInvalid')
  }
}
</script>

<template>
  <div class="pending-layout">
    <!-- ── Pending transactions table (RF-M04) ── -->
    <section class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">≡</span>
        <h3>{{ t('pending.title') }}</h3>
      </div>
      <p class="last-sync-hint">{{ lastSyncCopy }}</p>

      <p v-if="transactionsStore.pending.length === 0" class="hint">
        {{ t('pending.empty') }}
      </p>

      <table v-else class="pending-list-table" :aria-label="t('pending.title')">
        <thead>
          <tr>
            <th></th>
            <th>{{ t('pending.colDate') }}</th>
            <th>{{ t('pending.colType') }}</th>
            <th>{{ t('pending.colAmount') }}</th>
            <th>{{ t('pending.colCategory') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in transactionsStore.pending"
            :key="item.localId"
            class="pending-row"
            @click="editPending(item.localId)"
            style="cursor: pointer"
          >
            <td><input type="checkbox" :checked="item.syncState === 'pending_sync'" disabled @click.stop /></td>
            <td>{{ item.txDate }}</td>
            <td :class="item.txType === 'income' ? 'pending-type-income' : 'pending-type-expense'">
              {{ t(`form.type${item.txType === 'income' ? 'Income' : 'Expense'}`) }}
            </td>
            <td class="pending-amount">
              {{ item.sourceCurrency }} {{ item.amount.toFixed(2) }}
              <div v-if="item.lastError" class="error-copy">{{ t('pending.error', { reason: item.lastError }) }}</div>
            </td>
            <td>{{ item.category ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ── Sync actions (RF-M06, RF-M07, RF-M08, RF-M10) ── -->
    <section class="panel-card">
      <!-- RF-M10: sync status -->
      <p v-if="syncStore.statusMessage" class="sync-status-text" :class="{ 'sync-status-success': syncStore.statusMessage === 'sync.success' }">
        {{ syncStore.statusMessage.startsWith('sync.') ? t(syncStore.statusMessage) : syncStore.statusMessage }}
      </p>

      <div class="sync-buttons-stack">
        <!-- RF-M07: QR pairing — UI placeholder (native scanner not yet integrated) -->
        <button class="qr-button" @click="scanQr">
          <!-- QR icon (inline SVG, no external dependency, RNF-M01 Ligera) -->
          <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm7-2h7v7h-7V3zm2 2v3h3V5h-3zM3 13h7v7H3v-7zm2 2v3h3v-3H5zm12 0h2v2h-2v-2zm-4 0h2v2h-2v-2zm4 4h2v2h-2v-2zm-4 0h2v2h-2v-2zm-2-4h2v6h-2v-6z"/>
          </svg>
          {{ t('sync.scanQr') }}
        </button>

        <!-- RF-M06: manual sync trigger -->
        <button class="sync-button" :disabled="!syncStore.canSync || syncStore.isSyncing" @click="syncStore.synchronize">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          {{ syncStore.isSyncing ? t('sync.syncing') : t('sync.syncNow') }}
        </button>
      </div>

      <!-- Manual pairing panel (fallback for RF-M07, collapsed by default) -->
      <div v-if="showPairingPanel" class="pairing-collapse" style="margin-top: 0.75rem">
        <p class="hint">{{ t('sync.pairingFallbackHint') }}</p>
        <label class="field-block">
          <span class="field-label">{{ t('sync.pairingCode') }}</span>
          <input
            v-model="syncStore.pairingCode"
            class="text-input"
            inputmode="numeric"
            maxlength="6"
            :placeholder="t('sync.pairingPlaceholder')"
          />
        </label>
        <label class="field-block">
          <span class="field-label">{{ t('sync.pairingPayload') }}</span>
          <textarea
            v-model="syncStore.pairingPayloadText"
            class="chat-input compact"
            rows="3"
            :placeholder="t('sync.pairingPayloadPlaceholder')"
          />
        </label>
      </div>
    </section>
  </div>
</template>
