/**
 * Irreducible polynomial module for GF(p).
 *
 * Provides functions to check irreducibility and find irreducible polynomials
 * of a given degree over a prime field.
 */

import { Polynomial } from '../types';
import { polyDivMod, polyDegree, polyNormalize, polyIsZero, polyMul } from './polynomial';
import { modMul, modInverse } from '../core/mod-arithmetic';

/**
 * Generates all monic polynomials of a given degree over GF(p).
 *
 * A monic polynomial of degree d has leading coefficient 1 and d free
 * coefficients each ranging from 0 to p-1.
 *
 * Yields polynomials in ascending degree order (coefficients[i] = coeff of x^i).
 */
function* monicPolynomials(degree: number, p: bigint): Generator<Polynomial> {
  // A monic polynomial of degree d: [c0, c1, ..., c_{d-1}, 1n]
  // We iterate all combinations of the lower d coefficients in [0, p-1].
  const numFreeCoeffs = degree; // coefficients at positions 0..degree-1
  const total = p ** BigInt(numFreeCoeffs);

  for (let i = 0n; i < total; i++) {
    const poly: Polynomial = new Array(degree + 1);
    let val = i;
    for (let k = 0; k < numFreeCoeffs; k++) {
      poly[k] = val % p;
      val = val / p;
    }
    poly[degree] = 1n; // monic
    yield poly;
  }
}

/**
 * Checks whether a polynomial is irreducible over GF(p) using trial division.
 *
 * A polynomial f of degree n is irreducible over GF(p) if no monic polynomial
 * of degree 1 ≤ d ≤ floor(n/2) divides it evenly.
 *
 * @param poly - The polynomial to test (must have degree ≥ 1).
 * @param p - The prime characteristic of the field.
 * @returns true if the polynomial is irreducible over GF(p), false otherwise.
 */
export function isIrreducible(poly: Polynomial, p: bigint): boolean {
  const normalized = polyNormalize(poly);
  const deg = polyDegree(normalized);

  // Degree 0 or less: constants and zero are not irreducible
  if (deg < 1) {
    return false;
  }

  // Degree 1 polynomials are always irreducible
  if (deg === 1) {
    return true;
  }

  // Make the polynomial monic for consistent division testing
  const leadCoeff = normalized[deg];
  let monicPoly: Polynomial;
  if (leadCoeff !== 1n) {
    const inv = modInverse(leadCoeff, p);
    monicPoly = normalized.map((c) => {
      const result = modMul(c, inv, p);
      return result;
    });
  } else {
    monicPoly = normalized;
  }

  // Trial division: check all monic polynomials of degree d for d = 1 to floor(deg/2)
  const halfDeg = Math.floor(deg / 2);

  for (let d = 1; d <= halfDeg; d++) {
    for (const divisor of monicPolynomials(d, p)) {
      const { remainder } = polyDivMod(monicPoly, divisor, p);
      if (polyIsZero(remainder)) {
        return false; // Found a non-trivial factor
      }
    }
  }

  return true;
}

/**
 * Finds an irreducible polynomial of the given degree over GF(p).
 *
 * Systematically generates monic polynomials of the specified degree and tests
 * each for irreducibility, returning the first one found.
 *
 * @param degree - The desired degree of the irreducible polynomial (must be ≥ 1).
 * @param p - The prime characteristic of the field.
 * @returns A monic irreducible polynomial of the specified degree over GF(p).
 * @throws Error if degree < 1.
 */
export function findIrreducible(degree: number, p: bigint): Polynomial {
  if (degree < 1) {
    throw new Error('Degree must be at least 1 for an irreducible polynomial.');
  }

  // Degree 1: x + 0 = [0n, 1n] is always irreducible
  if (degree === 1) {
    return [0n, 1n];
  }

  // Enumerate monic polynomials and return the first irreducible one
  for (const candidate of monicPolynomials(degree, p)) {
    if (isIrreducible(candidate, p)) {
      return candidate;
    }
  }

  // This should never happen: irreducible polynomials exist for all degrees over GF(p)
  throw new Error(`No irreducible polynomial of degree ${degree} found over GF(${p}).`);
}
