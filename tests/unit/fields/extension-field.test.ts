/**
 * Unit tests for extension field GF(p^n) arithmetic.
 *
 * Tests cover:
 * - GF(2^2) with irreducible x^2 + x + 1
 * - GF(3^2) with irreducible x^2 + 1
 * - GF(2^8) with AES irreducible polynomial x^8 + x^4 + x^3 + x + 1
 * - Error cases: inverse of zero, division by zero, zero to negative power
 *
 * Requirements: 3.2, 3.4, 4.2, 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect } from 'vitest';
import {
  extFieldAdd,
  extFieldSub,
  extFieldMul,
  extFieldInverse,
  extFieldDiv,
  extFieldPow,
} from '../../../src/fields/extension-field';
import { polyEqual } from '../../../src/poly/polynomial';
import { ExtFieldConfig } from '../../../src/types';

// GF(2^2) with x^2 + x + 1
const gf4: ExtFieldConfig = { p: 2n, n: 2, irreducible: [1n, 1n, 1n] };

// GF(3^2) with x^2 + 1
const gf9: ExtFieldConfig = { p: 3n, n: 2, irreducible: [1n, 0n, 1n] };

// GF(2^8) with x^8 + x^4 + x^3 + x + 1 (AES polynomial)
const gf256: ExtFieldConfig = { p: 2n, n: 8, irreducible: [1n, 1n, 0n, 1n, 1n, 0n, 0n, 0n, 1n] };

describe('Extension Field - GF(2^2) with x^2 + x + 1', () => {
  // Elements of GF(4): 0 = [], 1 = [1], x = [0,1], x+1 = [1,1]

  it('addition: x + (x+1) = 1 (Req 3.2)', () => {
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const result = extFieldAdd(a, b, gf4);
    expect(polyEqual(result, [1n])).toBe(true); // 1
  });

  it('addition is commutative (Req 3.2)', () => {
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const ab = extFieldAdd(a, b, gf4);
    const ba = extFieldAdd(b, a, gf4);
    expect(polyEqual(ab, ba)).toBe(true);
  });

  it('subtraction: in GF(2), subtraction equals addition (Req 3.4)', () => {
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const addResult = extFieldAdd(a, b, gf4);
    const subResult = extFieldSub(a, b, gf4);
    expect(polyEqual(addResult, subResult)).toBe(true);
  });

  it('subtraction: a - a = 0 (Req 3.4)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldSub(a, a, gf4);
    expect(polyEqual(result, [])).toBe(true);
  });

  it('multiplication: x * (x+1) = 1 (Req 4.2)', () => {
    // x * (x+1) = x^2 + x. Since x^2 ≡ x+1 (mod x^2+x+1), x^2 + x = (x+1) + x = 1 in GF(2)
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const result = extFieldMul(a, b, gf4);
    expect(polyEqual(result, [1n])).toBe(true);
  });

  it('multiplication is commutative (Req 4.2)', () => {
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const ab = extFieldMul(a, b, gf4);
    const ba = extFieldMul(b, a, gf4);
    expect(polyEqual(ab, ba)).toBe(true);
  });

  it('inverse of x is (x+1) since x*(x+1)=1 (Req 5.1)', () => {
    const a = [0n, 1n]; // x
    const inv = extFieldInverse(a, gf4);
    expect(polyEqual(inv, [1n, 1n])).toBe(true); // x + 1
  });

  it('inverse of (x+1) is x (Req 5.1)', () => {
    const a = [1n, 1n]; // x + 1
    const inv = extFieldInverse(a, gf4);
    expect(polyEqual(inv, [0n, 1n])).toBe(true); // x
  });

  it('inverse of 1 is 1 (Req 5.1)', () => {
    const a = [1n]; // 1
    const inv = extFieldInverse(a, gf4);
    expect(polyEqual(inv, [1n])).toBe(true);
  });

  it('division: x / (x+1) = x * inv(x+1) = x * x = x^2 = x+1 (Req 5.2)', () => {
    const a = [0n, 1n]; // x
    const b = [1n, 1n]; // x + 1
    const result = extFieldDiv(a, b, gf4);
    // x / (x+1) = x * x = x^2 = x + 1 mod (x^2 + x + 1)
    expect(polyEqual(result, [1n, 1n])).toBe(true);
  });

  it('exponentiation: x^2 = x+1 (Req 6.1)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldPow(a, 2n, gf4);
    // x^2 mod (x^2+x+1) = x + 1
    expect(polyEqual(result, [1n, 1n])).toBe(true);
  });

  it('exponentiation: x^3 = 1 (order of x in GF(4) is 3)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldPow(a, 3n, gf4);
    // x^3 = x * x^2 = x * (x+1) = 1
    expect(polyEqual(result, [1n])).toBe(true);
  });

  it('exponentiation: a^0 = 1', () => {
    const a = [0n, 1n]; // x
    const result = extFieldPow(a, 0n, gf4);
    expect(polyEqual(result, [1n])).toBe(true);
  });

  it('negative exponent: x^(-1) = x+1 (Req 6.2)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldPow(a, -1n, gf4);
    expect(polyEqual(result, [1n, 1n])).toBe(true); // inverse of x = x+1
  });
});

describe('Extension Field - GF(3^2) with x^2 + 1', () => {
  // Elements are polynomials ax + b with a, b in {0,1,2}
  // x^2 ≡ -1 ≡ 2 (mod 3) in this field

  it('addition: (2x + 1) + (x + 2) = 0x + 0 = 0 (Req 3.2)', () => {
    const a = [1n, 2n]; // 2x + 1
    const b = [2n, 1n]; // x + 2
    const result = extFieldAdd(a, b, gf9);
    // (1+2) mod 3 = 0, (2+1) mod 3 = 0
    expect(polyEqual(result, [])).toBe(true); // zero polynomial
  });

  it('addition: (x) + (2x) = 0 (Req 3.2)', () => {
    const a = [0n, 1n]; // x
    const b = [0n, 2n]; // 2x
    const result = extFieldAdd(a, b, gf9);
    expect(polyEqual(result, [])).toBe(true);
  });

  it('subtraction: (2x+1) - (x+2) = x + 2 (Req 3.4)', () => {
    const a = [1n, 2n]; // 2x + 1
    const b = [2n, 1n]; // x + 2
    const result = extFieldSub(a, b, gf9);
    // (1-2) mod 3 = 2, (2-1) mod 3 = 1 → x + 2
    expect(polyEqual(result, [2n, 1n])).toBe(true);
  });

  it('multiplication: x * x = 2 (since x^2 ≡ -1 ≡ 2 mod 3) (Req 4.2)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldMul(a, a, gf9);
    // x^2 mod (x^2 + 1) with p=3: remainder is -1 mod 3 = 2
    expect(polyEqual(result, [2n])).toBe(true);
  });

  it('multiplication: (x+1) * (x+2) (Req 4.2)', () => {
    const a = [1n, 1n]; // x + 1
    const b = [2n, 1n]; // x + 2
    // (x+1)(x+2) = x^2 + 3x + 2 = x^2 + 0x + 2 (mod 3)
    // x^2 ≡ 2, so result = 2 + 2 = 4 mod 3 = 1
    const result = extFieldMul(a, b, gf9);
    expect(polyEqual(result, [1n])).toBe(true);
  });

  it('inverse: inv(x) * x = 1 (Req 5.1)', () => {
    const a = [0n, 1n]; // x
    const inv = extFieldInverse(a, gf9);
    const product = extFieldMul(a, inv, gf9);
    expect(polyEqual(product, [1n])).toBe(true);
  });

  it('inverse of x is 2x (since x * 2x = 2x^2 = 2*2 = 4 = 1 mod 3) (Req 5.1)', () => {
    const a = [0n, 1n]; // x
    const inv = extFieldInverse(a, gf9);
    // x * 2x = 2x^2, x^2 ≡ 2, so 2*2 = 4 = 1 mod 3
    expect(polyEqual(inv, [0n, 2n])).toBe(true);
  });

  it('division: a / b = a * inv(b) (Req 5.2)', () => {
    const a = [1n, 1n]; // x + 1
    const b = [0n, 1n]; // x
    const divResult = extFieldDiv(a, b, gf9);
    const bInv = extFieldInverse(b, gf9);
    const mulResult = extFieldMul(a, bInv, gf9);
    expect(polyEqual(divResult, mulResult)).toBe(true);
  });

  it('exponentiation: x^4 = 1 (since x^2=2, x^4=4=1 mod 3)', () => {
    const a = [0n, 1n]; // x
    const result = extFieldPow(a, 4n, gf9);
    // x^2 = 2, x^4 = (x^2)^2 = 2^2 = 4 = 1 mod 3
    expect(polyEqual(result, [1n])).toBe(true);
  });
});

describe('Extension Field - GF(2^8) with AES polynomial', () => {
  // In AES/GF(2^8), elements are bytes represented as polynomials.
  // The AES polynomial is x^8 + x^4 + x^3 + x + 1.

  /**
   * Convert a byte (number 0-255) to a polynomial representation.
   * Bit i of the byte corresponds to the coefficient of x^i.
   */
  function byteToPoly(byte: number): bigint[] {
    const result: bigint[] = [];
    for (let i = 0; i < 8; i++) {
      result.push(BigInt((byte >> i) & 1));
    }
    // Normalize: remove trailing zeros
    while (result.length > 0 && result[result.length - 1] === 0n) {
      result.pop();
    }
    return result;
  }

  /**
   * Convert a polynomial back to a byte.
   */
  function polyToByte(poly: bigint[]): number {
    let byte = 0;
    for (let i = 0; i < poly.length; i++) {
      if (poly[i] === 1n) {
        byte |= (1 << i);
      }
    }
    return byte;
  }

  it('multiplication: 0x57 * 0x83 = 0xC1 (known AES result) (Req 4.2)', () => {
    // This is a well-known AES MixColumns multiplication example
    const a = byteToPoly(0x57); // x^6 + x^4 + x^2 + x + 1
    const b = byteToPoly(0x83); // x^7 + x + 1
    const result = extFieldMul(a, b, gf256);
    expect(polyToByte(result)).toBe(0xC1);
  });

  it('multiplication: 0x57 * 0x13 = 0xFE (known AES result) (Req 4.2)', () => {
    const a = byteToPoly(0x57);
    const b = byteToPoly(0x13);
    const result = extFieldMul(a, b, gf256);
    expect(polyToByte(result)).toBe(0xFE);
  });

  it('multiplication by 1 is identity (Req 4.2)', () => {
    const a = byteToPoly(0x57);
    const one = [1n];
    const result = extFieldMul(a, one, gf256);
    expect(polyToByte(result)).toBe(0x57);
  });

  it('multiplication by 0 is 0', () => {
    const a = byteToPoly(0x57);
    const zero: bigint[] = [];
    const result = extFieldMul(a, zero, gf256);
    expect(polyEqual(result, [])).toBe(true);
  });

  it('inverse: element * inv(element) = 1 (Req 5.1)', () => {
    const a = byteToPoly(0x53);
    const inv = extFieldInverse(a, gf256);
    const product = extFieldMul(a, inv, gf256);
    expect(polyEqual(product, [1n])).toBe(true);
  });

  it('inverse of 0x03 gives known AES S-box related value (Req 5.1)', () => {
    // In GF(2^8) with AES polynomial, 0x03^(-1) = 0xF6
    const a = byteToPoly(0x03);
    const inv = extFieldInverse(a, gf256);
    const product = extFieldMul(a, inv, gf256);
    expect(polyEqual(product, [1n])).toBe(true);
  });

  it('addition in GF(2^8) is XOR (Req 3.2)', () => {
    const a = byteToPoly(0x57); // 01010111
    const b = byteToPoly(0x83); // 10000011
    const result = extFieldAdd(a, b, gf256);
    // XOR: 0x57 ^ 0x83 = 0xD4
    expect(polyToByte(result)).toBe(0x57 ^ 0x83);
  });

  it('subtraction in GF(2^8) equals addition (XOR) (Req 3.4)', () => {
    const a = byteToPoly(0x57);
    const b = byteToPoly(0x83);
    const addResult = extFieldAdd(a, b, gf256);
    const subResult = extFieldSub(a, b, gf256);
    expect(polyEqual(addResult, subResult)).toBe(true);
  });

  it('exponentiation: a^255 = 1 for any non-zero a (Fermat)', () => {
    // In GF(2^8), the multiplicative group has order 255
    const a = byteToPoly(0x02);
    const result = extFieldPow(a, 255n, gf256);
    expect(polyEqual(result, [1n])).toBe(true);
  });

  it('exponentiation: a^(-1) equals inverse (Req 6.2)', () => {
    const a = byteToPoly(0x53);
    const powResult = extFieldPow(a, -1n, gf256);
    const invResult = extFieldInverse(a, gf256);
    expect(polyEqual(powResult, invResult)).toBe(true);
  });
});

