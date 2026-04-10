// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

type SubstitutionRule = [RegExp, string | ((match: string, ...groups: string[]) => string)]

const substitutions: SubstitutionRule[] = [
  [/\s+/g, ' '],
  [/\$(\s*)/g, ''],
  [/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g, (match: string) => match.replace(/,/g, '')],
  [/\b(\d+(?:\.\d+)?)\s+dollars?\b/gi, '$1'],
  [/\b(\d+(?:\.\d+)?)\s+usd\b/gi, '$1'],
  [/\b(earn(?:ed)?|got paid|cobr[eé]|ingres[oó]|gan[eé]|recib[ií]|deposit[eé])\b/gi, 'received'],
  [/\bmil\b/gi, '1000'],
  [/\b(\d+(?:\.\d+)?)\s*k\b/gi, (_match: string, amount: string) => String(Number(amount) * 1000)],
  [/\b(pay(?:ed)?|paid|pagu[eé]|compr[eé]|gast[eé]|bought|spent|comida|lunch)\b/gi, 'spent'],
]

export function normalizeText(input: string): string {
  let current = input.trim().toLowerCase()
  for (const [pattern, replacement] of substitutions) {
    current =
      typeof replacement === 'string'
        ? current.replace(pattern, replacement)
        : current.replace(pattern, (...args) => replacement(String(args[0]), ...args.slice(1, -2).map(String)))
  }
  return current.replace(/\s+/g, ' ').trim()
}
