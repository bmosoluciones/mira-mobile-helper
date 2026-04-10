// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

const transactionsStore = reactive({
  chatInput: 'Spent 15 USD on lunch',
  parsedCommand: null as null | { action: 'add_expense' | 'add_income' | 'none'; amount?: number; description?: string },
  parseChatInput: vi.fn(() => {
    transactionsStore.parsedCommand = {
      action: 'add_expense',
      amount: 15,
      description: 'Lunch',
    }
  }),
  applyParsedCommand: vi.fn(),
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/transactions', () => ({
  useTransactionsStore: () => transactionsStore,
}))

import ChatPanel from '@/components/ChatPanel.vue'

describe('ChatPanel', () => {
  beforeEach(() => {
    transactionsStore.chatInput = 'Spent 15 USD on lunch'
    transactionsStore.parsedCommand = null
    transactionsStore.parseChatInput.mockClear()
    transactionsStore.applyParsedCommand.mockClear()
  })

  it('hides the status area before any parsed command exists', () => {
    const wrapper = mount(ChatPanel)

    expect(wrapper.find('.chat-status-row').exists()).toBe(false)
  })

  it('renders a single send action and applies the parsed draft in one click', async () => {
    const wrapper = mount(ChatPanel)

    const actionButtons = wrapper.findAll('.chat-action-row button')

    expect(actionButtons).toHaveLength(1)
    expect(actionButtons[0].text()).toBe('chat.parse')

    await actionButtons[0].trigger('click')

    expect(transactionsStore.parseChatInput).toHaveBeenCalledOnce()
    expect(transactionsStore.applyParsedCommand).toHaveBeenCalledOnce()
    expect(wrapper.find('.chat-avatar').exists()).toBe(false)
  })
})