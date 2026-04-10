<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A. -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { QrScannerError, scanPairingQr } from '@/services/qrScanner'
import { useMasterDataStore } from '@/stores/masterData'
import { usePreferencesStore } from '@/stores/preferences'
import { useSyncStore } from '@/stores/sync'
import type { MobileLanguage, MobileTheme } from '@/types/domain'

const { t } = useI18n()
const router = useRouter()
const masterDataStore = useMasterDataStore()
const preferencesStore = usePreferencesStore()
const syncStore = useSyncStore()

const showPairingPanel = ref(true)

const statusCopy = computed(() => {
  if (!syncStore.statusMessage) {
    return t('setup.syncIdle')
  }
  return syncStore.statusMessage.startsWith('sync.')
    ? t(syncStore.statusMessage)
    : syncStore.statusMessage
})

const canFinishSetup = computed(() => masterDataStore.hasInitialMasterData && !syncStore.isSyncing)

async function chooseLanguage(language: MobileLanguage): Promise<void> {
  await preferencesStore.save({ language })
  document.title = t('app.title')
}

async function chooseTheme(theme: MobileTheme): Promise<void> {
  await preferencesStore.save({ theme })
}

async function scanQr(): Promise<void> {
  showPairingPanel.value = true
  try {
    const rawPayload = await scanPairingQr()
    syncStore.applyPairingPayload(rawPayload)
  } catch (error) {
    if (error instanceof QrScannerError) {
      switch (error.code) {
        case 'cancelled':
          syncStore.setSyncStatus('sync.qrCancelled')
          return
        case 'permission_denied':
          syncStore.setSyncStatus('sync.cameraDenied')
          return
        case 'unavailable':
          syncStore.setSyncStatus('sync.qrUnavailable')
          return
        default:
          syncStore.setSyncStatus('sync.qrInvalid')
          return
      }
    }
    syncStore.setSyncStatus('sync.qrInvalid')
  }
}

async function finishSetup(): Promise<void> {
  if (!canFinishSetup.value) {
    syncStore.setSyncStatus('sync.masterDataIncomplete')
    return
  }
  await preferencesStore.completeSetup()
  void router.replace('/capture')
}
</script>

<template>
  <div class="screen-layout setup-layout">
    <section class="panel-card">
      <p class="eyebrow">{{ t('setup.eyebrow') }}</p>
      <h2 class="screen-title">{{ t('setup.title') }}</h2>
      <p class="hint">{{ t('setup.copy') }}</p>
    </section>

    <section class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">A</span>
        <h3>{{ t('settings.language') }}</h3>
      </div>
      <div class="segmented-row">
        <button
          class="secondary-button"
          :class="{ selected: preferencesStore.language === 'es' }"
          @click="chooseLanguage('es')"
        >
          {{ t('settings.languageEs') }}
        </button>
        <button
          class="secondary-button"
          :class="{ selected: preferencesStore.language === 'en' }"
          @click="chooseLanguage('en')"
        >
          {{ t('settings.languageEn') }}
        </button>
      </div>
    </section>

    <section class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">◐</span>
        <h3>{{ t('settings.theme') }}</h3>
      </div>
      <div class="segmented-row">
        <button
          class="secondary-button"
          :class="{ selected: preferencesStore.theme === 'light' }"
          @click="chooseTheme('light')"
        >
          {{ t('settings.themeLight') }}
        </button>
        <button
          class="secondary-button"
          :class="{ selected: preferencesStore.theme === 'dark' }"
          @click="chooseTheme('dark')"
        >
          {{ t('settings.themeDark') }}
        </button>
      </div>
    </section>

    <section class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">↻</span>
        <h3>{{ t('setup.syncTitle') }}</h3>
      </div>
      <p class="hint">{{ t('setup.syncCopy') }}</p>
      <p class="sync-status-text setup-status">{{ statusCopy }}</p>

      <div v-if="masterDataStore.hasInitialMasterData" class="setup-master-data-summary">
        {{ t('setup.masterDataReady', {
          accounts: masterDataStore.accounts.length,
          categories: masterDataStore.categories.length,
          tags: masterDataStore.tags.length,
        }) }}
      </div>

      <div class="sync-buttons-stack">
        <button class="qr-button" @click="scanQr">{{ t('sync.scanQr') }}</button>
        <button class="sync-button" :disabled="!syncStore.canSync || syncStore.isSyncing" @click="syncStore.synchronize">
          {{ syncStore.isSyncing ? t('sync.syncing') : t('sync.syncNow') }}
        </button>
      </div>

      <div v-if="showPairingPanel" class="pairing-collapse" style="margin-top: 0.75rem">
        <p class="hint">{{ t('sync.pairingFallbackHint') }}</p>
        <label class="field-block">
          <span class="field-label">{{ t('sync.pairingCode') }}</span>
          <input
            v-model="syncStore.pairingCode"
            class="text-input"
            inputmode="numeric"
            maxlength="6"
            :placeholder="t('sync.pairingPlaceholder')"
          />
        </label>
        <label class="field-block">
          <span class="field-label">{{ t('sync.pairingPayload') }}</span>
          <textarea
            v-model="syncStore.pairingPayloadText"
            class="chat-input compact"
            rows="3"
            :placeholder="t('sync.pairingPayloadPlaceholder')"
          />
        </label>
      </div>

      <button class="primary-button setup-finish-button" :disabled="!canFinishSetup" @click="finishSetup">
        {{ t('setup.finish') }}
      </button>
    </section>
  </div>
</template>
