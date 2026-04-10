// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { createI18n } from 'vue-i18n'

import { en } from '@/locales/en'
import { es } from '@/locales/es'

function detectLocale(): 'en' | 'es' {
  const normalized = (navigator.language || 'es').slice(0, 2).toLowerCase()
  return normalized === 'en' ? 'en' : 'es'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'es',
  messages: {
    en,
    es,
  },
})
