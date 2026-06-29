/**
 * Shared types for the Finite Field Calculator.
 *
 * Polynomial representation: coefficients[i] = coefficient of x^i (ascending degree order).
 * Normalized polynomials have no trailing zeros (the zero polynomial is []).
 */

/** A polynomial with BigInt coefficients, stored in ascending degree order. */
export type Polynomial = bigint[];

/** Configuration for a prime field GF(p). */
export interface PrimeFieldConfig {
  p: bigint;
}

/** Configuration for an extension field GF(p^n). */
export interface ExtFieldConfig {
  p: bigint;
  n: number;
  irreducible: Polynomial; // irreducible polynomial of degree n over GF(p)
}

/** A discriminated union for success/failure results. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** All supported calculator operations. */
export type Operation =
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'inverse'
  | 'pow'
  | 'poly_add'
  | 'poly_mul'
  | 'poly_div'
  | 'find_irreducible'
  | 'check_irreducible';
