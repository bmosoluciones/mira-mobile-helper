// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { createPinia, setActivePinia } from 'pinia'

import { storageService } from '@/services/storage'
import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionsStore } from '@/stores/transactions'

describe('useTransactionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('reconciles legacy pending transactions with refreshed master data', async () => {
    const snapshot = {
      generated_at: '2026-04-09T12:00:00Z',
      schema_version: 3,
      default_currency: 'USD',
      master_data_updated_at: '2026-04-09T12:00:00Z',
      accounts: [
        {
          id: 1,
          name: 'Wallet',
          account_type: 'cash',
          currency: 'USD',
          global_id: 'acc-1',
          updated_at: '2026-04-09T12:00:00Z',
          sync_version: 1,
        },
      ],
      categories: [
        {
          id: 2,
          name: 'Food',
          type: 'expense' as const,
          parent_id: null,
          global_id: 'cat-1',
          updated_at: '2026-04-09T12:00:00Z',
          sync_version: 1,
        },
      ],
      tags: [
        {
          id: 3,
          name: 'Urgent',
          global_id: 'tag-1',
          updated_at: '2026-04-09T12:00:00Z',
          sync_version: 1,
        },
      ],
      savings_goals: [],
    }

    vi.spyOn(storageService, 'replaceMasterData').mockResolvedValue()
    vi.spyOn(storageService, 'getMasterData').mockResolvedValue(null)
    vi.spyOn(storageService, 'listPendingTransactions').mockResolvedValue([
      {
        localId: 'local-1',
        syncId: 'sync-1',
        baseVersion: 0,
        syncState: 'pending_sync',
        txType: 'expense',
        amount: 20,
        txDate: '2026-04-09',
        accountId: 1,
        accountGlobalId: null,
        category: 'Food',
        categoryId: 2,
        categoryGlobalId: null,
        tagIds: [3],
        tagGlobalIds: [],
        paymentMethod: 'cash',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Lunch',
        note: '',
        receiptPath: null,
        createdAt: '2026-04-09T12:00:00Z',
        updatedAt: '2026-04-09T12:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      },
    ])
    const upsertSpy = vi.spyOn(storageService, 'upsertPendingTransaction').mockResolvedValue()

    const masterDataStore = useMasterDataStore()
    const transactionsStore = useTransactionsStore()

    await masterDataStore.replace(snapshot)
    await transactionsStore.initialize()
    await transactionsStore.reconcileWithMasterData(snapshot)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accountGlobalId: 'acc-1',
        categoryGlobalId: 'cat-1',
        tagGlobalIds: ['tag-1'],
        masterDataBaseAt: '2026-04-09T12:00:00Z',
      }),
    )
  })

  it('does not save drafts before the initial master data feed exists', async () => {
    vi.spyOn(storageService, 'listPendingTransactions').mockResolvedValue([])
    const upsertSpy = vi.spyOn(storageService, 'upsertPendingTransaction').mockResolvedValue()

    const transactionsStore = useTransactionsStore()

    await transactionsStore.initialize()
    await transactionsStore.saveDraft()

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(transactionsStore.saveError).toBe('capture.masterDataRequired')
  })
})
