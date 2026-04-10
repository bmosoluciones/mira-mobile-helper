// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { storageService } from '@/services/storage'
import type { MasterDataSnapshot } from '@/types/domain'

export function hasUsableInitialMasterData(snapshot: MasterDataSnapshot | null): boolean {
  return Boolean(snapshot && snapshot.accounts.length > 0 && snapshot.categories.length > 0 && Array.isArray(snapshot.tags))
}

export const useMasterDataStore = defineStore('masterData', () => {
  const snapshot = ref<MasterDataSnapshot | null>(null)

  const accounts = computed(() => snapshot.value?.accounts ?? [])
  const categories = computed(() => snapshot.value?.categories ?? [])
  const tags = computed(() => snapshot.value?.tags ?? [])
  const defaultCurrency = computed(() => snapshot.value?.default_currency ?? 'USD')
  const hasInitialMasterData = computed(() => hasUsableInitialMasterData(snapshot.value))

  async function initialize(): Promise<void> {
    snapshot.value = await storageService.getMasterData()
  }

  async function replace(nextSnapshot: MasterDataSnapshot): Promise<void> {
    snapshot.value = nextSnapshot
    await storageService.replaceMasterData(nextSnapshot)
  }

  return {
    snapshot,
    accounts,
    categories,
    tags,
    defaultCurrency,
    hasInitialMasterData,
    initialize,
    replace,
  }
})
