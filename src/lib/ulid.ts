// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 - 2026 BMO Soluciones, S.A.

/**
 * Generates a ULID (Universally Unique Lexicographically Sortable Identifier).
 * Uses the same Crockford Base32 encoding as the Python sync_utils.generate_ulid().
 * Output is 26 characters: 10 timestamp chars + 16 random chars.
 */

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeCrockford(value: bigint, length: number): string {
  const chars: string[] = new Array<string>(length).fill('0')
  let current = value
  for (let i = length - 1; i >= 0; i--) {
    chars[i] = CROCKFORD_BASE32[Number(current & 0x1fn)]
    current >>= 5n
  }
  return chars.join('')
}

export function generateUlid(): string {
  const timestampMs = BigInt(Date.now())
  const randomBytes = crypto.getRandomValues(new Uint8Array(10))
  let randomness = 0n
  for (const byte of randomBytes) {
    randomness = (randomness << 8n) | BigInt(byte)
  }
  return encodeCrockford(timestampMs, 10) + encodeCrockford(randomness, 16)
}
