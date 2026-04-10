<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * TransactionForm — mirrors MIRA desktop TransactionDialog pixel-precisely.
 *
 * Visual reference: src/mira/ui/dialogs/transactions.py
 *
 * Field order matches the desktop form exactly:
 *   1.  Title ("New Transaction" / "Edit Transaction")
 *   2.  EXPENSE | INCOME pill toggle
 *         active expense = filled red #D05757, white text
 *         active income  = filled teal #4EC9B0, dark text
 *         inactive       = white bg, blue border, blue text
 *   3.  "Original amount" label + hero amount card (coloured by type)
 *         expense amount colour = #F48771 (coral)
 *         income  amount colour = #4EC9B0 (teal)
 *   4.  QFormLayout 2-column grid:
 *         left  — Date, Account (+ "Account currency: X" hint)
 *         right — Category, Tags multi-select
 *   5.  Payment method (full-width)
 *   6.  FX checkbox ("Enter amount in a different currency than the account")
 *   7.  FX fields — ALWAYS VISIBLE, disabled when checkbox is off (exact desktop behaviour)
 *         Original currency | Exchange rate
 *         Converted amount  (auto-computed when rate or amount changes)
 *   8.  Description (single-line)
 *   9.  "Add more details... (optional)" checkbox
 *  10.  Optional section: Notes textarea + Receipt path (read-only on mobile)
 *  11.  CANCEL | SAVE TRANSACTION — both outlined blue pill buttons (exact desktop match)
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const masterDataStore = useMasterDataStore()
const transactionsStore = useTransactionsStore()

const draft = computed(() => transactionsStore.draft)
const showOptional = ref(false)
const canSaveDraft = computed(() => masterDataStore.hasInitialMasterData)

// Categories filtered to the current transaction type
const availableCategories = computed(() =>
  masterDataStore.categories.filter((c) => c.type === (draft.value?.txType ?? 'expense')),
)

// Currency of the selected account — shown below account field (mirrors _account_currency_lbl)
const accountCurrency = computed(() => {
  const acc = masterDataStore.accounts.find((a) => a.id === draft.value?.accountId)
  return acc?.currency ?? ''
})

// FX enabled when exchange rate is set
const fxEnabled = computed(() => draft.value !== null && draft.value.exchangeRate !== null)

// Auto-recompute converted amount when amount or rate changes (mirrors _recompute_converted_amount)
watch(
  () => [draft.value?.amount, draft.value?.exchangeRate] as [number | undefined, number | null | undefined],
  ([amount, rate]) => {
    if (!draft.value || draft.value.exchangeRate === null) return
    if (typeof amount === 'number' && typeof rate === 'number' && rate > 0) {
      const recomputed = Math.round(amount * rate * 100) / 100
      if (recomputed !== draft.value.convertedAmount) {
        transactionsStore.updateDraft({ convertedAmount: recomputed })
      }
    }
  },
)

function toggleFx(enabled: boolean): void {
  if (!draft.value) return
  transactionsStore.updateDraft({
    exchangeRate: enabled ? (draft.value.exchangeRate ?? 1.0) : null,
    convertedAmount: enabled ? (draft.value.convertedAmount ?? draft.value.amount) : null,
  })
}

function onAccountChange(e: Event): void {
  const id = Number((e.target as HTMLSelectElement).value) || null
  const acc = masterDataStore.accounts.find((a) => a.id === id) ?? null
  transactionsStore.updateDraft({
    accountId: acc?.id ?? null,
    accountGlobalId: acc?.global_id ?? null,
    // Pre-fill source currency from account (mirrors _set_source_currency_value)
    sourceCurrency: acc?.currency ?? masterDataStore.defaultCurrency,
  })
}

function onCategoryChange(e: Event): void {
  const id = Number((e.target as HTMLSelectElement).value) || null
  const cat = availableCategories.value.find((c) => c.id === id) ?? null
  transactionsStore.updateDraft({
    categoryId: cat?.id ?? null,
    category: cat?.name ?? null,
    categoryGlobalId: cat?.global_id ?? null,
  })
}

function toggleTag(tagId: number): void {
  if (!draft.value) return
  const ids = new Set(draft.value.tagIds)
  ids.has(tagId) ? ids.delete(tagId) : ids.add(tagId)
  const selectedTags = masterDataStore.tags.filter((tg) => ids.has(tg.id))
  transactionsStore.updateDraft({
    tagIds: Array.from(ids),
    tagGlobalIds: selectedTags.map((tg) => tg.global_id),
  })
}
</script>

