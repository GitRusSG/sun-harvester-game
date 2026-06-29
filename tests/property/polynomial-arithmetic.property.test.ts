import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  polyAdd,
  polyMul,
  polyDivMod,
  polyEqual,
  polyDegree,
  polyIsZero,
} from '../../src/poly/polynomial';

/**
 * Generators for polynomial arithmetic property tests.
 */

/** Generator for small primes suitable for GF(p) testing. */
const primeArb = fc.constantFrom(2n, 3n, 5n, 7n, 11n, 13n);

/**
 * Polynomial generator: given a prime p and max degree, generates a polynomial
 * with coefficients in [0, p-1]. The array length is between 0 and maxDegree+1.
 */
function polynomialArb(p: bigint, maxDegree: number): fc.Arbitrary<bigint[]> {
  return fc
    .array(fc.bigInt({ min: 0n, max: p - 1n }), { minLength: 0, maxLength: maxDegree + 1 })
    .map((coeffs) => coeffs.slice());
}

/**
 * Non-zero polynomial generator: ensures at least one coefficient is non-zero.
 */
function nonZeroPolynomialArb(p: bigint, maxDegree: number): fc.Arbitrary<bigint[]> {
  return fc
    .tuple(
      fc.array(fc.bigInt({ min: 0n, max: p - 1n }), { minLength: 0, maxLength: maxDegree }),
      fc.bigInt({ min: 1n, max: p - 1n })
    )
    .chain(([prefix, nonZeroCoeff]) => {
      return fc
        .array(fc.bigInt({ min: 0n, max: p - 1n }), { minLength: 0, maxLength: maxDegree - prefix.length })
        .map((suffix) => {
          // Insert the non-zero coefficient at a random position
          const poly = [...prefix, nonZeroCoeff, ...suffix].slice(0, maxDegree + 1);
          return poly;
        });
    });
}

/**
 * Property 9: Polynomial Addition Commutativity
 *
 * For any two polynomials a and b over GF(p), polyAdd(a, b) SHALL equal polyAdd(b, a),
 * and all coefficients in the result SHALL be in the range [0, p-1].
 *
 * Validates: Requirements 7.1
 */
describe('Feature: finite-field-calculator, Property 9: Polynomial Addition Commutativity', () => {
  it('polyAdd(a, b) should equal polyAdd(b, a) with all coefficients in [0, p-1]', () => {
    /**
     * **Validates: Requirements 7.1**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(
            fc.constant(p),
            polynomialArb(p, 5),
            polynomialArb(p, 5)
          )
        ),
        ([p, a, b]) => {
          const ab = polyAdd(a, b, p);
          const ba = polyAdd(b, a, p);

          // Commutativity: polyAdd(a, b) === polyAdd(b, a)
          expect(polyEqual(ab, ba)).toBe(true);

          // All coefficients in range [0, p-1]
          for (const coeff of ab) {
            expect(coeff >= 0n).toBe(true);
            expect(coeff < p).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 10: Polynomial Multiplication Coefficients in Range
 *
 * For any two polynomials a and b over GF(p), all coefficients of polyMul(a, b)
 * SHALL be in the range [0, p-1].
 *
 * Validates: Requirements 7.2
 */
describe('Feature: finite-field-calculator, Property 10: Polynomial Multiplication Coefficients in Range', () => {
  it('all coefficients of polyMul(a, b) should be in [0, p-1]', () => {
    /**
     * **Validates: Requirements 7.2**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(
            fc.constant(p),
            polynomialArb(p, 5),
            polynomialArb(p, 5)
          )
        ),
        ([p, a, b]) => {
          const result = polyMul(a, b, p);

          // All coefficients in range [0, p-1]
          for (const coeff of result) {
            expect(coeff >= 0n).toBe(true);
            expect(coeff < p).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 8: Polynomial Division Invariant
 *
 * For any polynomial a and non-zero polynomial b over GF(p), if (q, r) = polyDivMod(a, b),
 * then a SHALL equal b × q + r, and the degree of r SHALL be less than the degree of b.
 *
 * Validates: Requirements 7.3
 */
describe('Feature: finite-field-calculator, Property 8: Polynomial Division Invariant', () => {
  it('a === b * q + r and deg(r) < deg(b) for polyDivMod(a, b)', () => {
    /**
     * **Validates: Requirements 7.3**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(
            fc.constant(p),
            polynomialArb(p, 6),
            nonZeroPolynomialArb(p, 4)
          )
        ),
        ([p, a, b]) => {
          const { quotient, remainder } = polyDivMod(a, b, p);

          // Reconstruct: b * q + r should equal a
          const bTimesQ = polyMul(b, quotient, p);
          const reconstructed = polyAdd(bTimesQ, remainder, p);
          expect(polyEqual(reconstructed, a)).toBe(true);

          // Degree invariant: deg(r) < deg(b)
          if (!polyIsZero(remainder)) {
            expect(polyDegree(remainder)).toBeLessThan(polyDegree(b));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
