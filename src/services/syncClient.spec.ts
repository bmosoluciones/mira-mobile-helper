// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { SyncApiError, pairDeviceAcrossHosts, parsePairingPayload } from '@/services/syncClient'

describe('parsePairingPayload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts desktop coordinates and pairing secrets from the desktop payload', () => {
    const parsed = parsePairingPayload(
      JSON.stringify({
        protocol_version: '1',
        api_base_url: 'https://192.168.1.15:43123/api/mobile/v1',
        host: '192.168.1.15',
        port: 43123,
        transport_scheme: 'https',
        tls_fingerprint_sha256: 'a'.repeat(64),
        pairing_code: '123456',
        pairing_token: 'token-abc-123',
        pairing_expires_at: '2026-04-09T12:00:00Z',
        advertised_addresses: ['192.168.1.15', '127.0.0.1'],
      }),
    )

    expect(parsed.desktop.host).toBe('192.168.1.15')
    expect(parsed.desktop.port).toBe(43123)
    expect(parsed.desktop.transportScheme).toBe('https')
    expect(parsed.desktop.tlsFingerprintSha256).toBe('a'.repeat(64))
    expect(parsed.candidateDesktops.map((item) => item.host)).toEqual(['192.168.1.15', '127.0.0.1'])
    expect(parsed.pairingCode).toBe('123456')
    expect(parsed.pairingToken).toBe('token-abc-123')
  })

  it('rejects malformed pairing payloads', () => {
    expect(() => parsePairingPayload(JSON.stringify({ pairing_code: '' }))).toThrow(SyncApiError)
  })

  it('rejects payloads with public hosts', () => {
    expect(() =>
      parsePairingPayload(
        JSON.stringify({
          host: '8.8.8.8',
          port: 43123,
          pairing_code: '123456',
        }),
      ),
    ).toThrow(SyncApiError)
  })

  it('rejects insecure http pairing payloads', () => {
    expect(() =>
      parsePairingPayload(
        JSON.stringify({
          api_base_url: 'http://192.168.1.15:43123/api/mobile/v1',
          host: '192.168.1.15',
          port: 43123,
          pairing_code: '123456',
          tls_fingerprint_sha256: 'a'.repeat(64),
        }),
      ),
    ).toThrow(SyncApiError)
  })

  it('rejects oversized payloads', () => {
    expect(() => parsePairingPayload('x'.repeat(20_000))).toThrow(SyncApiError)
  })
})

describe('pairDeviceAcrossHosts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tries the next host when the preferred host is unreachable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({
          token: 'auth-token',
          token_expires_at: '2026-04-09T13:00:00Z',
          protocol_version: '1',
          capabilities: [],
          device: {
            device_id: 'device-1',
            device_name: 'Pixel',
            app_id: 'mira-mobile-helper',
            platform: 'android',
            last_acked_event_id: 0,
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await pairDeviceAcrossHosts(
      [
        {
          host: '127.0.0.1',
          port: 43123,
          protocolVersion: '1',
          pairingRequired: true,
          advertisedAddresses: ['127.0.0.1', '192.168.1.15'],
          transportScheme: 'https',
          tlsFingerprintSha256: 'a'.repeat(64),
        },
        {
          host: '192.168.1.15',
          port: 43123,
          protocolVersion: '1',
          pairingRequired: true,
          advertisedAddresses: ['127.0.0.1', '192.168.1.15'],
          transportScheme: 'https',
          tlsFingerprintSha256: 'a'.repeat(64),
        },
      ],
      {
        pairingCode: '123456',
        pairingToken: 'token-abc-123',
        deviceId: 'device-1',
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.desktop.host).toBe('192.168.1.15')
    expect(result.response.token).toBe('auth-token')
  })

  it('stops retrying when the pairing credentials are invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 401,
      text: async () => JSON.stringify({
        error: 'Invalid pairing code.',
        error_code: 'authorization_failed',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      pairDeviceAcrossHosts(
        [
          {
            host: '192.168.1.15',
            port: 43123,
            protocolVersion: '1',
            pairingRequired: true,
            advertisedAddresses: [],
            transportScheme: 'https',
            tlsFingerprintSha256: 'a'.repeat(64),
          },
          {
            host: '192.168.1.16',
            port: 43123,
            protocolVersion: '1',
            pairingRequired: true,
            advertisedAddresses: [],
            transportScheme: 'https',
            tlsFingerprintSha256: 'a'.repeat(64),
          },
        ],
        {
          pairingCode: '123456',
          pairingToken: null,
          deviceId: 'device-1',
        },
      ),
    ).rejects.toMatchObject({ code: 'authorization_failed' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
