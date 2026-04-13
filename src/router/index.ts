// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { createRouter, createWebHistory } from 'vue-router'

import CaptureView from '@/views/CaptureView.vue'
import PendingView from '@/views/PendingView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SetupView from '@/views/SetupView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/capture' },
    { path: '/setup', component: SetupView, meta: { title: 'Setup', hideChrome: true } },
    { path: '/capture', component: CaptureView, meta: { title: 'Captura', root: true } },
    { path: '/pending', component: PendingView, meta: { title: 'Sync', root: true } },
    { path: '/settings', component: SettingsView, meta: { title: 'Ajustes', root: true } },
  ],
})
