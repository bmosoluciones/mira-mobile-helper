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
    { path: '/setup', component: SetupView },
    { path: '/capture', component: CaptureView },
    { path: '/pending', component: PendingView },
    { path: '/settings', component: SettingsView },
  ],
})
