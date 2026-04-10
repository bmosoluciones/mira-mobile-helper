// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { WebPlugin, registerPlugin } from '@capacitor/core'

export type QrScannerErrorCode = 'cancelled' | 'permission_denied' | 'scan_failed' | 'unavailable'

interface QrScanResult {
  rawText: string
}

interface QrScannerPlugin {
  scan(): Promise<QrScanResult>
}

export class QrScannerError extends Error {
  code: QrScannerErrorCode

  constructor(message: string, code: QrScannerErrorCode) {
    super(message)
    this.name = 'QrScannerError'
    this.code = code
  }
}

class QrScannerWeb extends WebPlugin implements QrScannerPlugin {
  async scan(): Promise<QrScanResult> {
    throw new QrScannerError('QR scanner is only available on Android.', 'unavailable')
  }
}

const CapacitorQrScanner = registerPlugin<QrScannerPlugin>('QrScanner', {
  web: async () => new QrScannerWeb(),
})

function normalizeScannerError(error: unknown): QrScannerError {
  if (error instanceof QrScannerError) {
    return error
  }
  if (typeof error === 'object' && error !== null) {
    const code = String((error as { code?: string }).code ?? '')
    const message = String((error as { message?: string }).message ?? 'QR scan failed.')
    switch (code) {
      case 'cancelled':
      case 'permission_denied':
      case 'scan_failed':
      case 'unavailable':
        return new QrScannerError(message, code)
      default:
        break
    }
  }
  return new QrScannerError(error instanceof Error ? error.message : 'QR scan failed.', 'scan_failed')
}

export async function scanPairingQr(): Promise<string> {
  try {
    const result = await CapacitorQrScanner.scan()
    const rawText = String(result.rawText ?? '').trim()
    if (!rawText) {
      throw new QrScannerError('QR scan did not return any payload.', 'scan_failed')
    }
    return rawText
  } catch (error) {
    throw normalizeScannerError(error)
  }
}
