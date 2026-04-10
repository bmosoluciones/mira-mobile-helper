// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

const preferencesStore = reactive({
  language: 'es',
  theme: 'light',
  save: vi.fn(),
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores/preferences', () => ({
  usePreferencesStore: () => preferencesStore,
}))

import SettingsView from '@/views/SettingsView.vue'

describe('SettingsView', () => {
  beforeEach(() => {
    preferencesStore.language = 'es'
    preferencesStore.theme = 'light'
    preferencesStore.save.mockResolvedValue(undefined)
    preferencesStore.save.mockClear()
  })

  it('saves language and theme preference changes', async () => {
    const wrapper = mount(SettingsView)
    const selects = wrapper.findAll('select')

    await selects[0].setValue('en')
    await selects[1].setValue('dark')

    expect(preferencesStore.save).toHaveBeenCalledWith({ language: 'en' })
    expect(preferencesStore.save).toHaveBeenCalledWith({ theme: 'dark' })
  })
})
