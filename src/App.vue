<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { storageService } from '@/services/storage'
import { useMasterDataStore } from '@/stores/masterData'
import { usePreferencesStore } from '@/stores/preferences'
import { useSyncStore } from '@/stores/sync'
import { useTransactionsStore } from '@/stores/transactions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const masterDataStore = useMasterDataStore()
const preferencesStore = usePreferencesStore()
const syncStore = useSyncStore()
const transactionsStore = useTransactionsStore()

const isReady = ref(false)
const isDark = computed(() => preferencesStore.theme === 'dark')
const captureTarget = computed(() => (masterDataStore.hasInitialMasterData ? '/capture' : '/setup'))

async function onToggleTheme(): Promise<void> {
  if (!isReady.value) {
    return
  }
  await preferencesStore.save({ theme: isDark.value ? 'light' : 'dark' })
}

function enforceSetupRoute(): void {
  if (!isReady.value || masterDataStore.hasInitialMasterData || route.path !== '/capture') {
    return
  }
  void router.replace('/setup')
}

onMounted(async () => {
  await storageService.initialize()
  await preferencesStore.initialize()
  document.title = t('app.title')
  await masterDataStore.initialize()
  await syncStore.initialize()
  await transactionsStore.initialize()
  isReady.value = true
  enforceSetupRoute()
})

watch(() => [route.path, masterDataStore.hasInitialMasterData, isReady.value], enforceSetupRoute)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-icon">🤖</span>
        <span class="brand-name">{{ t('app.title') }}</span>
      </div>
      <div class="header-actions">
        <RouterLink class="header-icon-link" to="/settings" :title="t('settings.title')" :aria-label="t('settings.title')">
          ⚙
        </RouterLink>
        <button class="theme-toggle" :disabled="!isReady" :title="isDark ? t('theme.toLightMode') : t('theme.toDarkMode')" @click="onToggleTheme">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <main v-if="isReady" class="main-content">
      <RouterView />
    </main>
    <main v-else class="main-content">
      <p class="hint">{{ t('app.loading') }}</p>
    </main>

    <nav class="bottom-nav" role="navigation" :aria-label="t('nav.label')">
      <RouterLink class="nav-item" active-class="active" :to="captureTarget">
        <span class="nav-icon" aria-hidden="true">➕</span>
        <span class="nav-label">{{ t('nav.capture') }}</span>
      </RouterLink>
      <RouterLink class="nav-item" active-class="active" to="/pending">
        <span class="nav-icon" aria-hidden="true">≡</span>
        <span class="nav-label">{{ t('nav.pending') }}</span>
        <span v-if="transactionsStore.pendingCount > 0" class="nav-badge" :aria-label="t('nav.pendingBadge', { count: transactionsStore.pendingCount })">
          {{ transactionsStore.pendingCount }}
        </span>
      </RouterLink>
    </nav>
  </div>
</template>
