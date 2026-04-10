// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

export type TransactionKind = 'expense' | 'income'

export type SyncState = 'draft' | 'pending_sync' | 'syncing' | 'sync_error'
export type MobileLanguage = 'en' | 'es'
export type MobileTheme = 'light' | 'dark'

export interface MobilePreferences {
  language: MobileLanguage
  theme: MobileTheme
  setupCompleted: boolean
}

interface SyncEntity {
  global_id: string
  updated_at: string
  sync_version: number
  last_modified_by_device_id?: string | null
}

export interface AccountOption extends SyncEntity {
  id: number
  name: string
  account_type: string
  currency: string
}

export interface CategoryOption extends SyncEntity {
  id: number
  name: string
  type: TransactionKind
  parent_id: number | null
  color?: string
  icon?: string
  is_savings?: boolean
}

export interface TagOption extends SyncEntity {
  id: number
  name: string
  color?: string
  icon?: string
}

export interface SavingsGoalOption extends SyncEntity {
  id: number
  name: string
  current_amount?: number
  target_amount?: number
}

export interface MasterDataSnapshot {
  generated_at: string
  schema_version: number
  default_currency: string
  master_data_updated_at: string
  accounts: AccountOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  savings_goals: SavingsGoalOption[]
}

export interface TransactionDraft {
  localId: string
  syncId: string
  baseVersion: number
  syncState: SyncState
  txType: TransactionKind
  amount: number
  txDate: string
  accountId: number | null
  accountGlobalId: string | null
  category: string | null
  categoryId: number | null
  categoryGlobalId: string | null
  tagIds: number[]
  tagGlobalIds: string[]
  paymentMethod: string
  sourceCurrency: string
  exchangeRate: number | null
  convertedAmount: number | null
  description: string
  note: string
  receiptPath: string | null
  createdAt: string
  updatedAt: string
  lastError: string | null
  masterDataBaseAt: string | null
}

export interface ParsedTransactionCommand {
  action: 'add_income' | 'add_expense' | 'none'
  amount: number | null
  description: string | null
  category: string | null
  account: string | null
  paymentMethod: string | null
  txDate: string | null
  tagNames: string[]
  message: string | null
}

export interface DeviceSyncState {
  deviceId: string | null
  lastAckedEventId: number
  lastHost: string | null
  pairedDesktop: DiscoveredDesktopService | null
  lastSuccessfulSyncAt: string | null
}

export interface SyncConflictRecord {
  localId: string
  syncId: string
  reason: string
  canonical: unknown
  createdAt: string
}

export interface DiscoveredDesktopService {
  host: string
  port: number
  protocolVersion: string
  pairingRequired: boolean
  advertisedAddresses: string[]
  transportScheme?: 'http' | 'https'
  tlsFingerprintSha256?: string | null
}

export interface PairingPayload {
  protocol_version: string
  api_base_url: string
  host: string
  port: number
  transport_scheme?: 'http' | 'https'
  tls_fingerprint_sha256?: string
  pairing_code: string
  pairing_token?: string
  pairing_expires_at: string
  advertised_addresses: string[]
}

export interface PairDeviceResponse {
  token: string
  token_expires_at: string
  protocol_version: string
  capabilities: string[]
  device: {
    device_id: string
    device_name: string
    app_id: string
    platform: string
    last_acked_event_id: number
  }
}

export interface PushOperationPayload {
  client_mutation_id: string
  operation: 'create' | 'update' | 'delete'
  sync_id: string
  base_version: number
  master_data_base_at?: string | null
  transaction?: {
    tx_type: TransactionKind
    account_global_id: string | null
    account_id?: number | null
    amount: number
    tx_date: string
    category?: string | null
    category_global_id?: string | null
    category_id?: number | null
    payment_method?: string
    description?: string
    note?: string
    exchange_rate?: number | null
    converted_amount?: number | null
    tag_global_ids?: string[]
    tag_ids?: number[]
  }
}

export interface PushTransactionResult {
  client_mutation_id: string | null
  status: 'accepted' | 'conflict' | 'rejected'
  code?: string
  reason?: string
  details?: Record<string, unknown>
  canonical?: unknown
}
