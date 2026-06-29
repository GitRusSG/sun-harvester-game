import { describe, it, expect } from 'vitest';
import type { Polynomial, PrimeFieldConfig, ExtFieldConfig, Result, Operation } from '../../src/types';

describe('shared types', () => {
  it('Polynomial type represents coefficients in ascending degree order', () => {
    // 2x^2 + 3x + 1 → [1n, 3n, 2n]
    const poly: Polynomial = [1n, 3n, 2n];
    expect(poly[0]).toBe(1n);
    expect(poly[1]).toBe(3n);
    expect(poly[2]).toBe(2n);
  });

  it('PrimeFieldConfig holds a prime p', () => {
    const config: PrimeFieldConfig = { p: 7n };
    expect(config.p).toBe(7n);
  });

  it('ExtFieldConfig holds p, n, and irreducible polynomial', () => {
    // GF(2^3) with irreducible x^3 + x + 1 → [1n, 1n, 0n, 1n]
    const config: ExtFieldConfig = {
      p: 2n,
      n: 3,
      irreducible: [1n, 1n, 0n, 1n],
    };
    expect(config.p).toBe(2n);
    expect(config.n).toBe(3);
    expect(config.irreducible.length).toBe(4);
  });

  it('Result type represents success', () => {
    const success: Result<number, string> = { ok: true, value: 42 };
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.value).toBe(42);
    }
  });

  it('Result type represents failure', () => {
    const failure: Result<number, string> = { ok: false, error: 'something went wrong' };
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error).toBe('something went wrong');
    }
  });

  it('Operation type covers all operations', () => {
    const ops: Operation[] = [
      'add', 'sub', 'mul', 'div',
      'inverse', 'pow',
      'poly_add', 'poly_mul', 'poly_div',
      'find_irreducible', 'check_irreducible',
    ];
    expect(ops).toHaveLength(11);
  });
});
