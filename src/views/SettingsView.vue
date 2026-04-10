<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A. -->

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePreferencesStore } from '@/stores/preferences'
import type { MobileLanguage, MobileTheme } from '@/types/domain'

const { t } = useI18n()
const preferencesStore = usePreferencesStore()
const savedMessage = ref('')

async function updateLanguage(event: Event): Promise<void> {
  const language = (event.target as HTMLSelectElement).value as MobileLanguage
  await preferencesStore.save({ language })
  document.title = t('app.title')
  savedMessage.value = t('settings.saved')
}

async function updateTheme(event: Event): Promise<void> {
  const theme = (event.target as HTMLSelectElement).value as MobileTheme
  await preferencesStore.save({ theme })
  savedMessage.value = t('settings.saved')
}
</script>

<template>
  <div class="screen-layout">
    <section class="panel-card">
      <p class="eyebrow">{{ t('settings.eyebrow') }}</p>
      <h2 class="screen-title">{{ t('settings.title') }}</h2>
      <p class="hint">{{ t('settings.copy') }}</p>
    </section>

    <section class="panel-card settings-panel">
      <label class="field-block">
        <span class="field-label">{{ t('settings.language') }}</span>
        <select class="text-input" :value="preferencesStore.language" @change="updateLanguage">
          <option value="es">{{ t('settings.languageEs') }}</option>
          <option value="en">{{ t('settings.languageEn') }}</option>
        </select>
      </label>

      <label class="field-block">
        <span class="field-label">{{ t('settings.theme') }}</span>
        <select class="text-input" :value="preferencesStore.theme" @change="updateTheme">
          <option value="light">{{ t('settings.themeLight') }}</option>
          <option value="dark">{{ t('settings.themeDark') }}</option>
        </select>
      </label>

      <p v-if="savedMessage" class="hint">{{ savedMessage }}</p>
    </section>

    <section class="panel-card">
      <div class="panel-header">
        <span class="panel-icon" aria-hidden="true">i</span>
        <h3>{{ t('settings.masterDataTitle') }}</h3>
      </div>
      <p class="hint">{{ t('settings.masterDataCopy') }}</p>
    </section>
  </div>
</template>
