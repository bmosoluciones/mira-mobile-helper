// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { createPinia, setActivePinia } from 'pinia'

import { i18n } from '@/i18n'
import { applyTheme } from '@/lib/theme'
import { storageService } from '@/services/storage'
import { usePreferencesStore } from '@/stores/preferences'

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
}))

describe('usePreferencesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('loads persisted preferences and applies locale and theme', async () => {
    vi.spyOn(storageService, 'getPreferences').mockResolvedValue({
      language: 'en',
      theme: 'dark',
      setupCompleted: true,
    })

    const store = usePreferencesStore()
    await store.initialize()

    expect(store.language).toBe('en')
    expect(store.theme).toBe('dark')
    expect(store.setupCompleted).toBe(true)
    expect(i18n.global.locale.value).toBe('en')
    expect(applyTheme).toHaveBeenCalledWith('dark')
  })

  it('persists updates immediately', async () => {
    vi.spyOn(storageService, 'getPreferences').mockResolvedValue({
      language: 'es',
      theme: 'light',
      setupCompleted: false,
    })
    const saveSpy = vi.spyOn(storageService, 'savePreferences').mockResolvedValue()

    const store = usePreferencesStore()
    await store.initialize()
    await store.save({ language: 'en', theme: 'dark' })

    expect(saveSpy).toHaveBeenCalledWith({
      language: 'en',
      theme: 'dark',
      setupCompleted: false,
    })
    expect(i18n.global.locale.value).toBe('en')
    expect(applyTheme).toHaveBeenLastCalledWith('dark')
  })
})
