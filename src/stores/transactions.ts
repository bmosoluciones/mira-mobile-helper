// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { todayIso, utcNowIso } from '@/lib/datetime'
import { parseTransactionCommand } from '@/lib/parser'
import { generateUlid } from '@/lib/ulid'
import { storageService } from '@/services/storage'
import { useMasterDataStore } from '@/stores/masterData'
import type { MasterDataSnapshot, ParsedTransactionCommand, TransactionDraft, TransactionKind } from '@/types/domain'

function createEmptyDraft(defaultCurrency: string): TransactionDraft {
  const now = utcNowIso()
  return {
    localId: generateUlid(),
    syncId: generateUlid(),
    baseVersion: 0,
    syncState: 'draft',
    txType: 'expense',
    amount: 0,
    txDate: todayIso(),
    accountId: null,
    accountGlobalId: null,
    category: null,
    categoryId: null,
    categoryGlobalId: null,
    tagIds: [],
    tagGlobalIds: [],
    paymentMethod: 'cash',
    sourceCurrency: defaultCurrency,
    exchangeRate: null,
    convertedAmount: null,
    description: '',
    note: '',
    receiptPath: null,
    createdAt: now,
    updatedAt: now,
    lastError: null,
    masterDataBaseAt: null,
  }
}

function reconcileDraftWithSnapshot(
  transaction: TransactionDraft,
  snapshot: MasterDataSnapshot | null,
): TransactionDraft {
  if (!snapshot) {
    return transaction
  }
  const account =
    snapshot.accounts.find((item) => item.global_id === transaction.accountGlobalId) ??
    snapshot.accounts.find((item) => item.id === transaction.accountId)
  const category =
    snapshot.categories.find((item) => item.global_id === transaction.categoryGlobalId) ??
    snapshot.categories.find((item) => item.id === transaction.categoryId)
  const tags = transaction.tagGlobalIds.length
    ? snapshot.tags.filter((item) => transaction.tagGlobalIds.includes(item.global_id))
    : snapshot.tags.filter((item) => transaction.tagIds.includes(item.id))

  return {
    ...transaction,
    accountId: account?.id ?? transaction.accountId,
    accountGlobalId: account?.global_id ?? transaction.accountGlobalId,
    category: category?.name ?? transaction.category,
    categoryId: category?.id ?? transaction.categoryId,
    categoryGlobalId: category?.global_id ?? transaction.categoryGlobalId,
    tagIds: tags.length ? tags.map((item) => item.id) : transaction.tagIds,
    tagGlobalIds: tags.length ? tags.map((item) => item.global_id) : transaction.tagGlobalIds,
    masterDataBaseAt: transaction.masterDataBaseAt ?? snapshot.master_data_updated_at,
  }
}

