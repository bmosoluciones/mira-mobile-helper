// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * Natural-language transaction command parser for the mobile helper.
 *
 * Handles simple Spanish and English phrases like:
 *   "Cena 5000 hoy"  →  expense, amount=5000, description="Cena", date=today
 *   "gaste 12.5 cafe efectivo"  →  expense, amount=12.5, description="cafe", paymentMethod="cash"
 *   "recibi 2000 nomina"  →  income, amount=2000, description="nomina"
 *   "spent 15 coffee card"  →  expense, amount=15, description="coffee", paymentMethod="card"
 *
 * Covers TC-MOB-02 from PRUEBAS.md.
 */

import { todayIso, yesterdayIso } from '@/lib/datetime'
import type { AccountOption, CategoryOption, ParsedTransactionCommand, TagOption } from '@/types/domain'

interface ParserContext {
  accounts: AccountOption[]
  categories: CategoryOption[]
  tags: TagOption[]
}

// Keywords that signal an expense transaction
const EXPENSE_KEYWORDS = new Set([
  'gaste',
  'gasté',
  'gasto',
  'compre',
  'compré',
  'pagué',
  'pague',
  'spent',
  'paid',
  'bought',
  'expense',
])

// Keywords that signal an income transaction (action triggers only — not description words like "salary")
const INCOME_KEYWORDS = new Set([
  'recibi',
  'recibí',
  'ingreso',
  'cobré',
  'cobre',
  'earned',
  'received',
  'income',
])

// Date keywords mapped to a resolver function
const DATE_KEYWORDS: Record<string, () => string> = {
  hoy: todayIso,
  today: todayIso,
  ayer: yesterdayIso,
  yesterday: yesterdayIso,
}

// ISO date pattern: YYYY-MM-DD
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Payment method aliases
const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  efectivo: 'cash',
  cash: 'cash',
  tarjeta: 'card',
  card: 'card',
  débito: 'debit',
  debito: 'debit',
  debit: 'debit',
  crédito: 'credit',
  credito: 'credit',
  credit: 'credit',
  transferencia: 'transfer',
  transfer: 'transfer',
}

function normalizeTerm(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findCaseInsensitive<T extends { name: string }>(items: T[], word: string): T | undefined {
  const normalized = normalizeTerm(word)
  return items.find((item) => normalizeTerm(item.name) === normalized)
}

/**
 * Parse a natural-language transaction command into a structured object.
 *
 * @param input - Free-form text entered by the user.
 * @param context - Available master-data items for resolving references.
 */
export function parseTransactionCommand(input: string, context: ParserContext): ParsedTransactionCommand {
  const raw = input.trim()
  if (!raw) {
    return _emptyResult()
  }

  const tokens = raw.split(/\s+/)
  let action: ParsedTransactionCommand['action'] = 'add_expense'
  let amount: number | null = null
  let txDate: string | null = null
  let paymentMethod: string | null = null
  let category: string | null = null
  let account: string | null = null
  const tagNames: string[] = []
  const descriptionTokens: string[] = []

  for (const token of tokens) {
    const lower = token.toLowerCase()
    const normalized = normalizeTerm(token)

    // Income/expense action keyword
    if (INCOME_KEYWORDS.has(lower) || INCOME_KEYWORDS.has(normalized)) {
      action = 'add_income'
      continue
    }
    if (EXPENSE_KEYWORDS.has(lower) || EXPENSE_KEYWORDS.has(normalized)) {
      action = 'add_expense'
      continue
    }

    // Amount: a numeric token (handles "5000", "12.5", "1,500")
    const numericStr = token.replace(/,/g, '.')
    const numericVal = Number(numericStr)
    if (!isNaN(numericVal) && numericVal > 0 && amount === null) {
      amount = numericVal
      continue
    }

    // Date keyword or ISO date
    if (DATE_KEYWORDS[lower]) {
      txDate = DATE_KEYWORDS[lower]()
      continue
    }
    if (ISO_DATE_RE.test(token)) {
      txDate = token
      continue
    }

    // Payment method
    const methodAlias = PAYMENT_METHOD_ALIASES[lower] ?? PAYMENT_METHOD_ALIASES[normalized]
    if (methodAlias !== undefined && paymentMethod === null) {
      paymentMethod = methodAlias
      continue
    }

    // Tag match
    const matchedTag = findCaseInsensitive(context.tags, token)
    if (matchedTag) {
      tagNames.push(matchedTag.name)
      continue
    }

    // Account match
    const matchedAccount = findCaseInsensitive(context.accounts, token)
    if (matchedAccount && account === null) {
      account = matchedAccount.name
      continue
    }

    // Category match
    const matchedCategory = findCaseInsensitive(context.categories, token)
    if (matchedCategory && category === null) {
      category = matchedCategory.name
      continue
    }

    // Fall through: treat as description text
    descriptionTokens.push(token)
  }

  // Nothing useful was found
  if (amount === null && descriptionTokens.length === 0) {
    return _emptyResult()
  }

  const description = descriptionTokens.length > 0 ? descriptionTokens.join(' ') : null

  return {
    action,
    amount,
    description,
    category,
    account,
    paymentMethod,
    txDate,
    tagNames,
    message: _buildMessage(action, amount, description, txDate),
  }
}

function _emptyResult(): ParsedTransactionCommand {
  return {
    action: 'none',
    amount: null,
    description: null,
    category: null,
    account: null,
    paymentMethod: null,
    txDate: null,
    tagNames: [],
    message: null,
  }
}

function _buildMessage(
  action: ParsedTransactionCommand['action'],
  amount: number | null,
  description: string | null,
  txDate: string | null,
): string {
  const parts: string[] = []
  if (action === 'add_income') {
    parts.push('Ingreso')
  } else if (action === 'add_expense') {
    parts.push('Gasto')
  }
  if (amount !== null) {
    parts.push(String(amount))
  }
  if (description) {
    parts.push(`"${description}"`)
  }
  if (txDate) {
    parts.push(`(${txDate})`)
  }
  return parts.join(' ')
}