<template>
  <section class="panel-card tx-form" id="transaction-form">

    <!-- 1. Title — large bold, matches desktop 28px heading -->
    <h2 class="tx-form-title">
      {{ draft?.baseVersion ? t('form.titleEdit') : t('form.titleNew') }}
    </h2>

    <template v-if="draft">

      <!-- 2. EXPENSE | INCOME toggle
              Active expense = filled red #D05757, white text
              Active income  = filled teal #4EC9B0, dark text
              Inactive       = white bg, blue border, blue text (matches desktop) -->
      <div class="type-toggle">
        <button
          class="toggle-chip toggle-chip-expense"
          :class="{ active: draft.txType === 'expense' }"
          @click="transactionsStore.updateDraft({ txType: 'expense' })"
        >
          {{ t('form.typeExpense') }}
        </button>
        <button
          class="toggle-chip toggle-chip-income"
          :class="{ active: draft.txType === 'income' }"
          @click="transactionsStore.updateDraft({ txType: 'income' })"
        >
          {{ t('form.typeIncome') }}
        </button>
      </div>

      <!-- 3. "Original amount" label + hero amount card
              Expense colour #F48771 / Income colour #4EC9B0 (exact desktop match) -->
      <p class="field-label" style="margin-bottom:0.3rem">{{ t('form.amount') }}</p>
      <div class="hero-amount-card">
        <span
          :class="draft.txType === 'income' ? 'hero-income' : 'hero-expense'"
          style="font-size:2.2rem;font-weight:700"
        >$</span>
        <input
          class="hero-amount-input"
          :class="draft.txType === 'income' ? 'hero-income' : 'hero-expense'"
          type="number"
          step="0.01"
          min="0.01"
          :value="draft.amount"
          :aria-label="t('form.amount')"
          @input="transactionsStore.updateDraft({ amount: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <hr class="form-divider" />

      <!-- 4. QFormLayout 2-column grid
              Left column : Date, Account (+ currency hint)
              Right column: Category, Tags                   -->
      <div class="qform-grid">

        <!-- Left: Date -->
        <div class="qform-cell">
          <label class="field-label" :for="`txf-date-${draft.localId}`">{{ t('form.date') }}</label>
          <input
            :id="`txf-date-${draft.localId}`"
            class="text-input"
            type="date"
            :value="draft.txDate"
            @input="transactionsStore.updateDraft({ txDate: ($event.target as HTMLInputElement).value })"
          />
        </div>

        <!-- Right: Category -->
        <div class="qform-cell">
          <label class="field-label" :for="`txf-cat-${draft.localId}`">{{ t('form.category') }}</label>
          <select
            :id="`txf-cat-${draft.localId}`"
            class="text-input"
            :value="draft.categoryId ?? ''"
            @change="onCategoryChange"
          >
            <option value="">—</option>
            <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">
              {{ cat.icon ? `${cat.icon} ` : '' }}{{ cat.name }}
            </option>
          </select>
        </div>

        <!-- Left: Account + "Account currency: USD" hint -->
        <div class="qform-cell">
          <label class="field-label" :for="`txf-acc-${draft.localId}`">{{ t('form.account') }}</label>
          <select
            :id="`txf-acc-${draft.localId}`"
            class="text-input"
            :value="draft.accountId ?? ''"
            @change="onAccountChange"
          >
            <option value="">—</option>
            <option v-for="acc in masterDataStore.accounts" :key="acc.id" :value="acc.id">
              {{ acc.name }}
            </option>
          </select>
          <span v-if="accountCurrency" class="account-currency-hint">
            {{ t('form.accountCurrency', { currency: accountCurrency }) }}
          </span>
          <span v-else-if="masterDataStore.accounts.length === 0" class="account-currency-hint">
            {{ t('form.emptyAccounts') }}
          </span>
        </div>

        <!-- Right: Tags multi-select chips -->
        <div class="qform-cell">
          <span class="field-label">{{ t('form.tags') }}</span>
          <div class="tag-grid">
            <button
              v-for="tag in masterDataStore.tags"
              :key="tag.id"
              class="tag-chip"
              :class="{ selected: draft.tagIds.includes(tag.id) }"
              @click="toggleTag(tag.id)"
            >
              {{ tag.name }}
            </button>
            <span v-if="masterDataStore.tags.length === 0" class="hint" style="font-size:0.8rem">—</span>
          </div>
        </div>

      </div><!-- /qform-grid -->

      <hr class="form-divider" />

      <!-- 5. Payment method (full width) -->
      <div class="qform-cell" style="margin-bottom:0.5rem">
        <label class="field-label" :for="`txf-pm-${draft.localId}`">{{ t('form.paymentMethod') }}</label>
        <select
          :id="`txf-pm-${draft.localId}`"
          class="text-input"
          :value="draft.paymentMethod"
          @change="transactionsStore.updateDraft({ paymentMethod: ($event.target as HTMLSelectElement).value })"
        >
          <option value="cash">{{ t('paymentMethod.cash') }}</option>
          <option value="credit_card">{{ t('paymentMethod.credit_card') }}</option>
          <option value="debit_card">{{ t('paymentMethod.debit_card') }}</option>
          <option value="transfer">{{ t('paymentMethod.transfer') }}</option>
          <option value="other">{{ t('paymentMethod.other') }}</option>
        </select>
      </div>

      <!-- 6. FX checkbox — "Enter amount in a different currency than the account" -->
      <label class="field-block checkbox-row" style="margin-bottom:0.5rem">
        <input
          type="checkbox"
          :checked="fxEnabled"
          @change="toggleFx(($event.target as HTMLInputElement).checked)"
        />
        <span style="font-size:0.85rem;color:var(--text)">{{ t('form.enableFx') }}</span>
      </label>

      <!-- 7. FX fields — ALWAYS VISIBLE, disabled when checkbox off (exact desktop behaviour:
              shows "1.000000" and "$0.01" greyed out until the checkbox is ticked) -->
      <div class="fx-row" style="margin-bottom:0.5rem">
        <div class="qform-cell">
          <label class="field-label" :for="`txf-srcur-${draft.localId}`">{{ t('form.sourceCurrency') }}</label>
          <input
            :id="`txf-srcur-${draft.localId}`"
            class="text-input"
            :value="draft.sourceCurrency"
            :disabled="!fxEnabled"
            maxlength="8"
            @input="transactionsStore.updateDraft({ sourceCurrency: ($event.target as HTMLInputElement).value.toUpperCase() })"
          />
        </div>
        <div class="qform-cell">
          <label class="field-label" :for="`txf-rate-${draft.localId}`">{{ t('form.exchangeRate') }}</label>
          <input
            :id="`txf-rate-${draft.localId}`"
            class="text-input"
            type="number"
            step="0.000001"
            min="0.000001"
            :value="draft.exchangeRate ?? 1"
            :disabled="!fxEnabled"
            @input="transactionsStore.updateDraft({ exchangeRate: Number(($event.target as HTMLInputElement).value) || null })"
          />
        </div>
        <div class="qform-cell" style="grid-column: 1 / -1">
          <label class="field-label" :for="`txf-cvt-${draft.localId}`">{{ t('form.convertedAmount') }}</label>
          <input
            :id="`txf-cvt-${draft.localId}`"
            class="text-input"
            type="number"
            step="0.01"
            :value="draft.convertedAmount ?? draft.amount"
            :disabled="!fxEnabled"
            @input="transactionsStore.updateDraft({ convertedAmount: Number(($event.target as HTMLInputElement).value) || null })"
          />
        </div>
      </div>

      <hr class="form-divider" />

      <!-- 8. Description — single-line input with "Description" placeholder -->
      <div class="qform-cell" style="margin-bottom:0.5rem">
        <label class="field-label" :for="`txf-desc-${draft.localId}`">{{ t('form.description') }}</label>
        <input
          :id="`txf-desc-${draft.localId}`"
          class="text-input"
          :value="draft.description"
          :placeholder="t('form.description')"
          @input="transactionsStore.updateDraft({ description: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <!-- 9. "Add more details... (optional)" checkbox — mirrors desktop _details_check -->
      <label class="field-block checkbox-row" style="margin-bottom:0.5rem">
        <input type="checkbox" v-model="showOptional" />
        <span style="font-size:0.85rem;color:var(--text)">{{ t('form.moreDetails') }}</span>
      </label>

      <!-- 10. Optional section — Notes + Receipt (mirrors desktop _optional_container) -->
      <div v-if="showOptional" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.5rem">
        <div class="qform-cell">
          <label class="field-label" :for="`txf-note-${draft.localId}`">{{ t('form.note') }}</label>
          <textarea
            :id="`txf-note-${draft.localId}`"
            class="text-input note-textarea"
            rows="3"
            :placeholder="t('form.notePlaceholder')"
            :value="draft.note"
            @input="transactionsStore.updateDraft({ note: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>

      <!-- 11. CANCEL | SAVE TRANSACTION
               Both same style: white bg, blue border, blue bold uppercase text (exact desktop match) -->
      <div class="action-row" style="margin-top:0.85rem">
        <button class="tx-action-btn" @click="transactionsStore.resetDraft">
          {{ t('form.cancel') }}
        </button>
        <button class="tx-action-btn" :disabled="!canSaveDraft" @click="transactionsStore.saveDraft">
          {{ draft.baseVersion ? t('form.saveEdit') : t('form.save') }}
        </button>
      </div>
      <p v-if="transactionsStore.saveError" class="error-copy" style="margin-top:0.5rem">
        {{ t(transactionsStore.saveError) }}
      </p>

    </template>
  </section>
</template>
