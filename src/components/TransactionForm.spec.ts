// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

const masterDataStore = reactive({
  defaultCurrency: 'USD',
  accounts: [],
  categories: [],
  tags: [],
  hasInitialMasterData: true,
})

const transactionsStore = reactive({
  draft: {
    localId: 'draft-1',
    syncId: 'sync-1',
    baseVersion: 0,
    syncState: 'draft',
    txType: 'expense' as const,
    amount: 10,
    txDate: '2026-04-09',
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
    description: '',
    note: '',
    receiptPath: '/tmp/receipt.png',
    createdAt: '2026-04-09T12:00:00Z',
    updatedAt: '2026-04-09T12:00:00Z',
    lastError: null,
    masterDataBaseAt: null,
  },
  updateDraft: vi.fn((patch: Record<string, unknown>) => {
    Object.assign(transactionsStore.draft, patch)
  }),
  resetDraft: vi.fn(),
  saveDraft: vi.fn(),
  saveError: null as string | null,
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/masterData', () => ({
  useMasterDataStore: () => masterDataStore,
}))

vi.mock('@/stores/transactions', () => ({
  useTransactionsStore: () => transactionsStore,
}))

import TransactionForm from '@/components/TransactionForm.vue'

describe('TransactionForm', () => {
  beforeEach(() => {
    transactionsStore.draft.note = ''
    transactionsStore.draft.receiptPath = '/tmp/receipt.png'
    transactionsStore.saveError = null
    masterDataStore.hasInitialMasterData = true
    transactionsStore.updateDraft.mockClear()
    transactionsStore.resetDraft.mockClear()
    transactionsStore.saveDraft.mockClear()
  })

  it('shows notes in the optional section without rendering the receipt path field', async () => {
    const wrapper = mount(TransactionForm)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    await checkboxes[1].setValue(true)

    expect(wrapper.text()).toContain('form.note')
    expect(wrapper.text()).not.toContain('form.receipt')
    expect(wrapper.find('textarea.note-textarea').exists()).toBe(true)
    expect(wrapper.find('[id^="txf-rcpt-"]').exists()).toBe(false)
  })

  it('disables save when the initial master data feed is missing', () => {
    masterDataStore.hasInitialMasterData = false
    const wrapper = mount(TransactionForm)

    const actions = wrapper.findAll('.tx-action-btn')

    expect(actions[1].attributes('disabled')).toBeDefined()
  })
})
