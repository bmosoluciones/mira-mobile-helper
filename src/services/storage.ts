// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

import { utcNowIso } from '@/lib/datetime'
import type {
  DeviceSyncState,
  DiscoveredDesktopService,
  MasterDataSnapshot,
  MobileLanguage,
  MobilePreferences,
  MobileTheme,
  SyncConflictRecord,
  TransactionDraft,
} from '@/types/domain'

const STORAGE_KEY = 'mira-mobile-helper.web-state'
const LEGACY_THEME_STORAGE_KEY = 'mira-theme'
const DB_NAME = 'mira_mobile_helper'
const STORAGE_SCHEMA_VERSION = 3

interface WebState {
  storageVersion: number
  preferences: MobilePreferences
  masterData: MasterDataSnapshot | null
  pendingTransactions: TransactionDraft[]
  deviceSyncState: DeviceSyncState
  conflicts: SyncConflictRecord[]
}

function detectDefaultLanguage(): MobileLanguage {
  const normalized = typeof navigator !== 'undefined' ? (navigator.language || 'es').slice(0, 2).toLowerCase() : 'es'
  return normalized === 'en' ? 'en' : 'es'
}

function detectDefaultTheme(): MobileTheme {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_THEME_STORAGE_KEY) : null
  if (raw === 'light' || raw === 'dark') {
    return raw
  }
  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  return prefersDark ? 'dark' : 'light'
}

function defaultPreferences(): MobilePreferences {
  return {
    language: detectDefaultLanguage(),
    theme: detectDefaultTheme(),
    setupCompleted: false,
  }
}

