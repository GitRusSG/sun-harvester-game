/**
 * Prime field GF(p) arithmetic operations.
 * All operations produce results in the canonical range [0, p-1].
 */

import { PrimeFieldConfig } from '../types';
import { modAdd, modSub, modMul, modPow, modInverse } from '../core/mod-arithmetic';

/**
 * Computes (a + b) in GF(p).
 * Inputs are normalized to [0, p-1] before the operation.
 */
export function primeFieldAdd(a: bigint, b: bigint, config: PrimeFieldConfig): bigint {
  return modAdd(a, b, config.p);
}

/**
 * Computes (a - b) in GF(p).
 * Inputs are normalized to [0, p-1] before the operation.
 */
export function primeFieldSub(a: bigint, b: bigint, config: PrimeFieldConfig): bigint {
  return modSub(a, b, config.p);
}

/**
 * Computes (a × b) in GF(p).
 * Inputs are normalized to [0, p-1] before the operation.
 */
export function primeFieldMul(a: bigint, b: bigint, config: PrimeFieldConfig): bigint {
  return modMul(a, b, config.p);
}

/**
 * Computes the multiplicative inverse of a in GF(p).
 * Throws if a ≡ 0 (mod p), since zero has no multiplicative inverse.
 */
export function primeFieldInverse(a: bigint, config: PrimeFieldConfig): bigint {
  const { p } = config;
  const normalized = ((a % p) + p) % p;

  if (normalized === 0n) {
    throw new Error('The zero element has no multiplicative inverse.');
  }

  return modInverse(normalized, p);
}

/**
 * Computes (a / b) in GF(p), defined as a × b⁻¹.
 * Throws if b ≡ 0 (mod p), since division by zero is undefined.
 */
export function primeFieldDiv(a: bigint, b: bigint, config: PrimeFieldConfig): bigint {
  const { p } = config;
  const normalizedB = ((b % p) + p) % p;

  if (normalizedB === 0n) {
    throw new Error('Division by zero is undefined in any field.');
  }

  const bInv = modInverse(normalizedB, p);
  return modMul(a, bInv, p);
}

/**
 * Computes a^k in GF(p).
 * Supports negative exponents: a^(-k) = inverse(a)^k.
 * Throws if a ≡ 0 (mod p) and k < 0 (zero to negative power is undefined).
 */
export function primeFieldPow(a: bigint, k: bigint, config: PrimeFieldConfig): bigint {
  const { p } = config;
  const normalized = ((a % p) + p) % p;

  if (k < 0n) {
    if (normalized === 0n) {
      throw new Error('Exponentiation of zero to a negative power is undefined.');
    }
    const inv = modInverse(normalized, p);
    return modPow(inv, -k, p);
  }

  return modPow(normalized, k, p);
}
