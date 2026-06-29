import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isPrime } from '../../src/core/mod-arithmetic';

/**
 * Property 11: Non-Prime Rejection
 *
 * For any composite integer n > 1, isPrime(n) SHALL return false.
 * For known primes, isPrime SHALL return true.
 *
 * Validates: Requirements 1.3
 */
describe('Feature: finite-field-calculator, Property 11: Non-Prime Rejection', () => {
  /**
   * Composite number generator: produces products of two factors, each >= 2.
   * This guarantees the result is composite (has factors other than 1 and itself).
   */
  const compositeArb = fc
    .tuple(
      fc.bigInt({ min: 2n, max: 1000n }),
      fc.bigInt({ min: 2n, max: 1000n })
    )
    .map(([a, b]) => a * b);

  it('should return false for all composite numbers', () => {
    /**
     * **Validates: Requirements 1.3**
     */
    fc.assert(
      fc.property(compositeArb, (n) => {
        expect(isPrime(n)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should return true for known small primes', () => {
    const knownPrimes = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n];
    for (const p of knownPrimes) {
      expect(isPrime(p)).toBe(true);
    }
  });
});
