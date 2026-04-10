// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { createPinia, setActivePinia } from 'pinia'

import { storageService } from '@/services/storage'
import * as syncClient from '@/services/syncClient'
import { useSyncStore } from '@/stores/sync'

const DEFAULT_DEVICE_STATE = {
  deviceId: null as string | null,
  lastAckedEventId: 0,
  lastHost: null as string | null,
  pairedDesktop: null,
  lastSuccessfulSyncAt: null,
}

const DEFAULT_MASTER_DATA = {
  generated_at: '2026-04-09T12:00:00Z',
  schema_version: 3,
  default_currency: 'USD',
  master_data_updated_at: '2026-04-09T12:00:00Z',
  accounts: [
    {
      id: 1,
      name: 'Wallet',
      account_type: 'cash',
      currency: 'USD',
      global_id: 'acc-1',
      updated_at: '2026-04-09T12:00:00Z',
      sync_version: 1,
    },
  ],
  categories: [
    {
      id: 1,
      name: 'Food',
      type: 'expense' as const,
      parent_id: null,
      global_id: 'cat-1',
      updated_at: '2026-04-09T12:00:00Z',
      sync_version: 1,
    },
  ],
  tags: [],
  savings_goals: [],
}

const MOCK_PAIRING_RESPONSE = {
  token: 'auth-token',
  token_expires_at: '2026-04-09T13:00:00Z',
  protocol_version: '1',
  capabilities: [
    'master-data',
    'transactions-push',
    'transactions-changes',
    'transactions-ack',
    'secure-transport-tls-pinned',
  ] as string[],
  device: {
    device_id: 'device-1',
    device_name: 'test',
    app_id: 'mira',
    platform: 'android',
    last_acked_event_id: 0,
  },
}

const MOCK_DESKTOP = {
  host: '192.168.1.10',
  port: 43123,
  protocolVersion: '1',
  pairingRequired: true,
  advertisedAddresses: [] as string[],
}

