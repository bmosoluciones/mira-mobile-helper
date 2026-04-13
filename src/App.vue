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
const currentTitle = computed(() => String(route.meta.title ?? t('app.title')))
const showChrome = computed(() => !route.meta.hideChrome)
const canGoBack = computed(() => !route.meta.root && route.path !== '/setup')
const syncBadgeLabel = computed(() => {
  if (syncStore.isSyncing) {
    return 'Sync'
  }
  if (transactionsStore.pendingCount > 0) {
    return `${transactionsStore.pendingCount}`
  }
  if (syncStore.lastSuccessfulSyncAt) {
    return 'OK'
  }
  return '!'
})

function enforceSetupRoute(): void {
  if (!isReady.value) {
    return
  }
  if (masterDataStore.hasInitialMasterData && route.path === '/setup') {
    void router.replace('/capture')
    return
  }
  if (!masterDataStore.hasInitialMasterData && route.path !== '/setup') {
    void router.replace('/setup')
  }
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
  <div class="app-shell" :data-theme="preferencesStore.theme">
    <header v-if="showChrome" class="topbar">
      <div class="topbar__leading">
        <button v-if="canGoBack" class="icon-button" type="button" @click="router.back()">
          &lt;
        </button>
        <button v-else class="icon-button icon-button--ghost" type="button">
          =
        </button>
        <div class="topbar__title">
          <span class="topbar__brand">MIRA</span>
          <strong>{{ currentTitle }}</strong>
        </div>
      </div>
      <RouterLink class="sync-pill" to="/pending">
        <span>{{ syncStore.isSyncing ? 'Experimental' : 'Sync' }}</span>
        <strong>{{ syncBadgeLabel }}</strong>
      </RouterLink>
    </header>

    <main v-if="isReady" class="page-shell">
      <RouterView />
    </main>
    <main v-else class="page-shell">
      <section class="card empty-state">
        <h2>Cargando MIRA Helper...</h2>
      </section>
    </main>

    <nav v-if="preferencesStore.setupCompleted && showChrome" class="bottom-nav bottom-nav--helper" :aria-label="t('nav.label')">
      <RouterLink class="nav-link" to="/capture">
        <span class="nav-link__icon">C</span>
        <span>{{ t('nav.capture') }}</span>
      </RouterLink>
      <RouterLink class="nav-link" to="/pending">
        <span class="nav-link__icon">S</span>
        <span>Sync</span>
      </RouterLink>
      <RouterLink class="nav-link" to="/settings">
        <span class="nav-link__icon">A</span>
        <span>Ajustes</span>
      </RouterLink>
    </nav>
  </div>
</template>
