// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { flushPromises, mount } from '@vue/test-utils'

const testState = vi.hoisted(() => ({
  route: { path: '/capture' },
  router: {
    replace: vi.fn(),
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
  },
  syncStore: {
    initialize: vi.fn().mockResolvedValue(undefined),
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
        'nav.label': 'Navegación principal',
        'nav.capture': 'Nuevo Registro',
        'nav.pending': 'Transacciones',
        'settings.title': 'Configuración',
        'theme.toLightMode': 'Cambiar a tema claro',
        'theme.toDarkMode': 'Cambiar a tema oscuro',
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

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
  loadTheme: vi.fn(() => 'light'),
  toggleTheme: vi.fn(() => 'dark'),
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
    testState.syncStore.initialize.mockClear()
    testState.transactionsStore.initialize.mockClear()
    testState.transactionsStore.pendingCount = 3
    testState.router.replace.mockClear()
    testState.route.path = '/capture'
  })

  it('renders updated navigation labels and icons', async () => {
    const wrapper = mount(App)

    await flushPromises()

    const navItems = wrapper.findAll('.nav-item')

    expect(navItems).toHaveLength(2)
    expect(navItems[0].text()).toContain('Nuevo Registro')
    expect(navItems[1].text()).toContain('Transacciones')
    expect(navItems[0].find('.nav-icon').text()).toBe('➕')
    expect(navItems[1].find('.nav-icon').text()).toBe('≡')
    expect(navItems[1].find('.nav-badge').text()).toBe('3')
  })

  it('redirects capture to setup when master data is missing', async () => {
    testState.masterDataStore.hasInitialMasterData = false

    mount(App)
    await flushPromises()

    expect(testState.router.replace).toHaveBeenCalledWith('/setup')
  })
})
