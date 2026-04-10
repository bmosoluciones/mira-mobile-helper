// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { Capacitor } from '@capacitor/core'

import { MobileHelperStorageService } from '@/services/storage'

const STORAGE_KEY = 'mira-mobile-helper.web-state'

describe('MobileHelperStorageService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes legacy pending drafts and device state from web storage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        masterData: null,
        pendingTransactions: [
          {
            localId: 'local-1',
            syncId: 'sync-1',
            baseVersion: 0,
            syncState: 'pending_sync',
            txType: 'expense',
            amount: 42.5,
            txDate: '2026-04-09',
            accountId: 1,
            category: 'Food',
            categoryId: 2,
            tagIds: [3],
            paymentMethod: 'cash',
            sourceCurrency: 'USD',
            exchangeRate: null,
            convertedAmount: null,
            description: 'Legacy lunch',
            note: '',
            receiptPath: null,
            createdAt: '2026-04-09T12:00:00Z',
            updatedAt: '2026-04-09T12:00:00Z',
            lastError: null,
          },
        ],
        deviceSyncState: {
          deviceId: 'device-1',
          lastAckedEventId: 7,
          lastHost: '192.168.1.20',
        },
        conflicts: [],
      }),
    )

    const service = new MobileHelperStorageService()
    await service.initialize()

    const pending = await service.listPendingTransactions()
    const deviceState = await service.getDeviceSyncState()

    expect(pending).toHaveLength(1)
    expect(pending[0].accountGlobalId).toBeNull()
    expect(pending[0].categoryGlobalId).toBeNull()
    expect(pending[0].tagGlobalIds).toEqual([])
    expect(pending[0].masterDataBaseAt).toBeNull()
    expect(deviceState.pairedDesktop).toBeNull()
    expect(deviceState.lastSuccessfulSyncAt).toBeNull()
  })

  it('keeps pending transactions after a new service instance initializes', async () => {
    const first = new MobileHelperStorageService()
    await first.initialize()
    await first.upsertPendingTransaction({
      localId: 'local-2',
      syncId: 'sync-2',
      baseVersion: 0,
      syncState: 'pending_sync',
      txType: 'expense',
      amount: 18,
      txDate: '2026-04-09',
      accountId: 1,
      accountGlobalId: 'acc-1',
      category: 'Food',
      categoryId: 2,
      categoryGlobalId: 'cat-1',
      tagIds: [3],
      tagGlobalIds: ['tag-1'],
      paymentMethod: 'cash',
      sourceCurrency: 'USD',
      exchangeRate: null,
      convertedAmount: null,
      description: 'Offline dinner',
      note: '',
      receiptPath: null,
      createdAt: '2026-04-09T13:00:00Z',
      updatedAt: '2026-04-09T13:00:00Z',
      lastError: null,
      masterDataBaseAt: '2026-04-09T12:00:00Z',
    })

    const second = new MobileHelperStorageService()
    await second.initialize()
    const pending = await second.listPendingTransactions()

    expect(pending).toHaveLength(1)
    expect(pending[0].description).toBe('Offline dinner')
    expect(pending[0].accountGlobalId).toBe('acc-1')
    expect(pending[0].tagGlobalIds).toEqual(['tag-1'])
  })

  it('persists mobile preferences and last successful sync metadata in web storage', async () => {
    const service = new MobileHelperStorageService()
    await service.initialize()

    await service.savePreferences({ language: 'en', theme: 'dark', setupCompleted: true })
    await service.saveDeviceSyncState({
      deviceId: 'device-1',
      lastAckedEventId: 9,
      lastHost: '192.168.1.20',
      pairedDesktop: null,
      lastSuccessfulSyncAt: '2026-04-10T12:00:00Z',
    })

    const next = new MobileHelperStorageService()
    await next.initialize()

    await expect(next.getPreferences()).resolves.toEqual({
      language: 'en',
      theme: 'dark',
      setupCompleted: true,
    })
    await expect(next.getDeviceSyncState()).resolves.toEqual({
      deviceId: 'device-1',
      lastAckedEventId: 9,
      lastHost: '192.168.1.20',
      pairedDesktop: null,
      lastSuccessfulSyncAt: '2026-04-10T12:00:00Z',
    })
  })

  it('preserves TLS transport fields when persisting and reloading a paired desktop', async () => {
    const service = new MobileHelperStorageService()
    await service.initialize()

    const fingerprint = 'a'.repeat(64)
    await service.saveDeviceSyncState({
      deviceId: 'device-1',
      lastAckedEventId: 3,
      lastHost: '192.168.1.15',
      pairedDesktop: {
        host: '192.168.1.15',
        port: 43123,
        protocolVersion: '1',
        pairingRequired: true,
        advertisedAddresses: ['192.168.1.15'],
        transportScheme: 'https',
        tlsFingerprintSha256: fingerprint,
      },
      lastSuccessfulSyncAt: '2026-04-10T12:00:00Z',
    })

    const reloaded = new MobileHelperStorageService()
    await reloaded.initialize()
    const state = await reloaded.getDeviceSyncState()

    expect(state.pairedDesktop?.transportScheme).toBe('https')
    expect(state.pairedDesktop?.tlsFingerprintSha256).toBe(fingerprint)
  })
})