const DEFAULT_WEB_STATE: WebState = {
  storageVersion: STORAGE_SCHEMA_VERSION,
  preferences: defaultPreferences(),
  masterData: null,
  pendingTransactions: [],
  deviceSyncState: {
    deviceId: null,
    lastAckedEventId: 0,
    lastHost: null,
    pairedDesktop: null,
    lastSuccessfulSyncAt: null,
  },
  conflicts: [],
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS master_accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS master_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS master_tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS master_savings_goals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_transactions (
  local_id TEXT PRIMARY KEY,
  sync_id TEXT NOT NULL UNIQUE,
  base_version INTEGER NOT NULL,
  sync_state TEXT NOT NULL,
  tx_type TEXT NOT NULL,
  amount REAL NOT NULL,
  tx_date TEXT NOT NULL,
  account_id INTEGER,
  category TEXT,
  category_id INTEGER,
  payment_method TEXT NOT NULL,
  description TEXT NOT NULL,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS device_sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_conflicts (
  local_id TEXT PRIMARY KEY,
  sync_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  canonical_json TEXT NOT NULL
);
`

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}

function normalizeDiscoveredDesktopService(value: unknown): DiscoveredDesktopService | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Partial<DiscoveredDesktopService>
  const host = String(record.host ?? '').trim()
  const port = Number(record.port ?? 0)
  if (!host || !Number.isFinite(port) || port <= 0) {
    return null
  }
  const transportScheme = record.transportScheme === 'http' ? 'http' : 'https'
  const rawFingerprint = String(record.tlsFingerprintSha256 ?? '').trim().toLowerCase()
  const tlsFingerprintSha256 =
    rawFingerprint.length === 64 && /^[a-f0-9]+$/.test(rawFingerprint) ? rawFingerprint : null
  return {
    host,
    port,
    protocolVersion: String(record.protocolVersion ?? '1'),
    pairingRequired: Boolean(record.pairingRequired ?? true),
    advertisedAddresses: Array.isArray(record.advertisedAddresses)
      ? record.advertisedAddresses.map((item) => String(item))
      : [],
    transportScheme,
    tlsFingerprintSha256,
  }
}

function normalizeDeviceSyncState(value: Partial<DeviceSyncState> | null | undefined): DeviceSyncState {
  return {
    deviceId: value?.deviceId ?? null,
    lastAckedEventId: Number(value?.lastAckedEventId ?? 0),
    lastHost: value?.lastHost ?? null,
    pairedDesktop: normalizeDiscoveredDesktopService(value?.pairedDesktop ?? null),
    lastSuccessfulSyncAt: typeof value?.lastSuccessfulSyncAt === 'string' ? value.lastSuccessfulSyncAt : null,
  }
}

function normalizeLanguage(value: unknown): MobileLanguage {
  return value === 'en' ? 'en' : value === 'es' ? 'es' : detectDefaultLanguage()
}

function normalizeTheme(value: unknown): MobileTheme {
  return value === 'light' || value === 'dark' ? value : detectDefaultTheme()
}

function normalizePreferences(value: Partial<MobilePreferences> | null | undefined): MobilePreferences {
  return {
    language: normalizeLanguage(value?.language),
    theme: normalizeTheme(value?.theme),
    setupCompleted: Boolean(value?.setupCompleted ?? false),
  }
}

function normalizeMasterData(snapshot: MasterDataSnapshot | null): MasterDataSnapshot | null {
  if (!snapshot) {
    return null
  }
  return {
    ...snapshot,
    master_data_updated_at: snapshot.master_data_updated_at ?? snapshot.generated_at,
  }
}

function normalizeTransactionDraft(transaction: Partial<TransactionDraft>): TransactionDraft {
  return {
    localId: String(transaction.localId ?? ''),
    syncId: String(transaction.syncId ?? ''),
    baseVersion: Number(transaction.baseVersion ?? 0),
    syncState: transaction.syncState ?? 'draft',
    txType: transaction.txType ?? 'expense',
    amount: Number(transaction.amount ?? 0),
    txDate: String(transaction.txDate ?? utcNowIso().slice(0, 10)),
    accountId: transaction.accountId ?? null,
    accountGlobalId: transaction.accountGlobalId ?? null,
    category: transaction.category ?? null,
    categoryId: transaction.categoryId ?? null,
    categoryGlobalId: transaction.categoryGlobalId ?? null,
    tagIds: Array.isArray(transaction.tagIds) ? transaction.tagIds.map((item) => Number(item)) : [],
    tagGlobalIds: Array.isArray(transaction.tagGlobalIds) ? transaction.tagGlobalIds.map((item) => String(item)) : [],
    paymentMethod: transaction.paymentMethod ?? 'cash',
    sourceCurrency: transaction.sourceCurrency ?? 'USD',
    exchangeRate: transaction.exchangeRate ?? null,
    convertedAmount: transaction.convertedAmount ?? null,
    description: transaction.description ?? '',
    note: transaction.note ?? '',
    receiptPath: transaction.receiptPath ?? null,
    createdAt: transaction.createdAt ?? utcNowIso(),
    updatedAt: transaction.updatedAt ?? utcNowIso(),
    lastError: transaction.lastError ?? null,
    masterDataBaseAt: transaction.masterDataBaseAt ?? null,
  }
}

function normalizeWebState(state: Partial<WebState> | null | undefined): WebState {
  return {
    storageVersion: STORAGE_SCHEMA_VERSION,
    preferences: normalizePreferences(state?.preferences),
    masterData: normalizeMasterData(state?.masterData ?? null),
    pendingTransactions: Array.isArray(state?.pendingTransactions)
      ? state.pendingTransactions.map((item) => normalizeTransactionDraft(item))
      : [],
    deviceSyncState: normalizeDeviceSyncState(state?.deviceSyncState),
    conflicts: Array.isArray(state?.conflicts) ? state.conflicts : [],
  }
}

class WebStorageAdapter {
  private read(): WebState {
    const serialized = localStorage.getItem(STORAGE_KEY)
    if (!serialized) {
      return structuredClone(DEFAULT_WEB_STATE)
    }
    return normalizeWebState(parseJson<WebState>(serialized))
  }

  private write(nextState: WebState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWebState(nextState)))
  }

  async getPreferences(): Promise<MobilePreferences> {
    return normalizePreferences(this.read().preferences)
  }

  async savePreferences(preferences: MobilePreferences): Promise<void> {
    const state = this.read()
    state.preferences = normalizePreferences(preferences)
    this.write(state)
  }

  async replaceMasterData(snapshot: MasterDataSnapshot): Promise<void> {
    const state = this.read()
    state.masterData = normalizeMasterData(snapshot)
    this.write(state)
  }

  async getMasterData(): Promise<MasterDataSnapshot | null> {
    return normalizeMasterData(this.read().masterData)
  }

  async listPendingTransactions(): Promise<TransactionDraft[]> {
    return [...this.read().pendingTransactions].map(normalizeTransactionDraft).sort((left: TransactionDraft, right: TransactionDraft) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
  }

  async upsertPendingTransaction(transaction: TransactionDraft): Promise<void> {
    const state = this.read()
    const normalizedTransaction = normalizeTransactionDraft(transaction)
    const index = state.pendingTransactions.findIndex((item) => item.localId === normalizedTransaction.localId)
    if (index >= 0) {
      state.pendingTransactions[index] = normalizedTransaction
    } else {
      state.pendingTransactions.push(normalizedTransaction)
    }
    this.write(state)
  }

  async removePendingTransaction(localId: string): Promise<void> {
    const state = this.read()
    state.pendingTransactions = state.pendingTransactions.filter((item) => item.localId !== localId)
    this.write(state)
  }

  async saveDeviceSyncState(syncState: DeviceSyncState): Promise<void> {
    const state = this.read()
    state.deviceSyncState = normalizeDeviceSyncState(syncState)
    this.write(state)
  }

  async getDeviceSyncState(): Promise<DeviceSyncState> {
    return normalizeDeviceSyncState(this.read().deviceSyncState)
  }

  async saveConflict(conflict: SyncConflictRecord): Promise<void> {
    const state = this.read()
    state.conflicts = [conflict, ...state.conflicts.filter((item) => item.localId !== conflict.localId)].slice(0, 20)
    this.write(state)
  }
}

class SqliteStorageAdapter {
  private sqlite = new SQLiteConnection(CapacitorSQLite)
  private db: SQLiteDBConnection | null = null

  async initialize(): Promise<void> {
    const consistency = await this.sqlite.checkConnectionsConsistency()
    const hasConnection = (await this.sqlite.isConnection(DB_NAME, false)).result
    this.db =
      consistency.result && hasConnection
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
    await this.db.open()
    await this.db.execute(SCHEMA_SQL)
    await this.db.run(
      `
      INSERT INTO device_sync_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['storage_schema_version', String(STORAGE_SCHEMA_VERSION)],
    )
  }

  private requireDb(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('SQLite adapter not initialized.')
    }
    return this.db
  }

  async getPreferences(): Promise<MobilePreferences> {
    const result = await this.requireDb().query('SELECT value FROM device_sync_state WHERE key = ?', ['mobile_preferences'])
    const row = result.values?.[0]
    return row ? normalizePreferences(parseJson<MobilePreferences>(String(row.value))) : defaultPreferences()
  }

  async savePreferences(preferences: MobilePreferences): Promise<void> {
    await this.requireDb().run(
      `
      INSERT INTO device_sync_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['mobile_preferences', JSON.stringify(normalizePreferences(preferences))],
    )
  }

  async replaceMasterData(snapshot: MasterDataSnapshot): Promise<void> {
    const db = this.requireDb()
    const normalizedSnapshot = normalizeMasterData(snapshot)
    await db.execute(
      'DELETE FROM master_accounts; DELETE FROM master_categories; DELETE FROM master_tags; DELETE FROM master_savings_goals;',
    )
    if (!normalizedSnapshot) {
      return
    }
    for (const account of normalizedSnapshot.accounts) {
      await db.run('INSERT INTO master_accounts (id, name, raw_json) VALUES (?, ?, ?)', [
        account.id,
        account.name,
        JSON.stringify(account),
      ])
    }
    for (const category of normalizedSnapshot.categories) {
      await db.run('INSERT INTO master_categories (id, name, raw_json) VALUES (?, ?, ?)', [
        category.id,
        category.name,
        JSON.stringify(category),
      ])
    }
    for (const tag of normalizedSnapshot.tags) {
      await db.run('INSERT INTO master_tags (id, name, raw_json) VALUES (?, ?, ?)', [
        tag.id,
        tag.name,
        JSON.stringify(tag),
      ])
    }
    for (const goal of normalizedSnapshot.savings_goals) {
      await db.run('INSERT INTO master_savings_goals (id, name, raw_json) VALUES (?, ?, ?)', [
        goal.id,
        goal.name,
        JSON.stringify(goal),
      ])
    }
    await db.run(
      `
      INSERT INTO device_sync_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['master_data', JSON.stringify(normalizedSnapshot)],
    )
  }

  async getMasterData(): Promise<MasterDataSnapshot | null> {
    const result = await this.requireDb().query('SELECT value FROM device_sync_state WHERE key = ?', ['master_data'])
    const row = result.values?.[0]
    return row ? normalizeMasterData(parseJson<MasterDataSnapshot>(String(row.value))) : null
  }

  async listPendingTransactions(): Promise<TransactionDraft[]> {
    const result = await this.requireDb().query(
      'SELECT raw_json FROM pending_transactions ORDER BY updated_at DESC, local_id DESC',
    )
    return (result.values ?? []).map((row) => normalizeTransactionDraft(parseJson<TransactionDraft>(String(row.raw_json))))
  }

  async upsertPendingTransaction(transaction: TransactionDraft): Promise<void> {
    const normalizedTransaction = normalizeTransactionDraft(transaction)
    await this.requireDb().run(
      `
      INSERT INTO pending_transactions (
        local_id, sync_id, base_version, sync_state, tx_type, amount, tx_date,
        account_id, category, category_id, payment_method, description, note, updated_at, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(local_id) DO UPDATE SET
        sync_id = excluded.sync_id,
        base_version = excluded.base_version,
        sync_state = excluded.sync_state,
        tx_type = excluded.tx_type,
        amount = excluded.amount,
        tx_date = excluded.tx_date,
        account_id = excluded.account_id,
        category = excluded.category,
        category_id = excluded.category_id,
        payment_method = excluded.payment_method,
        description = excluded.description,
        note = excluded.note,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
      `,
      [
        normalizedTransaction.localId,
        normalizedTransaction.syncId,
        normalizedTransaction.baseVersion,
        normalizedTransaction.syncState,
        normalizedTransaction.txType,
        normalizedTransaction.amount,
        normalizedTransaction.txDate,
        normalizedTransaction.accountId,
        normalizedTransaction.category,
        normalizedTransaction.categoryId,
        normalizedTransaction.paymentMethod,
        normalizedTransaction.description,
        normalizedTransaction.note,
        normalizedTransaction.updatedAt,
        JSON.stringify(normalizedTransaction),
      ],
    )
  }

  async removePendingTransaction(localId: string): Promise<void> {
    await this.requireDb().run('DELETE FROM pending_transactions WHERE local_id = ?', [localId])
  }

  async saveDeviceSyncState(syncState: DeviceSyncState): Promise<void> {
    const db = this.requireDb()
    const normalizedSyncState = normalizeDeviceSyncState(syncState)
    await db.run(
      `
      INSERT INTO device_sync_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['sync_state', JSON.stringify(normalizedSyncState)],
    )
  }

  async getDeviceSyncState(): Promise<DeviceSyncState> {
    const result = await this.requireDb().query('SELECT value FROM device_sync_state WHERE key = ?', ['sync_state'])
    const row = result.values?.[0]
    return row
      ? normalizeDeviceSyncState(parseJson<DeviceSyncState>(String(row.value)))
      : structuredClone(DEFAULT_WEB_STATE.deviceSyncState)
  }

  async saveConflict(conflict: SyncConflictRecord): Promise<void> {
    await this.requireDb().run(
      `
      INSERT INTO sync_conflicts (local_id, sync_id, reason, created_at, canonical_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(local_id) DO UPDATE SET
        sync_id = excluded.sync_id,
        reason = excluded.reason,
        created_at = excluded.created_at,
        canonical_json = excluded.canonical_json
      `,
      [conflict.localId, conflict.syncId, conflict.reason, conflict.createdAt, JSON.stringify(conflict.canonical)],
    )
  }
}

export class MobileHelperStorageService {
  private adapter: SqliteStorageAdapter | WebStorageAdapter | null = null

  async initialize(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      const sqliteAdapter = new SqliteStorageAdapter()
      await sqliteAdapter.initialize()
      this.adapter = sqliteAdapter
      return
    }
    this.adapter = new WebStorageAdapter()
  }

  private requireAdapter(): SqliteStorageAdapter | WebStorageAdapter {
    if (!this.adapter) {
      throw new Error('Storage service not initialized.')
    }
    return this.adapter
  }

  async getPreferences(): Promise<MobilePreferences> {
    return this.requireAdapter().getPreferences()
  }

  async savePreferences(preferences: MobilePreferences): Promise<void> {
    await this.requireAdapter().savePreferences(preferences)
  }

  async replaceMasterData(snapshot: MasterDataSnapshot): Promise<void> {
    await this.requireAdapter().replaceMasterData(snapshot)
  }

  async getMasterData(): Promise<MasterDataSnapshot | null> {
    return this.requireAdapter().getMasterData()
  }

  async listPendingTransactions(): Promise<TransactionDraft[]> {
    return this.requireAdapter().listPendingTransactions()
  }

  async upsertPendingTransaction(transaction: TransactionDraft): Promise<void> {
    await this.requireAdapter().upsertPendingTransaction(transaction)
  }

  async removePendingTransaction(localId: string): Promise<void> {
    await this.requireAdapter().removePendingTransaction(localId)
  }

  async getDeviceSyncState(): Promise<DeviceSyncState> {
    return this.requireAdapter().getDeviceSyncState()
  }

  async saveDeviceSyncState(syncState: DeviceSyncState): Promise<void> {
    await this.requireAdapter().saveDeviceSyncState(syncState)
  }

  async saveConflict(localId: string, syncId: string, reason: string, canonical: unknown): Promise<void> {
    await this.requireAdapter().saveConflict({
      localId,
      syncId,
      reason,
      canonical,
      createdAt: utcNowIso(),
    })
  }
}

export const storageService = new MobileHelperStorageService()
