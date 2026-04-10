// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { utcNowIso } from '@/lib/datetime'
import {
  SyncApiError,
  ackChanges,
  discoverDesktopServices,
  fetchChanges,
  fetchMasterData,
  pairDeviceAcrossHosts,
  parsePairingPayload,
  pushTransactions,
} from '@/services/syncClient'
import { storageService } from '@/services/storage'
import { hasUsableInitialMasterData, useMasterDataStore } from '@/stores/masterData'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import type { DiscoveredDesktopService, PushOperationPayload } from '@/types/domain'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SUPPORTED_PROTOCOL_VERSION = '1'
const REQUIRED_CAPABILITIES = ['master-data', 'transactions-push', 'secure-transport-tls-pinned']
const OPTIONAL_CURSOR_CAPABILITIES = ['transactions-changes', 'transactions-ack']

export const useSyncStore = defineStore('sync', () => {
  const pairingCode = ref('')
  const pairingPayloadText = ref('')
  const isSyncing = ref(false)
  const statusMessage = ref('')
  const discoveredDesktop = ref<DiscoveredDesktopService | null>(null)
  const lastSuccessfulSyncAt = ref<string | null>(null)
  const masterDataStore = useMasterDataStore()
  const preferencesStore = usePreferencesStore()
  const transactionsStore = useTransactionsStore()

  const canSync = computed(
    () => (pairingCode.value.trim().length >= 6 || pairingPayloadText.value.trim().length > 0) && !isSyncing.value,
  )
  const lastSyncAgeDays = computed(() => {
    if (!lastSuccessfulSyncAt.value) {
      return null
    }
    const timestamp = Date.parse(lastSuccessfulSyncAt.value)
    if (!Number.isFinite(timestamp)) {
      return null
    }
    return Math.max(0, Math.floor((Date.now() - timestamp) / ONE_DAY_MS))
  })

  async function initialize(): Promise<void> {
    const deviceState = await storageService.getDeviceSyncState()
    discoveredDesktop.value = deviceState.pairedDesktop
    lastSuccessfulSyncAt.value = deviceState.lastSuccessfulSyncAt
  }

  function resolvedPairingPayload() {
    const raw = pairingPayloadText.value.trim()
    if (!raw) {
      return null
    }
    return parsePairingPayload(raw)
  }

  function resolvedDesktopCandidates(
    payloadDesktop: DiscoveredDesktopService[] | null,
    discoveredServices: DiscoveredDesktopService[],
    pairedDesktop: DiscoveredDesktopService | null,
  ): DiscoveredDesktopService[] {
    const candidates = [...(payloadDesktop ?? []), ...discoveredServices]
    if (pairedDesktop) {
      candidates.push(pairedDesktop)
    }
    const seen = new Set<string>()
    return candidates.filter((desktop) => {
      const key = `${desktop.host}:${desktop.port}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  function syncFailureMessage(result: { code?: string; reason?: string; details?: Record<string, unknown> }): string {
    const referenceCode =
      typeof result.details?.reference_code === 'string'
        ? result.details.reference_code
        : typeof result.details?.missing_reference_code === 'string'
          ? result.details.missing_reference_code
          : null
    const effectiveCode = result.code === 'master_data_stale' && referenceCode ? referenceCode : result.code
    switch (effectiveCode) {
      case 'unknown_category':
        return 'Category error. Refresh master data and retry.'
      case 'unknown_account':
        return 'Account error. Refresh master data and retry.'
      case 'unknown_tag':
        return 'Tag error. Refresh master data and retry.'
      case 'version_conflict':
        return 'The desktop version changed before this update was applied.'
      case 'master_data_stale':
        return 'Master data changed on desktop. Refresh and retry.'
      case 'unsupported_protocol':
        return 'sync.unsupportedProtocol'
      case 'missing_capability':
        return 'sync.missingCapability'
      case 'certificate_pin_mismatch':
        return 'sync.certificatePinMismatch'
      case 'insecure_transport_blocked':
        return 'sync.insecureTransportBlocked'
      default:
        return result.reason ?? 'Unexpected sync error'
    }
  }

  function ensureNegotiatedContract(protocolVersion: string, capabilities: string[]): void {
    if (protocolVersion !== SUPPORTED_PROTOCOL_VERSION) {
      throw new SyncApiError('Unsupported sync protocol version.', {
        code: 'unsupported_protocol',
        details: {
          expected_protocol_version: SUPPORTED_PROTOCOL_VERSION,
          received_protocol_version: protocolVersion,
        },
      })
    }
    const missingCapabilities = REQUIRED_CAPABILITIES.filter((item) => !capabilities.includes(item))
    if (missingCapabilities.length > 0) {
      throw new SyncApiError('Desktop sync service is missing required capabilities.', {
        code: 'missing_capability',
        details: { missing_capabilities: missingCapabilities },
      })
    }
  }

  function buildOperations(): PushOperationPayload[] {
    return transactionsStore.pending.map((item) => ({
      client_mutation_id: item.localId,
      operation: item.baseVersion > 0 ? 'update' : 'create',
      sync_id: item.syncId,
      base_version: item.baseVersion,
      master_data_base_at: item.masterDataBaseAt,
      transaction: {
        tx_type: item.txType,
        account_global_id: item.accountGlobalId,
        account_id: item.accountId,
        amount: item.amount,
        tx_date: item.txDate,
        category: item.category,
        category_global_id: item.categoryGlobalId,
        category_id: item.categoryId,
        payment_method: item.paymentMethod,
        description: item.description,
        note: item.note,
        exchange_rate: item.exchangeRate,
        converted_amount: item.convertedAmount,
        tag_global_ids: item.tagGlobalIds,
        tag_ids: item.tagIds,
      },
    }))
  }

  function applyPairingPayload(raw: string): void {
    parsePairingPayload(raw)
    pairingPayloadText.value = raw.trim()
    statusMessage.value = 'sync.qrReady'
  }

  function setSyncStatus(message: string): void {
    statusMessage.value = message
  }

  async function synchronize(): Promise<void> {
    isSyncing.value = true
    statusMessage.value = ''
    try {
      const pairingPayload = resolvedPairingPayload()
      const services = await discoverDesktopServices()
      const deviceState = await storageService.getDeviceSyncState()
      const desktopCandidates = resolvedDesktopCandidates(
        pairingPayload?.candidateDesktops ?? null,
        services,
        deviceState.pairedDesktop ?? null,
      )
      discoveredDesktop.value = pairingPayload?.desktop ?? desktopCandidates[0] ?? null
      if (desktopCandidates.length === 0) {
        statusMessage.value = 'sync.noDesktop'
        return
      }

      const pairing = await pairDeviceAcrossHosts(desktopCandidates, {
        pairingCode: pairingPayload?.pairingCode ?? pairingCode.value.trim(),
        pairingToken: pairingPayload?.pairingToken ?? null,
        deviceId: deviceState.deviceId,
      })
      discoveredDesktop.value = pairing.desktop
      const negotiatedCapabilities = pairing.response.capabilities ?? []
      ensureNegotiatedContract(pairing.response.protocol_version, negotiatedCapabilities)

      const masterData = await fetchMasterData(discoveredDesktop.value, pairing.response.token)
      if (!hasUsableInitialMasterData(masterData)) {
        statusMessage.value = 'sync.masterDataIncomplete'
        return
      }
      await masterDataStore.replace(masterData)
      if (preferencesStore.isInitialized) {
        await preferencesStore.completeSetup()
      }
      await transactionsStore.reconcileWithMasterData(masterData)

      const operations = buildOperations()
      if (operations.length > 0) {
        const response = await pushTransactions(
          discoveredDesktop.value,
          pairing.response.token,
          operations,
          masterDataStore.snapshot?.master_data_updated_at ?? null,
        )
        for (const result of response.results) {
          const localId = result.client_mutation_id
          if (!localId) {
            continue
          }
          if (result.status === 'accepted') {
            await transactionsStore.markAccepted(localId)
            continue
          }
          const failureMessage = syncFailureMessage(result)
          await transactionsStore.markSyncError(localId, failureMessage)
          if (result.status === 'conflict') {
            const pendingItem = transactionsStore.pending.find((item) => item.localId === localId)
            if (pendingItem) {
              await storageService.saveConflict(
                localId,
                pendingItem.syncId,
                failureMessage,
                result.canonical,
              )
            }
          }
        }
      }

      const completedAt = utcNowIso()
      const supportsCursorSync = OPTIONAL_CURSOR_CAPABILITIES.every((item) => negotiatedCapabilities.includes(item))
      const nextDeviceState = supportsCursorSync
        ? {
            ...(await ackChanges(
              discoveredDesktop.value,
              pairing.response.token,
              (
                await fetchChanges(discoveredDesktop.value, pairing.response.token, deviceState.lastAckedEventId)
              ).last_event_id,
            )),
            pairedDesktop: discoveredDesktop.value,
            lastSuccessfulSyncAt: completedAt,
          }
        : {
            deviceId: pairing.response.device.device_id ?? deviceState.deviceId,
            lastAckedEventId: deviceState.lastAckedEventId,
            lastHost: discoveredDesktop.value.host,
            pairedDesktop: discoveredDesktop.value,
            lastSuccessfulSyncAt: completedAt,
          }
      await storageService.saveDeviceSyncState(nextDeviceState)
      lastSuccessfulSyncAt.value = completedAt
      statusMessage.value = 'sync.success'
    } catch (error) {
      if (error instanceof SyncApiError) {
        statusMessage.value = syncFailureMessage({ code: error.code ?? undefined, reason: error.message, details: error.details })
      } else {
        statusMessage.value = error instanceof Error ? error.message : 'Unexpected sync failure'
      }
    } finally {
      isSyncing.value = false
    }
  }

  return {
    pairingCode,
    pairingPayloadText,
    isSyncing,
    statusMessage,
    discoveredDesktop,
    lastSuccessfulSyncAt,
    lastSyncAgeDays,
    canSync,
    initialize,
    applyPairingPayload,
    setSyncStatus,
    synchronize,
  }
})
