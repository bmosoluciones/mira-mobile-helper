// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { WebPlugin, registerPlugin } from '@capacitor/core'

import type { DiscoveredDesktopService } from '@/types/domain'

export interface ZeroconfDiscoveryPlugin {
  discover(options?: { timeoutMs?: number }): Promise<{ services: DiscoveredDesktopService[] }>
}

class ZeroconfDiscoveryWeb extends WebPlugin implements ZeroconfDiscoveryPlugin {
  async discover(): Promise<{ services: DiscoveredDesktopService[] }> {
    return { services: [] }
  }
}

export const ZeroconfDiscovery = registerPlugin<ZeroconfDiscoveryPlugin>('ZeroconfDiscovery', {
  web: async () => new ZeroconfDiscoveryWeb(),
})
