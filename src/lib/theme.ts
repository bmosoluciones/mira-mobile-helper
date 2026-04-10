// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * Light / Dark theme manager.
 * Persists the user preference in localStorage and applies `data-theme`
 * on the root `<html>` element.
 */

export const THEME_STORAGE_KEY = 'mira-theme'

export type Theme = 'light' | 'dark'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function loadTheme(): Theme {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
  // Validate the stored value is a known Theme before trusting it
  const saved: Theme | null = raw === 'light' || raw === 'dark' ? raw : null
  return saved ?? (systemPrefersDark() ? 'dark' : 'light')
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