describe('useSyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.spyOn(storageService, 'getMasterData').mockResolvedValue(null)
    vi.spyOn(storageService, 'listPendingTransactions').mockResolvedValue([])
  })

  describe('canSync', () => {
    it('is false when pairingCode is shorter than 6 digits and payload is empty', () => {
      const store = useSyncStore()
      store.pairingCode = '123'
      store.pairingPayloadText = ''
      expect(store.canSync).toBe(false)
    })

    it('is true when pairingCode has at least 6 digits', () => {
      const store = useSyncStore()
      store.pairingCode = '123456'
      expect(store.canSync).toBe(true)
    })

    it('is true when pairingPayloadText has any content', () => {
      const store = useSyncStore()
      store.pairingPayloadText = '{"host":"192.168.1.1"}'
      expect(store.canSync).toBe(true)
    })

    it('is false while a sync is already in progress', async () => {
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      let syncingSnapshot = false
      vi.spyOn(syncClient, 'discoverDesktopServices').mockImplementation(async () => {
        syncingSnapshot = useSyncStore().isSyncing
        return []
      })

      const store = useSyncStore()
      store.pairingCode = '123456'
      const promise = store.synchronize()
      expect(store.isSyncing).toBe(true)
      await promise
      expect(syncingSnapshot).toBe(true)
    })
  })

  describe('applyPairingPayload', () => {
    it('stores a validated QR payload and updates the status copy', () => {
      const store = useSyncStore()

      store.applyPairingPayload(
        JSON.stringify({
          transport_scheme: 'https',
          tls_fingerprint_sha256: 'a'.repeat(64),
          host: '192.168.1.15',
          port: 43123,
          pairing_code: '123456',
          pairing_token: 'token-abc-123',
          advertised_addresses: ['127.0.0.1', '192.168.1.15'],
        }),
      )

      expect(store.pairingPayloadText).toContain('"pairing_code":"123456"')
      expect(store.statusMessage).toBe('sync.qrReady')
    })
  })

  describe('synchronize', () => {
    it('sets statusMessage to sync.noDesktop when no desktop is reachable', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(store.statusMessage).toBe('sync.noDesktop')
      expect(store.isSyncing).toBe(false)
    })

    it('resets isSyncing to false even when an unexpected error is thrown', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockRejectedValue(new Error('network error'))
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(store.isSyncing).toBe(false)
      expect(store.statusMessage).toBe('network error')
    })

    it('does not continue sync when desktop returns incomplete master data', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: MOCK_PAIRING_RESPONSE,
      })
      vi.spyOn(syncClient, 'fetchMasterData').mockResolvedValue({
        ...DEFAULT_MASTER_DATA,
        accounts: [],
      })
      const pushSpy = vi.spyOn(syncClient, 'pushTransactions').mockResolvedValue({ results: [] })

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(store.statusMessage).toBe('sync.masterDataIncomplete')
      expect(pushSpy).not.toHaveBeenCalled()
      expect(store.isSyncing).toBe(false)
    })

    it('skips changes and ack when cursor capabilities are not negotiated', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: {
          ...MOCK_PAIRING_RESPONSE,
          capabilities: ['master-data', 'transactions-push', 'secure-transport-tls-pinned'],
        },
      })
      vi.spyOn(syncClient, 'fetchMasterData').mockResolvedValue(DEFAULT_MASTER_DATA)
      vi.spyOn(storageService, 'replaceMasterData').mockResolvedValue()
      vi.spyOn(syncClient, 'pushTransactions').mockResolvedValue({ results: [] })
      const fetchChangesSpy = vi.spyOn(syncClient, 'fetchChanges').mockResolvedValue({ changes: [], last_event_id: 1 })
      const ackChangesSpy = vi.spyOn(syncClient, 'ackChanges').mockResolvedValue({
        deviceId: 'device-1',
        lastAckedEventId: 1,
        lastHost: '192.168.1.10',
        pairedDesktop: null,
        lastSuccessfulSyncAt: null,
      })
      const saveDeviceStateSpy = vi.spyOn(storageService, 'saveDeviceSyncState').mockResolvedValue()

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(fetchChangesSpy).not.toHaveBeenCalled()
      expect(ackChangesSpy).not.toHaveBeenCalled()
      expect(saveDeviceStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-1',
          lastAckedEventId: 0,
          lastHost: '192.168.1.10',
        }),
      )
      expect(store.statusMessage).toBe('sync.success')
    })

    it('fails when desktop misses required sync capabilities', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: {
          ...MOCK_PAIRING_RESPONSE,
          capabilities: ['master-data'],
        },
      })

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(store.statusMessage).toBe('sync.missingCapability')
      expect(store.isSyncing).toBe(false)
    })

    it('fails when desktop protocol version is incompatible', async () => {
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: {
          ...MOCK_PAIRING_RESPONSE,
          protocol_version: '2',
        },
      })

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(store.statusMessage).toBe('sync.unsupportedProtocol')
      expect(store.isSyncing).toBe(false)
    })

    // TC-SYNC-04: conflict version handling
    it('saves conflict record and marks transaction with sync_error on version_conflict', async () => {
      const pendingItem = {
        localId: 'local-1',
        syncId: 'sync-1',
        baseVersion: 1,
        syncState: 'pending_sync' as const,
        txType: 'expense' as const,
        amount: 50,
        txDate: '2026-04-08',
        accountId: 1,
        accountGlobalId: 'acc-1',
        category: 'Food',
        categoryId: 1,
        categoryGlobalId: 'cat-1',
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'cash',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Conflict test',
        note: '',
        receiptPath: null,
        createdAt: '2026-04-08T10:00:00Z',
        updatedAt: '2026-04-08T10:00:00Z',
        lastError: null,
        masterDataBaseAt: '2026-04-09T12:00:00Z',
      }

      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: MOCK_PAIRING_RESPONSE,
      })
      vi.spyOn(syncClient, 'fetchMasterData').mockResolvedValue(DEFAULT_MASTER_DATA)
      vi.spyOn(storageService, 'replaceMasterData').mockResolvedValue()
      vi.spyOn(storageService, 'listPendingTransactions').mockResolvedValue([pendingItem])
      vi.spyOn(syncClient, 'pushTransactions').mockResolvedValue({
        results: [
          {
            client_mutation_id: 'local-1',
            status: 'conflict',
            code: 'version_conflict',
            reason: 'Version mismatch',
            canonical: { id: 42 },
          },
        ],
      })
      vi.spyOn(syncClient, 'fetchChanges').mockResolvedValue({ changes: [], last_event_id: 5 })
      vi.spyOn(syncClient, 'ackChanges').mockResolvedValue({
        deviceId: 'device-1',
        lastAckedEventId: 5,
        lastHost: '192.168.1.10',
        pairedDesktop: null,
        lastSuccessfulSyncAt: null,
      })
      vi.spyOn(storageService, 'upsertPendingTransaction').mockResolvedValue()
      const conflictSpy = vi.spyOn(storageService, 'saveConflict').mockResolvedValue()
      const saveDeviceStateSpy = vi.spyOn(storageService, 'saveDeviceSyncState').mockResolvedValue()

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(conflictSpy).toHaveBeenCalledWith(
        'local-1',
        'sync-1',
        expect.stringContaining('version'),
        { id: 42 },
      )
      // Sync operation itself completed successfully; individual tx conflict is logged separately
      expect(store.statusMessage).toBe('sync.success')
      expect(store.isSyncing).toBe(false)
    })

    it('removes accepted transactions from pending after a successful push', async () => {
      const pendingItem = {
        localId: 'local-2',
        syncId: 'sync-2',
        baseVersion: 0,
        syncState: 'pending_sync' as const,
        txType: 'expense' as const,
        amount: 20,
        txDate: '2026-04-09',
        accountId: null,
        accountGlobalId: null,
        category: null,
        categoryId: null,
        categoryGlobalId: null,
        tagIds: [],
        tagGlobalIds: [],
        paymentMethod: 'cash',
        sourceCurrency: 'USD',
        exchangeRate: null,
        convertedAmount: null,
        description: 'Accepted expense',
        note: '',
        receiptPath: null,
        createdAt: '2026-04-09T10:00:00Z',
        updatedAt: '2026-04-09T10:00:00Z',
        lastError: null,
        masterDataBaseAt: null,
      }

      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: MOCK_DESKTOP,
        response: MOCK_PAIRING_RESPONSE,
      })
      vi.spyOn(syncClient, 'fetchMasterData').mockResolvedValue(DEFAULT_MASTER_DATA)
      vi.spyOn(storageService, 'replaceMasterData').mockResolvedValue()
      vi.spyOn(storageService, 'listPendingTransactions')
        .mockResolvedValueOnce([pendingItem]) // reconcile
        .mockResolvedValueOnce([pendingItem]) // reloadPending after markAccepted
        .mockResolvedValue([])               // subsequent calls after removal
      vi.spyOn(syncClient, 'pushTransactions').mockResolvedValue({
        results: [{ client_mutation_id: 'local-2', status: 'accepted' }],
      })
      vi.spyOn(syncClient, 'fetchChanges').mockResolvedValue({ changes: [], last_event_id: 1 })
      vi.spyOn(syncClient, 'ackChanges').mockResolvedValue({
        deviceId: 'device-1',
        lastAckedEventId: 1,
        lastHost: '192.168.1.10',
        pairedDesktop: null,
        lastSuccessfulSyncAt: null,
      })
      vi.spyOn(storageService, 'upsertPendingTransaction').mockResolvedValue()
      const removeSpy = vi.spyOn(storageService, 'removePendingTransaction').mockResolvedValue()
      const saveDeviceStateSpy = vi.spyOn(storageService, 'saveDeviceSyncState').mockResolvedValue()

      const store = useSyncStore()
      store.pairingCode = '123456'
      await store.synchronize()

      expect(removeSpy).toHaveBeenCalledWith('local-2')
      expect(saveDeviceStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastSuccessfulSyncAt: expect.stringMatching(/Z$/) }),
      )
      expect(store.lastSuccessfulSyncAt).toEqual(expect.stringMatching(/Z$/))
      expect(store.statusMessage).toBe('sync.success')
    })

    it('prefers payload candidates before Zeroconf services when pairing from QR', async () => {
      const payloadHost = {
        host: '192.168.1.15',
        port: 43123,
        protocolVersion: '1',
        pairingRequired: true,
        advertisedAddresses: ['127.0.0.1', '192.168.1.15'],
      }
      vi.spyOn(syncClient, 'discoverDesktopServices').mockResolvedValue([MOCK_DESKTOP])
      vi.spyOn(storageService, 'getDeviceSyncState').mockResolvedValue(DEFAULT_DEVICE_STATE)
      const pairSpy = vi.spyOn(syncClient, 'pairDeviceAcrossHosts').mockResolvedValue({
        desktop: payloadHost,
        response: MOCK_PAIRING_RESPONSE,
      })
      vi.spyOn(syncClient, 'fetchMasterData').mockResolvedValue(DEFAULT_MASTER_DATA)
      vi.spyOn(storageService, 'replaceMasterData').mockResolvedValue()
      vi.spyOn(syncClient, 'fetchChanges').mockResolvedValue({ changes: [], last_event_id: 1 })
      vi.spyOn(syncClient, 'ackChanges').mockResolvedValue({
        deviceId: 'device-1',
        lastAckedEventId: 1,
        lastHost: '192.168.1.15',
        pairedDesktop: null,
        lastSuccessfulSyncAt: null,
      })
      vi.spyOn(storageService, 'saveDeviceSyncState').mockResolvedValue()

      const store = useSyncStore()
      store.applyPairingPayload(
        JSON.stringify({
          transport_scheme: 'https',
          tls_fingerprint_sha256: 'a'.repeat(64),
          host: '192.168.1.15',
          port: 43123,
          pairing_code: '123456',
          pairing_token: 'token-abc-123',
          advertised_addresses: ['127.0.0.1', '192.168.1.15'],
        }),
      )
      await store.synchronize()

      expect(pairSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({ host: '192.168.1.15' }),
          expect.objectContaining({ host: '127.0.0.1' }),
          expect.objectContaining({ host: '192.168.1.10' }),
        ],
        expect.objectContaining({
          pairingCode: '123456',
          pairingToken: 'token-abc-123',
        }),
      )
      expect(store.discoveredDesktop?.host).toBe('192.168.1.15')
    })
  })
})
