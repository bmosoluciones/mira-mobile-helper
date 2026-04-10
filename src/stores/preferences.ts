// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { ref } from 'vue'
import { defineStore } from 'pinia'

import { i18n } from '@/i18n'
import { applyTheme } from '@/lib/theme'
import { storageService } from '@/services/storage'
import type { MobileLanguage, MobilePreferences, MobileTheme } from '@/types/domain'

export const usePreferencesStore = defineStore('preferences', () => {
  const language = ref<MobileLanguage>('es')
  const theme = ref<MobileTheme>('light')
  const setupCompleted = ref(false)
  const isInitialized = ref(false)

  function applyPreferences(): void {
    i18n.global.locale.value = language.value
    document.documentElement.lang = language.value
    applyTheme(theme.value)
  }

  async function initialize(): Promise<void> {
    const stored = await storageService.getPreferences()
    language.value = stored.language
    theme.value = stored.theme
    setupCompleted.value = stored.setupCompleted
    applyPreferences()
    isInitialized.value = true
  }

  async function save(patch: Partial<MobilePreferences>): Promise<void> {
    language.value = patch.language ?? language.value
    theme.value = patch.theme ?? theme.value
    setupCompleted.value = patch.setupCompleted ?? setupCompleted.value
    applyPreferences()
    await storageService.savePreferences({
      language: language.value,
      theme: theme.value,
      setupCompleted: setupCompleted.value,
    })
  }

  async function completeSetup(): Promise<void> {
    await save({ setupCompleted: true })
  }

  return {
    language,
    theme,
    setupCompleted,
    isInitialized,
    initialize,
    save,
    completeSetup,
  }
})
