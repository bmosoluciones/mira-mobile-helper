// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { WebPlugin, registerPlugin } from '@capacitor/core'

export interface PinnedHttpRequest {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  fingerprintSha256?: string | null
}

export interface PinnedHttpResponse {
  status: number
  body: string
}

interface PinnedHttpPlugin {
  request(options: PinnedHttpRequest): Promise<PinnedHttpResponse>
}

class PinnedHttpWeb extends WebPlugin implements PinnedHttpPlugin {
  async request(options: PinnedHttpRequest): Promise<PinnedHttpResponse> {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    })
    return {
      status: response.status,
      body: await response.text(),
    }
  }
}

export const PinnedHttp = registerPlugin<PinnedHttpPlugin>('PinnedHttp', {
  web: async () => new PinnedHttpWeb(),
})
