<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * KpiCards — Income / Expense summary for the current month.
 *
 * Values are computed from local pending transactions (offline-first,
 * aligned with RNF-M03). The desktop remains the source of truth for
 * all historical totals; the mobile only shows what has been captured
 * locally and not yet synced.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const masterDataStore = useMasterDataStore()
const transactionsStore = useTransactionsStore()

const currency = computed(() => masterDataStore.defaultCurrency)

// Recomputed reactively so midnight month-boundaries are handled correctly
const currentMonth = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

const monthlyIncome = computed(() =>
  transactionsStore.pending
    .filter((tx) => tx.txType === 'income' && tx.txDate.startsWith(currentMonth.value))
    .reduce((sum, tx) => sum + tx.amount, 0),
)

const monthlyExpense = computed(() =>
  transactionsStore.pending
    .filter((tx) => tx.txType === 'expense' && tx.txDate.startsWith(currentMonth.value))
    .reduce((sum, tx) => sum + tx.amount, 0),
)

function fmtAmount(value: number): string {
  return `${currency.value} ${value.toFixed(2)}`
}
</script>

<template>
  <section class="kpi-section">
    <p class="kpi-period">{{ t('kpi.thisMonth') }}</p>
    <div class="kpi-row">
      <div class="kpi-card">
        <p class="kpi-label">{{ t('kpi.income') }}</p>
        <p class="kpi-value income">{{ fmtAmount(monthlyIncome) }}</p>
      </div>
      <div class="kpi-card">
        <p class="kpi-label">{{ t('kpi.expense') }}</p>
        <p class="kpi-value expense">{{ fmtAmount(monthlyExpense) }}</p>
      </div>
    </div>
  </section>
</template>
