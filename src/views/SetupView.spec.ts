// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}))

const qrScannerMocks = vi.hoisted(() => {
  class MockQrScannerError extends Error {
    code: string

    constructor(message: string, code: string) {
      super(message)
      this.name = 'QrScannerError'
      this.code = code
    }
  }

  return {
    scanPairingQr: vi.fn(),
    QrScannerError: MockQrScannerError,
  }
})

const masterDataStore = reactive({
  hasInitialMasterData: false,
  accounts: [],
  categories: [],
  tags: [],
})

const preferencesStore = reactive({
  language: 'es',
  theme: 'light',
  save: vi.fn(),
  completeSetup: vi.fn(),
})

const syncStore = reactive({
  pairingCode: '',
  pairingPayloadText: '',
  statusMessage: '',
  canSync: false,
  isSyncing: false,
  applyPairingPayload: vi.fn(),
  setSyncStatus: vi.fn(),
  synchronize: vi.fn(),
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
}))

vi.mock('@/services/qrScanner', () => qrScannerMocks)

vi.mock('@/stores/masterData', () => ({
  useMasterDataStore: () => masterDataStore,
}))

vi.mock('@/stores/preferences', () => ({
  usePreferencesStore: () => preferencesStore,
}))

vi.mock('@/stores/sync', () => ({
  useSyncStore: () => syncStore,
}))

import SetupView from '@/views/SetupView.vue'

describe('SetupView', () => {
  beforeEach(() => {
    masterDataStore.hasInitialMasterData = false
    masterDataStore.accounts = []
    masterDataStore.categories = []
    masterDataStore.tags = []
    preferencesStore.language = 'es'
    preferencesStore.theme = 'light'
    preferencesStore.save.mockResolvedValue(undefined)
    preferencesStore.save.mockClear()
    preferencesStore.completeSetup.mockResolvedValue(undefined)
    preferencesStore.completeSetup.mockClear()
    syncStore.statusMessage = ''
    syncStore.canSync = false
    syncStore.isSyncing = false
    syncStore.setSyncStatus.mockClear()
    syncStore.synchronize.mockClear()
    routerMocks.replace.mockClear()
  })

  it('keeps setup completion blocked until usable master data exists', async () => {
    const wrapper = mount(SetupView)

    expect(wrapper.find('.setup-finish-button').attributes('disabled')).toBeDefined()
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('finishes setup when accounts and categories were synchronized', async () => {
    masterDataStore.hasInitialMasterData = true
    const wrapper = mount(SetupView)

    await wrapper.find('.setup-finish-button').trigger('click')
    await flushPromises()

    expect(preferencesStore.completeSetup).toHaveBeenCalledOnce()
    expect(routerMocks.replace).toHaveBeenCalledWith('/capture')
  })

  it('persists language and theme choices from the wizard', async () => {
    const wrapper = mount(SetupView)

    await wrapper.findAll('.secondary-button')[1].trigger('click')
    await wrapper.findAll('.secondary-button')[3].trigger('click')

    expect(preferencesStore.save).toHaveBeenCalledWith({ language: 'en' })
    expect(preferencesStore.save).toHaveBeenCalledWith({ theme: 'dark' })
  })
})
