// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

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

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

const syncStore = reactive({
  pairingCode: '',
  pairingPayloadText: '',
  statusMessage: '',
  canSync: false,
  isSyncing: false,
  lastSyncAgeDays: null as number | null,
  applyPairingPayload: vi.fn((raw: string) => {
    syncStore.pairingPayloadText = raw
  }),
  setSyncStatus: vi.fn((message: string) => {
    syncStore.statusMessage = message
  }),
  synchronize: vi.fn(),
})

const transactionsStore = reactive({
  pending: [] as Array<Record<string, unknown>>,
  startEditing: vi.fn(),
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) => {
      if (key === 'pending.lastSyncDays') {
        return `Han pasado ${params?.count ?? 0} días desde la última sincronización.`
      }
      if (key === 'pending.lastSyncNever') {
        return 'Aún no hay sincronización inicial.'
      }
      return key
    },
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
}))

vi.mock('@/services/qrScanner', () => qrScannerMocks)

vi.mock('@/stores/sync', () => ({
  useSyncStore: () => syncStore,
}))

vi.mock('@/stores/transactions', () => ({
  useTransactionsStore: () => transactionsStore,
}))

import PendingView from '@/views/PendingView.vue'

describe('PendingView', () => {
  beforeEach(() => {
    syncStore.pairingCode = ''
    syncStore.pairingPayloadText = ''
    syncStore.statusMessage = ''
    syncStore.canSync = false
    syncStore.isSyncing = false
    syncStore.lastSyncAgeDays = null
    syncStore.applyPairingPayload.mockClear()
    syncStore.setSyncStatus.mockClear()
    syncStore.synchronize.mockClear()
    transactionsStore.pending = []
    transactionsStore.startEditing.mockClear()
    routerMocks.push.mockClear()
    qrScannerMocks.scanPairingQr.mockReset()
  })

  it('loads the scanned QR payload into the sync store and reveals the fallback panel', async () => {
    qrScannerMocks.scanPairingQr.mockResolvedValue('{"pairing_code":"123456"}')
    const wrapper = mount(PendingView)

    await wrapper.find('.qr-button').trigger('click')
    await flushPromises()

    expect(syncStore.applyPairingPayload).toHaveBeenCalledWith('{"pairing_code":"123456"}')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('keeps the manual fallback visible and reports permission errors', async () => {
    qrScannerMocks.scanPairingQr.mockRejectedValue(
      new qrScannerMocks.QrScannerError('Camera permission denied.', 'permission_denied'),
    )
    const wrapper = mount(PendingView)

    await wrapper.find('.qr-button').trigger('click')
    await flushPromises()

    expect(syncStore.setSyncStatus).toHaveBeenCalledWith('sync.cameraDenied')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('does not render the idle sync message when no status is available', () => {
    const wrapper = mount(PendingView)

    expect(wrapper.find('.sync-status-text').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('sync.idle')
  })

  it('shows a small last sync age counter in the transactions list', () => {
    syncStore.lastSyncAgeDays = 3
    const wrapper = mount(PendingView)

    expect(wrapper.find('.last-sync-hint').text()).toBe('Han pasado 3 días desde la última sincronización.')
  })
})
