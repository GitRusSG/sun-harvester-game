/**
 * Extension field GF(p^n) arithmetic operations.
 *
 * Elements of GF(p^n) are polynomials of degree < n with coefficients in [0, p-1].
 * Arithmetic is performed modulo an irreducible polynomial of degree n over GF(p).
 */

import { Polynomial, ExtFieldConfig } from '../types';
import {
  polyAdd,
  polySub,
  polyMul,
  polyDivMod,
  polyIsZero,
  polyNormalize,
} from '../poly/polynomial';
import { modInverse, modMul } from '../core/mod-arithmetic';

/**
 * Computes (a + b) in GF(p^n).
 * Coefficient-wise addition modulo p. The result has degree < n since both inputs do.
 */
export function extFieldAdd(a: Polynomial, b: Polynomial, config: ExtFieldConfig): Polynomial {
  return polyAdd(a, b, config.p);
}

/**
 * Computes (a - b) in GF(p^n).
 * Coefficient-wise subtraction modulo p. The result has degree < n since both inputs do.
 */
export function extFieldSub(a: Polynomial, b: Polynomial, config: ExtFieldConfig): Polynomial {
  return polySub(a, b, config.p);
}

/**
 * Computes (a × b) in GF(p^n).
 * Polynomial multiplication followed by reduction modulo the irreducible polynomial.
 */
export function extFieldMul(a: Polynomial, b: Polynomial, config: ExtFieldConfig): Polynomial {
  const product = polyMul(a, b, config.p);
  return polyDivMod(product, config.irreducible, config.p).remainder;
}

/**
 * Extended Euclidean algorithm for polynomials over GF(p).
 * Given polynomials a and b, finds s such that a * s ≡ gcd(a, b) (mod b).
 * Returns the polynomial s scaled so that a * s ≡ 1 (mod b) when gcd(a, b) = 1.
 */
function polyExtGcd(a: Polynomial, b: Polynomial, p: bigint): Polynomial {
  let oldR = polyNormalize(a);
  let r = polyNormalize(b);
  let oldS: Polynomial = [1n];
  let s: Polynomial = [];

  while (!polyIsZero(r)) {
    const { quotient } = polyDivMod(oldR, r, p);

    const newR = polySub(oldR, polyMul(quotient, r, p), p);
    oldR = r;
    r = newR;

    const newS = polySub(oldS, polyMul(quotient, s, p), p);
    oldS = s;
    s = newS;
  }

  // oldR is the GCD, oldS is the Bézout coefficient
  // Normalize: scale oldS so that a * oldS ≡ 1 (mod b)
  // The GCD should be a constant (since the irreducible polynomial divides nothing non-trivially)
  // We need to multiply oldS by the modular inverse of the leading (and only) coefficient of oldR
  const gcd = polyNormalize(oldR);
  if (gcd.length === 0) {
    throw new Error('The zero element has no multiplicative inverse.');
  }

  const leadCoeff = gcd[gcd.length - 1];
  const leadInv = modInverse(leadCoeff, p);

  // Scale oldS by leadInv so that a * result ≡ 1 (mod b)
  const result = oldS.map((c) => modMul(c, leadInv, p));
  return polyNormalize(result);
}

/**
 * Computes the multiplicative inverse of a in GF(p^n).
 * Uses the extended Euclidean algorithm for polynomials.
 * Throws if a is the zero polynomial.
 */
export function extFieldInverse(a: Polynomial, config: ExtFieldConfig): Polynomial {
  const normalized = polyNormalize(a);

  if (polyIsZero(normalized)) {
    throw new Error('The zero element has no multiplicative inverse.');
  }

  const inverse = polyExtGcd(normalized, config.irreducible, config.p);

  // Reduce the result modulo the irreducible to ensure degree < n
  return polyDivMod(inverse, config.irreducible, config.p).remainder;
}

/**
 * Computes (a / b) in GF(p^n), defined as a × b⁻¹.
 * Throws if b is the zero polynomial.
 */
export function extFieldDiv(a: Polynomial, b: Polynomial, config: ExtFieldConfig): Polynomial {
  const normalizedB = polyNormalize(b);

  if (polyIsZero(normalizedB)) {
    throw new Error('Division by zero is undefined in any field.');
  }

  const bInv = extFieldInverse(normalizedB, config);
  return extFieldMul(a, bInv, config);
}

/**
 * Computes a^k in GF(p^n) using binary exponentiation.
 * Supports negative exponents: a^(-k) = inverse(a)^k.
 * Returns [1n] (the constant 1 polynomial) for k = 0.
 * Throws if a is zero and k < 0.
 */
export function extFieldPow(a: Polynomial, k: bigint, config: ExtFieldConfig): Polynomial {
  const normalized = polyNormalize(a);

  if (k === 0n) {
    return [1n];
  }

  if (k < 0n) {
    if (polyIsZero(normalized)) {
      throw new Error('Exponentiation of zero to a negative power is undefined.');
    }
    const inv = extFieldInverse(normalized, config);
    return extFieldPow(inv, -k, config);
  }

  // Binary exponentiation
  let result: Polynomial = [1n]; // multiplicative identity
  let base = normalized;
  let exp = k;

  while (exp > 0n) {
    if (exp & 1n) {
      result = extFieldMul(result, base, config);
    }
    base = extFieldMul(base, base, config);
    exp >>= 1n;
  }

  return result;
}
