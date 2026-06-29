import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extFieldAdd,
  extFieldSub,
  extFieldMul,
  extFieldInverse,
  extFieldDiv,
  extFieldPow,
} from '../../src/fields/extension-field';
import { polyEqual, polyIsZero } from '../../src/poly/polynomial';
import { Polynomial, ExtFieldConfig } from '../../src/types';

/**
 * Generators for extension field property tests.
 */

/** Known-good extension field configurations with verified irreducible polynomials. */
const extFieldConfigs: ExtFieldConfig[] = [
  // GF(2^2) with irreducible x^2 + x + 1
  { p: 2n, n: 2, irreducible: [1n, 1n, 1n] },
  // GF(2^3) with irreducible x^3 + x + 1
  { p: 2n, n: 3, irreducible: [1n, 1n, 0n, 1n] },
  // GF(3^2) with irreducible x^2 + 1
  { p: 3n, n: 2, irreducible: [1n, 0n, 1n] },
  // GF(5^2) with irreducible x^2 + 2 (irreducible over GF(5))
  { p: 5n, n: 2, irreducible: [2n, 0n, 1n] },
  // GF(7^2) with irreducible x^2 + 1 (irreducible over GF(7) since -1 is not a QR mod 7)
  { p: 7n, n: 2, irreducible: [1n, 0n, 1n] },
];

/** Generator for extension field configs. */
const configArb: fc.Arbitrary<ExtFieldConfig> = fc.constantFrom(...extFieldConfigs);

/**
 * Generates a random extension field element (polynomial of degree < n with coefficients in [0, p-1]).
 */
function elementArb(config: ExtFieldConfig): fc.Arbitrary<Polynomial> {
  return fc
    .array(fc.bigInt({ min: 0n, max: config.p - 1n }), {
      minLength: 0,
      maxLength: config.n,
    })
    .map((coeffs) => {
      // Pad to length n if shorter, trim trailing zeros for normalization
      const padded = [...coeffs];
      while (padded.length < config.n) {
        padded.push(0n);
      }
      // Trim trailing zeros (normalize)
      let i = padded.length - 1;
      while (i >= 0 && padded[i] === 0n) {
        i--;
      }
      return padded.slice(0, i + 1);
    });
}

/**
 * Generates a non-zero extension field element (at least one coefficient is non-zero).
 */
function nonZeroElementArb(config: ExtFieldConfig): fc.Arbitrary<Polynomial> {
  return elementArb(config).filter((poly) => !polyIsZero(poly));
}

/**
 * Property 2: Addition Commutativity (Extension Field)
 *
 * For any two field elements a and b in GF(p^n), a + b SHALL equal b + a.
 *
 * Validates: Requirements 3.2
 */
describe('Feature: finite-field-calculator, Property 2: Addition Commutativity (Extension Field)', () => {
  it('extFieldAdd(a, b) should equal extFieldAdd(b, a)', () => {
    /**
     * **Validates: Requirements 3.2**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(fc.constant(config), elementArb(config), elementArb(config))
        ),
        ([config, a, b]) => {
          const ab = extFieldAdd(a, b, config);
          const ba = extFieldAdd(b, a, config);
          expect(polyEqual(ab, ba)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Additive Inverse (Extension Field)
 *
 * For any field element a in GF(p^n), a - a SHALL equal the zero element,
 * and a + (0 - a) SHALL equal the zero element.
 *
 * Validates: Requirements 3.4
 */
describe('Feature: finite-field-calculator, Property 3: Additive Inverse (Extension Field)', () => {
  it('extFieldSub(a, a) should equal zero and extFieldAdd(a, 0 - a) should equal zero', () => {
    /**
     * **Validates: Requirements 3.4**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(fc.constant(config), elementArb(config))
        ),
        ([config, a]) => {
          // a - a === 0
          const selfSub = extFieldSub(a, a, config);
          expect(polyIsZero(selfSub)).toBe(true);

          // a + (0 - a) === 0
          const negA = extFieldSub([], a, config);
          const addNeg = extFieldAdd(a, negA, config);
          expect(polyIsZero(addNeg)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Multiplication Commutativity (Extension Field)
 *
 * For any two field elements a and b in GF(p^n), a × b SHALL equal b × a.
 *
 * Validates: Requirements 4.2
 */
describe('Feature: finite-field-calculator, Property 4: Multiplication Commutativity (Extension Field)', () => {
  it('extFieldMul(a, b) should equal extFieldMul(b, a)', () => {
    /**
     * **Validates: Requirements 4.2**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(fc.constant(config), elementArb(config), elementArb(config))
        ),
        ([config, a, b]) => {
          const ab = extFieldMul(a, b, config);
          const ba = extFieldMul(b, a, config);
          expect(polyEqual(ab, ba)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Multiplicative Inverse (Extension Field)
 *
 * For any non-zero field element a in GF(p^n), a × inverse(a) SHALL equal
 * the multiplicative identity (1).
 *
 * Validates: Requirements 5.1
 */
describe('Feature: finite-field-calculator, Property 5: Multiplicative Inverse (Extension Field)', () => {
  it('extFieldMul(a, extFieldInverse(a)) should equal [1n] for non-zero a', () => {
    /**
     * **Validates: Requirements 5.1**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(fc.constant(config), nonZeroElementArb(config))
        ),
        ([config, a]) => {
          const inv = extFieldInverse(a, config);
          const product = extFieldMul(a, inv, config);
          expect(polyEqual(product, [1n])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 6: Division as Multiplication by Inverse (Extension Field)
 *
 * For any field element a and non-zero field element b in GF(p^n),
 * a / b SHALL equal a × inverse(b).
 *
 * Validates: Requirements 5.2
 */
describe('Feature: finite-field-calculator, Property 6: Division as Multiplication by Inverse (Extension Field)', () => {
  it('extFieldDiv(a, b) should equal extFieldMul(a, extFieldInverse(b))', () => {
    /**
     * **Validates: Requirements 5.2**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(fc.constant(config), elementArb(config), nonZeroElementArb(config))
        ),
        ([config, a, b]) => {
          const divResult = extFieldDiv(a, b, config);
          const invB = extFieldInverse(b, config);
          const mulResult = extFieldMul(a, invB, config);
          expect(polyEqual(divResult, mulResult)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Exponentiation Homomorphism (Extension Field)
 *
 * For any non-zero field element a in GF(p^n) and non-negative integers m, n,
 * a^(m+n) SHALL equal a^m × a^n.
 *
 * Validates: Requirements 6.1, 6.2
 */
describe('Feature: finite-field-calculator, Property 7: Exponentiation Homomorphism (Extension Field)', () => {
  it('extFieldPow(a, m+n) should equal extFieldMul(extFieldPow(a, m), extFieldPow(a, n))', () => {
    /**
     * **Validates: Requirements 6.1, 6.2**
     */
    fc.assert(
      fc.property(
        configArb.chain((config) =>
          fc.tuple(
            fc.constant(config),
            nonZeroElementArb(config),
            fc.integer({ min: 0, max: 10 }),
            fc.integer({ min: 0, max: 10 })
          )
        ),
        ([config, a, m, n]) => {
          const mBig = BigInt(m);
          const nBig = BigInt(n);

          const powSum = extFieldPow(a, mBig + nBig, config);
          const powM = extFieldPow(a, mBig, config);
          const powN = extFieldPow(a, nBig, config);
          const product = extFieldMul(powM, powN, config);

          expect(polyEqual(powSum, product)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
