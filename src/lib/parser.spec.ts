// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

import { describe, expect, it } from 'vitest'

import { parseTransactionCommand } from '@/lib/parser'
import type { AccountOption, CategoryOption, TagOption } from '@/types/domain'

const EMPTY_CONTEXT = { accounts: [], categories: [], tags: [] }

function makeAccount(id: number, name: string): AccountOption {
  return { id, name, account_type: 'bank', currency: 'USD', global_id: `acc-${id}`, updated_at: '', sync_version: 1 }
}

function makeCategory(id: number, name: string, type: 'expense' | 'income' = 'expense'): CategoryOption {
  return { id, name, type, parent_id: null, global_id: `cat-${id}`, updated_at: '', sync_version: 1 }
}

function makeTag(id: number, name: string): TagOption {
  return { id, name, global_id: `tag-${id}`, updated_at: '', sync_version: 1 }
}

describe('parseTransactionCommand', () => {
  // TC-MOB-02: "Cena 5000 hoy" → amount=5000, description="Cena", date=today
  it('TC-MOB-02: parses "Cena 5000 hoy" into amount, description and today date', () => {
    const result = parseTransactionCommand('Cena 5000 hoy', EMPTY_CONTEXT)
    expect(result.action).toBe('add_expense')
    expect(result.amount).toBe(5000)
    expect(result.description).toBe('Cena')
    expect(result.txDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parses Spanish expense keyword "gaste 12.5 cafe efectivo"', () => {
    const result = parseTransactionCommand('gaste 12.5 cafe efectivo', EMPTY_CONTEXT)
    expect(result.action).toBe('add_expense')
    expect(result.amount).toBe(12.5)
    expect(result.description).toBe('cafe')
    expect(result.paymentMethod).toBe('cash')
  })

  it('parses Spanish income keyword "recibi 2000 nomina"', () => {
    const result = parseTransactionCommand('recibi 2000 nomina', EMPTY_CONTEXT)
    expect(result.action).toBe('add_income')
    expect(result.amount).toBe(2000)
    expect(result.description).toBe('nomina')
  })

  it('parses English expense "spent 15 coffee card"', () => {
    const result = parseTransactionCommand('spent 15 coffee card', EMPTY_CONTEXT)
    expect(result.action).toBe('add_expense')
    expect(result.amount).toBe(15)
    expect(result.description).toBe('coffee')
    expect(result.paymentMethod).toBe('card')
  })

  it('parses English income "received 500 salary"', () => {
    const result = parseTransactionCommand('received 500 salary', EMPTY_CONTEXT)
    expect(result.action).toBe('add_income')
    expect(result.amount).toBe(500)
    expect(result.description).toBe('salary')
  })

  it('returns action=none for empty input', () => {
    const result = parseTransactionCommand('', EMPTY_CONTEXT)
    expect(result.action).toBe('none')
    expect(result.amount).toBeNull()
  })

  it('resolves known category from context', () => {
    const ctx = { ...EMPTY_CONTEXT, categories: [makeCategory(1, 'Comida')] }
    const result = parseTransactionCommand('Comida 50', ctx)
    expect(result.category).toBe('Comida')
    expect(result.amount).toBe(50)
  })

  it('resolves known account from context', () => {
    const ctx = { ...EMPTY_CONTEXT, accounts: [makeAccount(1, 'Wallet')] }
    const result = parseTransactionCommand('100 lunch Wallet', ctx)
    expect(result.account).toBe('Wallet')
    expect(result.amount).toBe(100)
  })

  it('resolves known tag from context', () => {
    const ctx = { ...EMPTY_CONTEXT, tags: [makeTag(1, 'Urgente')] }
    const result = parseTransactionCommand('50 taxi Urgente', ctx)
    expect(result.tagNames).toContain('Urgente')
    expect(result.amount).toBe(50)
  })

  it('handles ISO date in input', () => {
    const result = parseTransactionCommand('lunch 25 2026-04-09', EMPTY_CONTEXT)
    expect(result.txDate).toBe('2026-04-09')
    expect(result.amount).toBe(25)
  })

  it('handles "ayer"/"yesterday" date keywords', () => {
    const result = parseTransactionCommand('cena 200 ayer', EMPTY_CONTEXT)
    expect(result.txDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.txDate).not.toBeNull()
  })

  it('handles comma as decimal separator in amounts', () => {
    const result = parseTransactionCommand('café 1,5', EMPTY_CONTEXT)
    expect(result.amount).toBe(1.5)
  })

  it('includes a human-readable message when an expense is parsed', () => {
    const result = parseTransactionCommand('Taxi 80 hoy', EMPTY_CONTEXT)
    expect(result.message).toBeTruthy()
    expect(result.message).toContain('80')
  })
})
