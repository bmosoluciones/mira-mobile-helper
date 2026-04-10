// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import KpiCards from '@/components/KpiCards.vue'
import { i18n } from '@/i18n'
import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionsStore } from '@/stores/transactions'

describe('KpiCards', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders only current-month income and expense totals', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    i18n.global.locale.value = 'es'

    const masterDataStore = useMasterDataStore()
    masterDataStore.snapshot = {
      generated_at: '2026-04-15T12:00:00Z',
      schema_version: 3,
      default_currency: 'USD',
      master_data_updated_at: '2026-04-15T12:00:00Z',
      accounts: [],
      categories: [],
      tags: [],
      savings_goals: [],
    }

    const transactionsStore = useTransactionsStore()
    transactionsStore.pending = [
      {
        localId: 'local-income-current',
        syncId: 'sync-income-current',
        baseVersion: 0,
        syncState: 'pending_sync',
        txType: 'income',
        amount: 120,
        txDate: '2026-04-01',
        accountId: null,
        accountGlobalId: null,
        category: null,
        categoryId: null,
        categoryGlobalId: null,
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'transfer',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Salary advance',
        note: '',
        receiptPath: null,
        createdAt: '2026-04-01T09:00:00Z',
        updatedAt: '2026-04-01T09:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      },
      {
        localId: 'local-income-previous',
        syncId: 'sync-income-previous',
        baseVersion: 0,
        syncState: 'pending_sync',
        txType: 'income',
        amount: 999,
        txDate: '2026-03-20',
        accountId: null,
        accountGlobalId: null,
        category: null,
        categoryId: null,
        categoryGlobalId: null,
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'transfer',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Old income',
        note: '',
        receiptPath: null,
        createdAt: '2026-03-20T09:00:00Z',
        updatedAt: '2026-03-20T09:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      },
      {
        localId: 'local-expense-current',
        syncId: 'sync-expense-current',
        baseVersion: 0,
        syncState: 'pending_sync',
        txType: 'expense',
        amount: 42.5,
        txDate: '2026-04-03',
        accountId: null,
        accountGlobalId: null,
        category: null,
        categoryId: null,
        categoryGlobalId: null,
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'cash',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Groceries',
        note: '',
        receiptPath: null,
        createdAt: '2026-04-03T10:00:00Z',
        updatedAt: '2026-04-03T10:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      },
      {
        localId: 'local-expense-previous',
        syncId: 'sync-expense-previous',
        baseVersion: 0,
        syncState: 'pending_sync',
        txType: 'expense',
        amount: 88,
        txDate: '2026-02-28',
        accountId: null,
        accountGlobalId: null,
        category: null,
        categoryId: null,
        categoryGlobalId: null,
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'cash',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Old expense',
        note: '',
        receiptPath: null,
        createdAt: '2026-02-28T10:00:00Z',
        updatedAt: '2026-02-28T10:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      },
    ]

    const wrapper = mount(KpiCards, {
      global: {
        plugins: [pinia, i18n],
      },
    })

    expect(wrapper.find('.kpi-value.income').text()).toBe('USD 120.00')
    expect(wrapper.find('.kpi-value.expense').text()).toBe('USD 42.50')
    expect(wrapper.find('.kpi-period').text()).toBe('Resumen')
    expect(wrapper.text()).not.toContain('999.00')
    expect(wrapper.text()).not.toContain('88.00')
  })
})
