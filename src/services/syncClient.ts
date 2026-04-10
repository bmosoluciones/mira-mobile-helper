// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import type {
  DeviceSyncState,
  DiscoveredDesktopService,
  MasterDataSnapshot,
  PairingPayload,
  PairDeviceResponse,
  PushOperationPayload,
  PushTransactionResult,
} from '@/types/domain'
import { PinnedHttp } from '@/services/pinnedHttp'
import { ZeroconfDiscovery } from '@/services/zeroconf'

interface HttpChangesResponse {
  changes: Array<Record<string, unknown>>
  last_event_id: number
}

interface PairParams {
  desktop: DiscoveredDesktopService
  pairingCode?: string | null
  pairingToken?: string | null
  deviceId?: string | null
}

export interface ParsedPairingPayload {
  desktop: DiscoveredDesktopService
  candidateDesktops: DiscoveredDesktopService[]
  pairingCode: string
  pairingToken: string | null
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

const MAX_PAIRING_PAYLOAD_LENGTH = 16_384
const SHA256_HEX_LENGTH = 64

export class SyncApiError extends Error {
  code: string | null
  details: Record<string, unknown> | undefined
  canonical: unknown

  constructor(
    message: string,
    {
      code = null,
      details,
      canonical,
    }: {
      code?: string | null
      details?: Record<string, unknown>
      canonical?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'SyncApiError'
    this.code = code
    this.details = details
    this.canonical = canonical
  }
}

function baseUrl(desktop: DiscoveredDesktopService): string {
  const scheme = desktop.transportScheme ?? 'https'
  return `${scheme}://${desktop.host}:${desktop.port}`
}

function normalizeHost(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function isIpv4Octet(value: string): boolean {
  return /^[0-9]{1,3}$/.test(value) && Number(value) >= 0 && Number(value) <= 255
}

function isLocalIpv4(host: string): boolean {
  if (host === 'localhost') {
    return true
  }
  const octets = host.split('.')
  if (octets.length !== 4 || octets.some((item) => !isIpv4Octet(item))) {
    return false
  }
  const [first, second] = octets.map(Number)
  if (first === 10 || first === 127) {
    return true
  }
  if (first === 192 && second === 168) {
    return true
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true
  }
  return first === 169 && second === 254
}

function orderedCandidateHosts(primaryHost: string, advertisedAddresses: string[]): string[] {
  const candidates = [primaryHost, ...advertisedAddresses.map((item) => normalizeHost(item)).filter(isLocalIpv4)]
  return [...new Set(candidates.filter(Boolean))]
}

function normalizeFingerprint(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized.length !== SHA256_HEX_LENGTH) {
    return null
  }
  return /^[a-f0-9]+$/.test(normalized) ? normalized : null
}

function buildDesktop(
  host: string,
  port: number,
  protocolVersion: string,
  advertisedAddresses: string[],
  transportScheme: 'http' | 'https',
  tlsFingerprintSha256: string | null,
): DiscoveredDesktopService {
  return {
    host,
    port,
    protocolVersion,
    pairingRequired: true,
    advertisedAddresses,
    transportScheme,
    tlsFingerprintSha256,
  }
}

function dedupeDesktops(desktops: DiscoveredDesktopService[]): DiscoveredDesktopService[] {
  const seen = new Set<string>()
  return desktops.filter((desktop) => {
    const key = `${desktop.host}:${desktop.port}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function requireSecureTransport(desktop: DiscoveredDesktopService): string {
  const scheme = desktop.transportScheme ?? 'https'
  if (scheme !== 'https') {
    throw new SyncApiError('Desktop service is not exposing a secure HTTPS transport.', {
      code: 'insecure_transport_blocked',
    })
  }
  const fingerprint = normalizeFingerprint(desktop.tlsFingerprintSha256)
  if (!fingerprint) {
    throw new SyncApiError('Desktop pairing payload is missing a valid TLS certificate fingerprint.', {
      code: 'validation_error',
    })
  }
  return fingerprint
}

async function fetchJson<T>(desktop: DiscoveredDesktopService, url: string, init?: RequestInit): Promise<T> {
  const fingerprint = requireSecureTransport(desktop)
  let rawResponse: { status: number; body: string }
  try {
    rawResponse = await PinnedHttp.request({
      url,
      method: String(init?.method ?? 'GET').toUpperCase() as 'GET' | 'POST',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
      fingerprintSha256: fingerprint,
    })
  } catch (error) {
    const code = String((error as { code?: string })?.code ?? '').trim().toLowerCase()
    if (code === 'certificate_pin_mismatch') {
      throw new SyncApiError('The desktop TLS fingerprint does not match the paired fingerprint.', {
        code: 'certificate_pin_mismatch',
      })
    }
    throw error
  }

  let payload = {} as T & {
    error?: string
    error_code?: string
    details?: Record<string, unknown>
    canonical?: unknown
  }
  try {
    payload = JSON.parse(rawResponse.body) as typeof payload
  } catch {
    payload = {} as typeof payload
  }

  if (rawResponse.status < 200 || rawResponse.status >= 300) {
    throw new SyncApiError(payload.error ?? `HTTP ${rawResponse.status}`, {
      code: payload.error_code ?? null,
      details: payload.details,
      canonical: payload.canonical,
    })
  }
  return payload
}

export function parsePairingPayload(raw: string): ParsedPairingPayload {
  const normalizedRaw = raw.trim()
  if (!normalizedRaw || normalizedRaw.length > MAX_PAIRING_PAYLOAD_LENGTH) {
    throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
  }

  let payload: Partial<PairingPayload>
  try {
    payload = JSON.parse(normalizedRaw) as Partial<PairingPayload>
  } catch {
    throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
  }

  const apiBaseUrl = String(payload.api_base_url ?? '').trim()
  let parsedUrl: URL | null = null
  if (apiBaseUrl) {
    try {
      parsedUrl = new URL(apiBaseUrl)
    } catch {
      throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
    }
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
    }
  }

  const host = normalizeHost(payload.host ?? parsedUrl?.hostname ?? '')
  const port = Number(payload.port ?? parsedUrl?.port ?? 0)
  const pairingCode = String(payload.pairing_code ?? '').trim()
  const protocolVersion = String(payload.protocol_version ?? '1')
  const transportScheme = String(
    payload.transport_scheme ?? (parsedUrl?.protocol === 'https:' ? 'https' : parsedUrl?.protocol === 'http:' ? 'http' : 'https'),
  ).trim().toLowerCase() as 'http' | 'https'
  const tlsFingerprintSha256 = normalizeFingerprint(payload.tls_fingerprint_sha256)
  const advertisedAddresses = Array.isArray(payload.advertised_addresses)
    ? payload.advertised_addresses.map((item) => normalizeHost(item)).filter(isLocalIpv4)
    : []
  if (!host || !isLocalIpv4(host) || !Number.isFinite(port) || port <= 0 || !pairingCode) {
    throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
  }
  if (transportScheme !== 'https') {
    throw new SyncApiError('Desktop service is not exposing a secure HTTPS transport.', {
      code: 'insecure_transport_blocked',
    })
  }
  if (!tlsFingerprintSha256) {
    throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
  }
  const candidateHosts = orderedCandidateHosts(host, advertisedAddresses)
  if (candidateHosts.length === 0) {
    throw new SyncApiError('Malformed pairing payload.', { code: 'validation_error' })
  }
  const desktop = buildDesktop(host, port, protocolVersion, advertisedAddresses, transportScheme, tlsFingerprintSha256)
  return {
    desktop,
    candidateDesktops: candidateHosts.map((candidateHost) =>
      buildDesktop(candidateHost, port, protocolVersion, advertisedAddresses, transportScheme, tlsFingerprintSha256),
    ),
    pairingCode,
    pairingToken: String(payload.pairing_token ?? '').trim() || null,
  }
}

export async function discoverDesktopServices(timeoutMs = 4000): Promise<DiscoveredDesktopService[]> {
  const { services } = await ZeroconfDiscovery.discover({ timeoutMs })
  return services
}

export async function pairDevice(params: PairParams): Promise<PairDeviceResponse> {
  return fetchJson<PairDeviceResponse>(params.desktop, `${baseUrl(params.desktop)}/api/mobile/v1/pair`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      pairing_code: params.pairingCode ?? undefined,
      pairing_token: params.pairingToken ?? undefined,
      device_id: params.deviceId ?? undefined,
      device_name: 'MIRA Mobile Helper',
      platform: 'android',
      app_id: 'mira-mobile-helper',
    }),
  })
}

export async function pairDeviceAcrossHosts(
  desktops: DiscoveredDesktopService[],
  params: Omit<PairParams, 'desktop'>,
): Promise<{ desktop: DiscoveredDesktopService; response: PairDeviceResponse }> {
  const uniqueDesktops = dedupeDesktops(desktops)
  let lastError: unknown = null

  for (const desktop of uniqueDesktops) {
    try {
      const response = await pairDevice({ ...params, desktop })
      return { desktop, response }
    } catch (error) {
      lastError = error
      if (
        error instanceof SyncApiError &&
        ['authorization_failed', 'pairing_expired'].includes(String(error.code ?? ''))
      ) {
        throw error
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new SyncApiError('No reachable desktop responded to the pairing request.', { code: 'network_unreachable' })
}

export async function fetchMasterData(desktop: DiscoveredDesktopService, token: string): Promise<MasterDataSnapshot> {
  return fetchJson<MasterDataSnapshot>(desktop, `${baseUrl(desktop)}/api/mobile/v1/master-data`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function pushTransactions(
  desktop: DiscoveredDesktopService,
  token: string,
  operations: PushOperationPayload[],
  masterDataBaseAt: string | null,
): Promise<{ results: PushTransactionResult[] }> {
  return fetchJson<{ results: PushTransactionResult[] }>(desktop, `${baseUrl(desktop)}/api/mobile/v1/transactions/push`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ operations, master_data_base_at: masterDataBaseAt ?? undefined }),
  })
}

export async function fetchChanges(
  desktop: DiscoveredDesktopService,
  token: string,
  afterEventId: number,
): Promise<HttpChangesResponse> {
  return fetchJson<HttpChangesResponse>(
    desktop,
    `${baseUrl(desktop)}/api/mobile/v1/transactions/changes?after_event_id=${afterEventId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
}

export async function ackChanges(
  desktop: DiscoveredDesktopService,
  token: string,
  lastEventId: number,
): Promise<DeviceSyncState> {
  const response = await fetchJson<{
    device: {
      device_id: string
      last_acked_event_id: number
    }
    last_acked_event_id: number
  }>(desktop, `${baseUrl(desktop)}/api/mobile/v1/transactions/ack`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ last_acked_event_id: lastEventId }),
  })
  return {
    deviceId: response.device.device_id,
    lastAckedEventId: response.last_acked_event_id,
    lastHost: desktop.host,
    pairedDesktop: null,
    lastSuccessfulSyncAt: null,
  }
}
