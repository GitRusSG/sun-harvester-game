import { describe, it, expect } from 'vitest';
import {
  modAdd,
  modSub,
  modMul,
  modPow,
  modInverse,
  isPrime,
} from '../../../src/core/mod-arithmetic';

describe('modAdd', () => {
  it('computes (3 + 5) mod 7 = 1', () => {
    expect(modAdd(3n, 5n, 7n)).toBe(1n);
  });

  it('computes (0 + 0) mod 5 = 0', () => {
    expect(modAdd(0n, 0n, 5n)).toBe(0n);
  });

  it('computes (6 + 6) mod 7 = 5', () => {
    expect(modAdd(6n, 6n, 7n)).toBe(5n);
  });

  it('handles additive identity: (a + 0) mod p = a', () => {
    expect(modAdd(4n, 0n, 7n)).toBe(4n);
  });
});

describe('modSub', () => {
  it('computes (3 - 5) mod 7 = 5', () => {
    expect(modSub(3n, 5n, 7n)).toBe(5n);
  });

  it('computes (0 - 3) mod 7 = 4', () => {
    expect(modSub(0n, 3n, 7n)).toBe(4n);
  });

  it('computes (5 - 5) mod 7 = 0', () => {
    expect(modSub(5n, 5n, 7n)).toBe(0n);
  });

  it('computes (0 - 0) mod 5 = 0', () => {
    expect(modSub(0n, 0n, 5n)).toBe(0n);
  });
});

describe('modMul', () => {
  it('computes (3 * 5) mod 7 = 1', () => {
    expect(modMul(3n, 5n, 7n)).toBe(1n);
  });

  it('computes (0 * 5) mod 7 = 0', () => {
    expect(modMul(0n, 5n, 7n)).toBe(0n);
  });

  it('computes (6 * 6) mod 7 = 1', () => {
    expect(modMul(6n, 6n, 7n)).toBe(1n);
  });

  it('handles multiplicative identity: (a * 1) mod p = a', () => {
    expect(modMul(4n, 1n, 7n)).toBe(4n);
  });
});

describe('modPow', () => {
  it('computes 2^10 mod 1000 = 24', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n);
  });

  it('returns 1 for exponent 0', () => {
    expect(modPow(3n, 0n, 7n)).toBe(1n);
  });

  it('returns 0 for 0^0 mod p (convention: 1)', () => {
    expect(modPow(0n, 0n, 7n)).toBe(1n);
  });

  it('returns base mod p for exponent 1', () => {
    expect(modPow(5n, 1n, 7n)).toBe(5n);
  });

  it('handles negative exponent: 2^(-1) mod 7 = 4', () => {
    // inverse of 2 mod 7 is 4 since 2*4=8≡1 mod 7
    expect(modPow(2n, -1n, 7n)).toBe(4n);
  });

  it('handles large exponents', () => {
    // Fermat's little theorem: a^(p-1) ≡ 1 mod p for prime p, a ≠ 0
    expect(modPow(3n, 6n, 7n)).toBe(1n);
  });

  it('returns 0 when p = 1', () => {
    expect(modPow(5n, 3n, 1n)).toBe(0n);
  });
});

describe('modInverse', () => {
  it('computes inverse of 3 mod 7 = 5 (since 3*5=15≡1 mod 7)', () => {
    expect(modInverse(3n, 7n)).toBe(5n);
  });

  it('verifies a × a⁻¹ ≡ 1 (mod p) for a=2, p=7', () => {
    const inv = modInverse(2n, 7n);
    expect(modMul(2n, inv, 7n)).toBe(1n);
  });

  it('verifies a × a⁻¹ ≡ 1 (mod p) for a=5, p=11', () => {
    const inv = modInverse(5n, 11n);
    expect(modMul(5n, inv, 11n)).toBe(1n);
  });

  it('computes inverse of 1 mod p = 1', () => {
    expect(modInverse(1n, 7n)).toBe(1n);
  });

  it('throws for inverse of 0', () => {
    expect(() => modInverse(0n, 7n)).toThrow();
  });

  it('throws descriptive error for inverse of 0', () => {
    expect(() => modInverse(0n, 7n)).toThrow(
      'The zero element has no multiplicative inverse.'
    );
  });
});

describe('isPrime', () => {
  it('returns true for 2', () => {
    expect(isPrime(2n)).toBe(true);
  });

  it('returns true for 3', () => {
    expect(isPrime(3n)).toBe(true);
  });

  it('returns true for 7', () => {
    expect(isPrime(7n)).toBe(true);
  });

  it('returns true for large prime 104729', () => {
    expect(isPrime(104729n)).toBe(true);
  });

  it('returns false for 0', () => {
    expect(isPrime(0n)).toBe(false);
  });

  it('returns false for 1', () => {
    expect(isPrime(1n)).toBe(false);
  });

  it('returns false for 4', () => {
    expect(isPrime(4n)).toBe(false);
  });

  it('returns false for 561 (Carmichael number)', () => {
    expect(isPrime(561n)).toBe(false);
  });

  it('returns false for 1105 (Carmichael number)', () => {
    expect(isPrime(1105n)).toBe(false);
  });

  it('returns false for even numbers > 2', () => {
    expect(isPrime(100n)).toBe(false);
  });
});
