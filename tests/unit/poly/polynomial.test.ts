import { describe, it, expect } from 'vitest';
import {
  polyNormalize,
  polyIsZero,
  polyEqual,
  polyDegree,
  polyAdd,
  polySub,
  polyMul,
  polyDivMod,
  polyReduce,
} from '../../../src/poly/polynomial';

describe('polyNormalize', () => {
  it('removes trailing zeros', () => {
    expect(polyNormalize([1n, 2n, 0n, 0n])).toEqual([1n, 2n]);
  });

  it('returns empty array for all-zero polynomial', () => {
    expect(polyNormalize([0n, 0n, 0n])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(polyNormalize([])).toEqual([]);
  });

  it('preserves non-zero trailing coefficient', () => {
    expect(polyNormalize([1n, 0n, 3n])).toEqual([1n, 0n, 3n]);
  });
});

describe('polyIsZero', () => {
  it('returns true for empty array', () => {
    expect(polyIsZero([])).toBe(true);
  });

  it('returns true for all-zero coefficients', () => {
    expect(polyIsZero([0n, 0n, 0n])).toBe(true);
  });

  it('returns false for non-zero polynomial', () => {
    expect(polyIsZero([1n])).toBe(false);
  });
});

describe('polyEqual', () => {
  it('considers equal polynomials equal', () => {
    expect(polyEqual([1n, 2n, 3n], [1n, 2n, 3n])).toBe(true);
  });

  it('considers equal polynomials with trailing zeros equal', () => {
    expect(polyEqual([1n, 2n, 0n], [1n, 2n])).toBe(true);
  });

  it('considers zero polynomials equal', () => {
    expect(polyEqual([], [0n, 0n])).toBe(true);
  });

  it('considers different polynomials not equal', () => {
    expect(polyEqual([1n, 2n], [1n, 3n])).toBe(false);
  });

  it('considers different-degree polynomials not equal', () => {
    expect(polyEqual([1n, 2n, 3n], [1n, 2n])).toBe(false);
  });
});

describe('polyDegree', () => {
  it('returns -1 for zero polynomial', () => {
    expect(polyDegree([])).toBe(-1);
  });

  it('returns -1 for all-zero polynomial', () => {
    expect(polyDegree([0n, 0n])).toBe(-1);
  });

  it('returns 0 for constant polynomial', () => {
    expect(polyDegree([5n])).toBe(0);
  });

  it('returns correct degree for general polynomial', () => {
    expect(polyDegree([1n, 0n, 3n])).toBe(2);
  });
});

describe('polyAdd', () => {
  it('adds two polynomials coefficient-wise mod p', () => {
    // (1 + 2x) + (3 + x) = 4 + 3x in GF(5)
    expect(polyAdd([1n, 2n], [3n, 1n], 5n)).toEqual([4n, 3n]);
  });

  it('handles different lengths', () => {
    // (1 + 2x + 3x^2) + (4 + x) = 5 + 3x + 3x^2 → 0 + 3x + 3x^2 in GF(5)
    expect(polyAdd([1n, 2n, 3n], [4n, 1n], 5n)).toEqual([0n, 3n, 3n]);
  });

  it('normalizes result when leading terms cancel', () => {
    // (1 + 2x + 3x^2) + (0 + 0x + 2x^2) = 1 + 2x + 0x^2 → [1, 2] in GF(5)
    expect(polyAdd([1n, 2n, 3n], [0n, 0n, 2n], 5n)).toEqual([1n, 2n]);
  });

  it('returns zero polynomial when adding inverses', () => {
    // (1 + 2x) + (4 + 3x) = 0 + 0x → [] in GF(5)
    expect(polyAdd([1n, 2n], [4n, 3n], 5n)).toEqual([]);
  });

  it('adding zero polynomial returns original', () => {
    expect(polyAdd([1n, 2n, 3n], [], 5n)).toEqual([1n, 2n, 3n]);
  });
});

describe('polySub', () => {
  it('subtracts two polynomials coefficient-wise mod p', () => {
    // (4 + 3x) - (1 + 2x) = 3 + x in GF(5)
    expect(polySub([4n, 3n], [1n, 2n], 5n)).toEqual([3n, 1n]);
  });

  it('handles underflow correctly with modular arithmetic', () => {
    // (1 + 2x) - (3 + 4x) = -2 + -2x = 3 + 3x in GF(5)
    expect(polySub([1n, 2n], [3n, 4n], 5n)).toEqual([3n, 3n]);
  });

  it('subtracting itself yields zero', () => {
    expect(polySub([1n, 2n, 3n], [1n, 2n, 3n], 5n)).toEqual([]);
  });
});

describe('polyMul', () => {
  it('multiplies two polynomials with convolution mod p', () => {
    // (1 + x) * (1 + x) = 1 + 2x + x^2 in GF(5)
    expect(polyMul([1n, 1n], [1n, 1n], 5n)).toEqual([1n, 2n, 1n]);
  });

  it('multiplies with coefficient reduction', () => {
    // (3 + 2x) * (2 + x) = 6 + 3x + 4x + 2x^2 = 6 + 7x + 2x^2 = 1 + 2x + 2x^2 in GF(5)
    expect(polyMul([3n, 2n], [2n, 1n], 5n)).toEqual([1n, 2n, 2n]);
  });

  it('multiplication by zero polynomial returns zero', () => {
    expect(polyMul([1n, 2n, 3n], [], 5n)).toEqual([]);
  });

  it('multiplication by constant', () => {
    // (1 + 2x + 3x^2) * 2 = 2 + 4x + 6x^2 = 2 + 4x + 1x^2 in GF(5)
    expect(polyMul([1n, 2n, 3n], [2n], 5n)).toEqual([2n, 4n, 1n]);
  });

  it('multiplication in GF(2)', () => {
    // (1 + x) * (1 + x + x^2) = 1 + 2x + 2x^2 + x^3 = 1 + 0x + 0x^2 + x^3 in GF(2)
    expect(polyMul([1n, 1n], [1n, 1n, 1n], 2n)).toEqual([1n, 0n, 0n, 1n]);
  });
});

describe('polyDivMod', () => {
  it('throws for division by zero polynomial', () => {
    expect(() => polyDivMod([1n, 2n], [], 5n)).toThrow(
      'Division by zero is undefined in any field.'
    );
  });

  it('divides with no remainder', () => {
    // (1 + 2x + x^2) / (1 + x) = (1 + x) remainder 0 in GF(5)
    // since (1 + x)*(1 + x) = 1 + 2x + x^2
    const { quotient, remainder } = polyDivMod([1n, 2n, 1n], [1n, 1n], 5n);
    expect(quotient).toEqual([1n, 1n]);
    expect(remainder).toEqual([]);
  });

  it('divides with remainder', () => {
    // (1 + x + x^2) / (1 + x) in GF(5)
    // x^2 + x + 1 = (x + 0)*(x + 1) + 1
    const { quotient, remainder } = polyDivMod([1n, 1n, 1n], [1n, 1n], 5n);
    // Verify: quotient*(1+x) + remainder = original
    const product = polyMul(quotient, [1n, 1n], 5n);
    const reconstructed = polyAdd(product, remainder, 5n);
    expect(polyEqual(reconstructed, [1n, 1n, 1n])).toBe(true);
  });

  it('dividend of lower degree returns zero quotient', () => {
    // (1 + x) / (1 + x + x^2) = 0 remainder (1 + x)
    const { quotient, remainder } = polyDivMod([1n, 1n], [1n, 1n, 1n], 5n);
    expect(quotient).toEqual([]);
    expect(remainder).toEqual([1n, 1n]);
  });

  it('division in GF(2)', () => {
    // x^3 + 1 divided by x + 1 in GF(2)
    // [1, 0, 0, 1] / [1, 1]
    // x^3 + 1 = (x^2 + x + 1)(x + 1) + 0 in GF(2)
    const { quotient, remainder } = polyDivMod([1n, 0n, 0n, 1n], [1n, 1n], 2n);
    expect(remainder).toEqual([]);
    // Verify: quotient * [1,1] = [1,0,0,1]
    const product = polyMul(quotient, [1n, 1n], 2n);
    expect(polyEqual(product, [1n, 0n, 0n, 1n])).toBe(true);
  });

  it('division by a constant', () => {
    // (2 + 4x + 6x^2) / 2 in GF(7) = (1 + 2x + 3x^2)
    const { quotient, remainder } = polyDivMod([2n, 4n, 6n], [2n], 7n);
    expect(quotient).toEqual([1n, 2n, 3n]);
    expect(remainder).toEqual([]);
  });
});

describe('polyReduce', () => {
  it('reduces a polynomial modulo another', () => {
    // x^2 mod (x^2 + x + 1) in GF(2) should give x + 1
    // Since x^2 = 1*(x^2 + x + 1) + (x + 1) in GF(2)
    const result = polyReduce([0n, 0n, 1n], [1n, 1n, 1n], 2n);
    expect(result).toEqual([1n, 1n]);
  });

  it('reducing lower degree polynomial returns itself', () => {
    const result = polyReduce([1n, 1n], [1n, 1n, 1n], 2n);
    expect(result).toEqual([1n, 1n]);
  });

  it('reducing zero polynomial returns zero', () => {
    const result = polyReduce([], [1n, 1n, 1n], 2n);
    expect(result).toEqual([]);
  });
});