describe('Extension Field - Error cases', () => {
  it('inverse of zero throws error (Req 5.3)', () => {
    expect(() => extFieldInverse([], gf4)).toThrow(
      'The zero element has no multiplicative inverse.'
    );
  });

  it('inverse of zero polynomial [0n] throws error (Req 5.3)', () => {
    expect(() => extFieldInverse([0n], gf4)).toThrow(
      'The zero element has no multiplicative inverse.'
    );
  });

  it('division by zero throws error (Req 5.4)', () => {
    expect(() => extFieldDiv([1n], [], gf4)).toThrow(
      'Division by zero is undefined in any field.'
    );
  });

  it('division by zero polynomial [0n] throws error (Req 5.4)', () => {
    expect(() => extFieldDiv([1n], [0n], gf9)).toThrow(
      'Division by zero is undefined in any field.'
    );
  });

  it('zero to negative power throws error (Req 6.3)', () => {
    expect(() => extFieldPow([], -1n, gf4)).toThrow(
      'Exponentiation of zero to a negative power is undefined.'
    );
  });

  it('zero polynomial [0n] to negative power throws error (Req 6.3)', () => {
    expect(() => extFieldPow([0n], -2n, gf256)).toThrow(
      'Exponentiation of zero to a negative power is undefined.'
    );
  });
});
