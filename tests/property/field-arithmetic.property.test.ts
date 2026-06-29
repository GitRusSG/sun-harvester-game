import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  primeFieldAdd,
  primeFieldSub,
  primeFieldMul,
  primeFieldInverse,
  primeFieldDiv,
  primeFieldPow,
} from '../../src/fields/prime-field';
import { PrimeFieldConfig } from '../../src/types';

/**
 * Generators for prime field property tests.
 */

/** Generator for small primes suitable for GF(p) testing. */
const primeArb = fc.constantFrom(2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n);

/** Element generator: given p, generates a bigint in [0, p-1]. */
function elementArb(p: bigint): fc.Arbitrary<bigint> {
  return fc.bigInt({ min: 0n, max: p - 1n });
}

/** Non-zero element generator: given p, generates a bigint in [1, p-1]. */
function nonZeroElementArb(p: bigint): fc.Arbitrary<bigint> {
  return fc.bigInt({ min: 1n, max: p - 1n });
}

/**
 * Property 2: Addition Commutativity
 *
 * For any two field elements a and b in GF(p), a + b SHALL equal b + a.
 *
 * Validates: Requirements 3.1
 */
describe('Feature: finite-field-calculator, Property 2: Addition Commutativity', () => {
  it('primeFieldAdd(a, b) should equal primeFieldAdd(b, a)', () => {
    /**
     * **Validates: Requirements 3.1**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(fc.constant(p), elementArb(p), elementArb(p))
        ),
        ([p, a, b]) => {
          const config: PrimeFieldConfig = { p };
          const ab = primeFieldAdd(a, b, config);
          const ba = primeFieldAdd(b, a, config);
          expect(ab).toBe(ba);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Additive Inverse (Subtraction)
 *
 * For any field element a in GF(p), a - a SHALL equal the zero element,
 * and a + (0 - a) SHALL equal the zero element.
 *
 * Validates: Requirements 3.3
 */
describe('Feature: finite-field-calculator, Property 3: Additive Inverse', () => {
  it('primeFieldSub(a, a) should equal 0 and primeFieldAdd(a, 0 - a) should equal 0', () => {
    /**
     * **Validates: Requirements 3.3**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(fc.constant(p), elementArb(p))
        ),
        ([p, a]) => {
          const config: PrimeFieldConfig = { p };

          // a - a === 0
          const selfSub = primeFieldSub(a, a, config);
          expect(selfSub).toBe(0n);

          // a + (0 - a) === 0
          const negA = primeFieldSub(0n, a, config);
          const addNeg = primeFieldAdd(a, negA, config);
          expect(addNeg).toBe(0n);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Multiplication Commutativity
 *
 * For any two field elements a and b in GF(p), a × b SHALL equal b × a.
 *
 * Validates: Requirements 4.1
 */
describe('Feature: finite-field-calculator, Property 4: Multiplication Commutativity', () => {
  it('primeFieldMul(a, b) should equal primeFieldMul(b, a)', () => {
    /**
     * **Validates: Requirements 4.1**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(fc.constant(p), elementArb(p), elementArb(p))
        ),
        ([p, a, b]) => {
          const config: PrimeFieldConfig = { p };
          const ab = primeFieldMul(a, b, config);
          const ba = primeFieldMul(b, a, config);
          expect(ab).toBe(ba);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Multiplicative Inverse
 *
 * For any non-zero field element a in GF(p), a × inverse(a) SHALL equal 1.
 *
 * Validates: Requirements 5.1
 */
describe('Feature: finite-field-calculator, Property 5: Multiplicative Inverse', () => {
  it('primeFieldMul(a, primeFieldInverse(a)) should equal 1 for non-zero a', () => {
    /**
     * **Validates: Requirements 5.1**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(fc.constant(p), nonZeroElementArb(p))
        ),
        ([p, a]) => {
          const config: PrimeFieldConfig = { p };
          const inv = primeFieldInverse(a, config);
          const product = primeFieldMul(a, inv, config);
          expect(product).toBe(1n);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 6: Division as Multiplication by Inverse
 *
 * For any field element a and non-zero field element b in GF(p),
 * a / b SHALL equal a × inverse(b).
 *
 * Validates: Requirements 5.2
 */
describe('Feature: finite-field-calculator, Property 6: Division as Multiplication by Inverse', () => {
  it('primeFieldDiv(a, b) should equal primeFieldMul(a, primeFieldInverse(b))', () => {
    /**
     * **Validates: Requirements 5.2**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(fc.constant(p), elementArb(p), nonZeroElementArb(p))
        ),
        ([p, a, b]) => {
          const config: PrimeFieldConfig = { p };
          const divResult = primeFieldDiv(a, b, config);
          const invB = primeFieldInverse(b, config);
          const mulResult = primeFieldMul(a, invB, config);
          expect(divResult).toBe(mulResult);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Exponentiation Homomorphism
 *
 * For any non-zero field element a in GF(p) and non-negative integers m, n,
 * a^(m+n) SHALL equal a^m × a^n.
 *
 * Validates: Requirements 6.1, 6.2
 */
describe('Feature: finite-field-calculator, Property 7: Exponentiation Homomorphism', () => {
  it('primeFieldPow(a, m+n) should equal primeFieldMul(primeFieldPow(a, m), primeFieldPow(a, n))', () => {
    /**
     * **Validates: Requirements 6.1, 6.2**
     */
    fc.assert(
      fc.property(
        primeArb.chain((p) =>
          fc.tuple(
            fc.constant(p),
            nonZeroElementArb(p),
            fc.integer({ min: 0, max: 20 }),
            fc.integer({ min: 0, max: 20 })
          )
        ),
        ([p, a, m, n]) => {
          const config: PrimeFieldConfig = { p };
          const mBig = BigInt(m);
          const nBig = BigInt(n);

          const powSum = primeFieldPow(a, mBig + nBig, config);
          const powM = primeFieldPow(a, mBig, config);
          const powN = primeFieldPow(a, nBig, config);
          const product = primeFieldMul(powM, powN, config);

          expect(powSum).toBe(product);
        }
      ),
      { numRuns: 100 }
    );
  });
});
