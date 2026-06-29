import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isIrreducible, findIrreducible } from '../../src/poly/irreducible';
import { polyMul, polyDegree } from '../../src/poly/polynomial';

/**
 * Generators for irreducible polynomial property tests.
 */

/** Small primes for testing (keep computation fast with trial division). */
const smallPrimeArb = fc.constantFrom(2n, 3n, 5n, 7n);

/** Degrees suitable for findIrreducible (keep small since trial division is expensive). */
const degreeArb = fc.constantFrom(2, 3, 4);

/**
 * Non-constant polynomial generator: generates a polynomial of degree >= 1
 * with coefficients in [0, p-1] and a non-zero leading coefficient.
 */
function nonConstantPolyArb(p: bigint, maxDegree: number): fc.Arbitrary<bigint[]> {
  return fc
    .integer({ min: 1, max: maxDegree })
    .chain((degree) =>
      fc.tuple(
        fc.array(fc.bigInt({ min: 0n, max: p - 1n }), {
          minLength: degree,
          maxLength: degree,
        }),
        fc.bigInt({ min: 1n, max: p - 1n })
      )
    )
    .map(([lowerCoeffs, leadingCoeff]) => [...lowerCoeffs, leadingCoeff]);
}

/**
 * Property 12: Irreducible Polynomial Generation
 *
 * For any prime p and degree n >= 2, findIrreducible(n, p) SHALL return a polynomial
 * of degree exactly n that passes the isIrreducible check.
 *
 * Validates: Requirements 11.1
 */
describe('Feature: finite-field-calculator, Property 12: Irreducible Polynomial Generation', () => {
  it('findIrreducible(n, p) returns a polynomial of degree n that is irreducible', () => {
    /**
     * **Validates: Requirements 11.1**
     */
    fc.assert(
      fc.property(
        fc.tuple(smallPrimeArb, degreeArb),
        ([p, n]) => {
          const result = findIrreducible(n, p);

          // Verify degree is exactly n
          expect(polyDegree(result)).toBe(n);

          // Verify it passes the irreducibility check
          expect(isIrreducible(result, p)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 13: Irreducibility Check Correctness (Reducible Polynomials)
 *
 * For any two non-constant polynomials f and g over GF(p),
 * isIrreducible(f * g, p) SHALL return false.
 *
 * Validates: Requirements 1.4, 11.2
 */
describe('Feature: finite-field-calculator, Property 13: Irreducibility Check Correctness', () => {
  it('isIrreducible(f * g, p) returns false for non-constant f and g', () => {
    /**
     * **Validates: Requirements 1.4, 11.2**
     */
    fc.assert(
      fc.property(
        smallPrimeArb.chain((p) =>
          fc.tuple(
            fc.constant(p),
            nonConstantPolyArb(p, 3),
            nonConstantPolyArb(p, 3)
          )
        ),
        ([p, f, g]) => {
          const product = polyMul(f, g, p);

          // The product of two non-constant polynomials is always reducible
          expect(isIrreducible(product, p)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
