/**
 * Polynomial arithmetic module for operations over GF(p).
 *
 * Polynomials are represented as bigint arrays in ascending degree order:
 *   coefficients[i] = coefficient of x^i
 * The zero polynomial is represented as an empty array [].
 */

import { Polynomial } from '../types';
import { modAdd, modSub, modMul, modInverse } from '../core/mod-arithmetic';

/**
 * Removes trailing zero coefficients from a polynomial.
 * The zero polynomial is represented as [].
 */
export function polyNormalize(a: Polynomial): Polynomial {
  let i = a.length - 1;
  while (i >= 0 && a[i] === 0n) {
    i--;
  }
  return a.slice(0, i + 1);
}

/**
 * Returns true if the polynomial is the zero polynomial (empty array or all zeros).
 */
export function polyIsZero(a: Polynomial): boolean {
  return polyNormalize(a).length === 0;
}

/**
 * Returns true if two polynomials are equal (after normalization).
 */
export function polyEqual(a: Polynomial, b: Polynomial): boolean {
  const na = polyNormalize(a);
  const nb = polyNormalize(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (na[i] !== nb[i]) return false;
  }
  return true;
}

/**
 * Returns the degree of a polynomial.
 * Returns -1 for the zero polynomial (empty array).
 */
export function polyDegree(a: Polynomial): number {
  const na = polyNormalize(a);
  return na.length - 1;
}

/**
 * Adds two polynomials coefficient-wise modulo p.
 */
export function polyAdd(a: Polynomial, b: Polynomial, p: bigint): Polynomial {
  const maxLen = Math.max(a.length, b.length);
  const result: Polynomial = [];
  for (let i = 0; i < maxLen; i++) {
    const ai = i < a.length ? a[i] : 0n;
    const bi = i < b.length ? b[i] : 0n;
    result.push(modAdd(ai, bi, p));
  }
  return polyNormalize(result);
}

/**
 * Subtracts polynomial b from polynomial a coefficient-wise modulo p.
 */
export function polySub(a: Polynomial, b: Polynomial, p: bigint): Polynomial {
  const maxLen = Math.max(a.length, b.length);
  const result: Polynomial = [];
  for (let i = 0; i < maxLen; i++) {
    const ai = i < a.length ? a[i] : 0n;
    const bi = i < b.length ? b[i] : 0n;
    result.push(modSub(ai, bi, p));
  }
  return polyNormalize(result);
}

/**
 * Multiplies two polynomials using convolution with coefficients reduced modulo p.
 * result[k] = sum(a[i] * b[k-i]) mod p for all valid i.
 */
export function polyMul(a: Polynomial, b: Polynomial, p: bigint): Polynomial {
  if (polyIsZero(a) || polyIsZero(b)) return [];

  const na = polyNormalize(a);
  const nb = polyNormalize(b);
  const resultLen = na.length + nb.length - 1;
  const result: Polynomial = new Array(resultLen).fill(0n);

  for (let i = 0; i < na.length; i++) {
    for (let j = 0; j < nb.length; j++) {
      const product = modMul(na[i], nb[j], p);
      result[i + j] = modAdd(result[i + j], product, p);
    }
  }

  return polyNormalize(result);
}

/**
 * Performs polynomial long division over GF(p).
 * Returns { quotient, remainder } such that a = b * quotient + remainder
 * and degree(remainder) < degree(b).
 *
 * Throws if the divisor b is the zero polynomial.
 */
export function polyDivMod(
  a: Polynomial,
  b: Polynomial,
  p: bigint
): { quotient: Polynomial; remainder: Polynomial } {
  const nb = polyNormalize(b);

  if (nb.length === 0) {
    throw new Error('Division by zero is undefined in any field.');
  }

  let remainder = polyNormalize(a).slice();
  const divisorDeg = nb.length - 1;
  const leadInv = modInverse(nb[divisorDeg], p);

  const quotientLen = remainder.length - nb.length + 1;
  if (quotientLen <= 0) {
    return { quotient: [], remainder: polyNormalize(remainder) };
  }

  const quotient: Polynomial = new Array(quotientLen).fill(0n);

  for (let i = quotientLen - 1; i >= 0; i--) {
    const remDeg = i + divisorDeg;
    if (remDeg >= remainder.length) continue;

    const coeff = modMul(remainder[remDeg], leadInv, p);
    quotient[i] = coeff;

    // Subtract coeff * b * x^i from remainder
    for (let j = 0; j <= divisorDeg; j++) {
      const subtracted = modMul(coeff, nb[j], p);
      remainder[i + j] = modSub(remainder[i + j], subtracted, p);
    }
  }

  return { quotient: polyNormalize(quotient), remainder: polyNormalize(remainder) };
}

/**
 * Reduces polynomial a modulo another polynomial (modulus) over GF(p).
 * Returns the remainder of a divided by modulus.
 */
export function polyReduce(a: Polynomial, modulus: Polynomial, p: bigint): Polynomial {
  return polyDivMod(a, modulus, p).remainder;
}
