// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { flushPromises, mount } from '@vue/test-utils'

const testState = vi.hoisted(() => ({
  route: { path: '/capture', meta: { title: 'Captura', root: true } },
  router: {
    replace: vi.fn(),
    back: vi.fn(),
  },
  storageService: {
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  masterDataStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
    hasInitialMasterData: true,
  },
  preferencesStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    theme: 'light',
    setupCompleted: true,
  },
  syncStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isSyncing: false,
    lastSuccessfulSyncAt: null,
  },
  transactionsStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
    pendingCount: 3,
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) => {
      const labels: Record<string, string> = {
        'app.title': 'Asistente MIRA',
        'app.loading': 'Preparando el asistente...',
        'nav.label': 'Navegacion principal',
        'nav.capture': 'Nuevo Registro',
      }
      if (key === 'nav.pendingBadge') {
        return `${params?.count ?? 0} pendientes`
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  RouterView: {
    template: '<div class="router-view-stub" />',
  },
  useRoute: () => testState.route,
  useRouter: () => testState.router,
}))

vi.mock('@/services/storage', () => ({
  storageService: testState.storageService,
}))

vi.mock('@/stores/masterData', () => ({
  useMasterDataStore: () => testState.masterDataStore,
}))

vi.mock('@/stores/preferences', () => ({
  usePreferencesStore: () => testState.preferencesStore,
}))

vi.mock('@/stores/sync', () => ({
  useSyncStore: () => testState.syncStore,
}))

vi.mock('@/stores/transactions', () => ({
  useTransactionsStore: () => testState.transactionsStore,
}))

import App from '@/App.vue'

describe('App', () => {
  beforeEach(() => {
    testState.storageService.initialize.mockClear()
    testState.masterDataStore.initialize.mockClear()
    testState.masterDataStore.hasInitialMasterData = true
    testState.preferencesStore.initialize.mockClear()
    testState.preferencesStore.save.mockClear()
    testState.preferencesStore.theme = 'light'
    testState.preferencesStore.setupCompleted = true
    testState.syncStore.initialize.mockClear()
    testState.syncStore.isSyncing = false
    testState.syncStore.lastSuccessfulSyncAt = null
    testState.transactionsStore.initialize.mockClear()
    testState.transactionsStore.pendingCount = 3
    testState.router.replace.mockClear()
    testState.router.back.mockClear()
    testState.route.path = '/capture'
    testState.route.meta = { title: 'Captura', root: true }
  })

  it('renders the shared shell navigation and sync badge', async () => {
    const wrapper = mount(App)

    await flushPromises()

    const navItems = wrapper.findAll('.nav-link')

    expect(navItems).toHaveLength(3)
    expect(navItems[0].text()).toContain('Nuevo Registro')
    expect(navItems[1].text()).toContain('Sync')
    expect(navItems[2].text()).toContain('Ajustes')
    expect(navItems[0].find('.nav-link__icon').text()).toBe('C')
    expect(navItems[1].find('.nav-link__icon').text()).toBe('S')
    expect(wrapper.find('.sync-pill').text()).toContain('3')
  })

  it('redirects to setup when master data is missing', async () => {
    testState.masterDataStore.hasInitialMasterData = false

    mount(App)
    await flushPromises()

    expect(testState.router.replace).toHaveBeenCalledWith('/setup')
  })
})