export const useTransactionsStore = defineStore('transactions', () => {
  const pending = ref<TransactionDraft[]>([])
  const draft = ref<TransactionDraft | null>(null)
  const chatInput = ref('')
  const parsedCommand = ref<ParsedTransactionCommand | null>(null)
  const saveError = ref<string | null>(null)
  const masterDataStore = useMasterDataStore()

  const pendingCount = computed(() => pending.value.length)

  async function initialize(): Promise<void> {
    pending.value = await storageService.listPendingTransactions()
    if (!draft.value) {
      draft.value = createEmptyDraft(masterDataStore.defaultCurrency)
    }
  }

  function resetDraft(): void {
    draft.value = createEmptyDraft(masterDataStore.defaultCurrency)
    parsedCommand.value = null
    saveError.value = null
  }

  function updateDraft(patch: Partial<TransactionDraft>): void {
    if (!draft.value) {
      draft.value = createEmptyDraft(masterDataStore.defaultCurrency)
    }
    draft.value = {
      ...draft.value,
      ...patch,
      updatedAt: utcNowIso(),
      lastError: null,
    }
    saveError.value = null
  }

  function parseChatInput(): void {
    parsedCommand.value = parseTransactionCommand(chatInput.value, {
      accounts: masterDataStore.accounts,
      categories: masterDataStore.categories,
      tags: masterDataStore.tags,
    })
  }

  function applyParsedCommand(): void {
    if (!parsedCommand.value || !draft.value) {
      return
    }
    const txType: TransactionKind = parsedCommand.value.action === 'add_income' ? 'income' : 'expense'
    const account = masterDataStore.accounts.find((item) => item.name === parsedCommand.value?.account)
    const category = masterDataStore.categories.find((item) => item.name === parsedCommand.value?.category)
    const tags = masterDataStore.tags.filter((item) => parsedCommand.value?.tagNames.includes(item.name))
    updateDraft({
      txType,
      amount: parsedCommand.value.amount ?? draft.value.amount,
      txDate: parsedCommand.value.txDate ?? draft.value.txDate,
      accountId: account?.id ?? draft.value.accountId,
      accountGlobalId: account?.global_id ?? draft.value.accountGlobalId,
      category: category?.name ?? draft.value.category,
      categoryId: category?.id ?? draft.value.categoryId,
      categoryGlobalId: category?.global_id ?? draft.value.categoryGlobalId,
      tagIds: tags.map((item) => item.id),
      tagGlobalIds: tags.map((item) => item.global_id),
      paymentMethod: parsedCommand.value.paymentMethod ?? draft.value.paymentMethod,
      description: parsedCommand.value.description ?? draft.value.description,
    })
  }

  async function saveDraft(): Promise<void> {
    if (!draft.value) {
      return
    }
    if (!masterDataStore.hasInitialMasterData) {
      saveError.value = 'capture.masterDataRequired'
      return
    }
    const nextDraft: TransactionDraft = {
      ...draft.value,
      syncState: 'pending_sync',
      updatedAt: utcNowIso(),
      lastError: null,
      masterDataBaseAt: masterDataStore.snapshot?.master_data_updated_at ?? draft.value.masterDataBaseAt,
    }
    await storageService.upsertPendingTransaction(nextDraft)
    pending.value = await storageService.listPendingTransactions()
    draft.value = nextDraft
  }

  function startEditing(localId: string): void {
    const selected = pending.value.find((item) => item.localId === localId)
    draft.value = selected ? { ...selected } : createEmptyDraft(masterDataStore.defaultCurrency)
  }

  async function removePending(localId: string): Promise<void> {
    await storageService.removePendingTransaction(localId)
    pending.value = await storageService.listPendingTransactions()
    if (draft.value?.localId === localId) {
      resetDraft()
    }
  }

  async function reloadPending(): Promise<void> {
    pending.value = await storageService.listPendingTransactions()
  }

  async function reconcileWithMasterData(snapshot: MasterDataSnapshot | null = masterDataStore.snapshot): Promise<void> {
    if (!snapshot) {
      return
    }
    const currentPending = await storageService.listPendingTransactions()
    let changed = false
    for (const item of currentPending) {
      const reconciled = reconcileDraftWithSnapshot(item, snapshot)
      if (JSON.stringify(reconciled) === JSON.stringify(item)) {
        continue
      }
      changed = true
      await storageService.upsertPendingTransaction(reconciled)
    }
    if (changed) {
      pending.value = await storageService.listPendingTransactions()
    } else {
      pending.value = currentPending
    }
    if (draft.value) {
      draft.value = reconcileDraftWithSnapshot(draft.value, snapshot)
    }
  }

  async function markAccepted(localId: string): Promise<void> {
    await storageService.removePendingTransaction(localId)
    await reloadPending()
    if (draft.value?.localId === localId) {
      resetDraft()
    }
  }

  async function markSyncError(localId: string, reason: string): Promise<void> {
    const selected = pending.value.find((item) => item.localId === localId)
    if (!selected) {
      return
    }
    await storageService.upsertPendingTransaction({
      ...selected,
      syncState: 'sync_error',
      lastError: reason,
      updatedAt: utcNowIso(),
    })
    await reloadPending()
  }

  return {
    pending,
    draft,
    chatInput,
    parsedCommand,
    saveError,
    pendingCount,
    initialize,
    updateDraft,
    resetDraft,
    parseChatInput,
    applyParsedCommand,
    saveDraft,
    startEditing,
    removePending,
    reloadPending,
    reconcileWithMasterData,
    markAccepted,
    markSyncError,
  }
})
