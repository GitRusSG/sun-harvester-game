/**
 * Core modular arithmetic utilities for finite field operations.
 * All functions use BigInt for arbitrary-precision integer arithmetic.
 */

/**
 * Computes (a + b) mod p, with result in [0, p-1].
 */
export function modAdd(a: bigint, b: bigint, p: bigint): bigint {
  return ((a % p) + (b % p) + 2n * p) % p;
}

/**
 * Computes (a - b) mod p, with result in [0, p-1].
 * Handles negative intermediate results by adding p.
 */
export function modSub(a: bigint, b: bigint, p: bigint): bigint {
  return (((a % p) - (b % p)) % p + p) % p;
}

/**
 * Computes (a * b) mod p, with result in [0, p-1].
 */
export function modMul(a: bigint, b: bigint, p: bigint): bigint {
  const aMod = ((a % p) + p) % p;
  const bMod = ((b % p) + p) % p;
  return (aMod * bMod) % p;
}

/**
 * Computes (base^exp) mod p using binary exponentiation (square-and-multiply).
 * Handles:
 * - exp = 0 → returns 1 (for any base, including 0)
 * - exp < 0 → computes inverse(base)^|exp|
 * - exp > 0 → standard square-and-multiply
 */
export function modPow(base: bigint, exp: bigint, p: bigint): bigint {
  if (p === 1n) return 0n;

  if (exp === 0n) return 1n;

  if (exp < 0n) {
    // For negative exponents, compute modPow(modInverse(base, p), -exp, p)
    const inv = modInverse(base, p);
    return modPow(inv, -exp, p);
  }

  // Normalize base to [0, p-1]
  let result = 1n;
  let b = ((base % p) + p) % p;

  let e = exp;
  while (e > 0n) {
    if (e & 1n) {
      result = (result * b) % p;
    }
    b = (b * b) % p;
    e >>= 1n;
  }

  return result;
}

/**
 * Computes the modular multiplicative inverse of a modulo p using the
 * Extended Euclidean Algorithm.
 *
 * Returns a value x such that (a * x) ≡ 1 (mod p).
 * Throws an error if the inverse does not exist (i.e., gcd(a, p) ≠ 1).
 */
export function modInverse(a: bigint, p: bigint): bigint {
  // Normalize a to [0, p-1]
  const normalizedA = ((a % p) + p) % p;

  if (normalizedA === 0n) {
    throw new Error('The zero element has no multiplicative inverse.');
  }

  // Extended Euclidean Algorithm
  let oldR = normalizedA;
  let r = p;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const quotient = oldR / r;
    const tempR = r;
    r = oldR - quotient * r;
    oldR = tempR;

    const tempS = s;
    s = oldS - quotient * s;
    oldS = tempS;
  }

  // gcd must be 1 for inverse to exist
  if (oldR !== 1n) {
    throw new Error(`No multiplicative inverse exists: gcd(${a}, ${p}) = ${oldR}`);
  }

  // Ensure result is in [0, p-1]
  return ((oldS % p) + p) % p;
}

/**
 * Deterministic Miller-Rabin primality test.
 * Uses witnesses sufficient for correctness up to 2^64.
 * Returns true if n is prime, false otherwise.
 */
export function isPrime(n: bigint): boolean {
  // Handle small cases
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n || n % 3n === 0n) return false;

  // Small primes check for efficiency
  const smallPrimes = [5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  for (const sp of smallPrimes) {
    if (n === sp) return true;
    if (n % sp === 0n) return false;
  }

  // Write n-1 as 2^r * d where d is odd
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d >>= 1n;
    r++;
  }

  // Deterministic witnesses for numbers up to 2^64
  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

  for (const a of witnesses) {
    // Skip if witness >= n
    if (a >= n) continue;

    let x = modPow(a, d, n);

    if (x === 1n || x === n - 1n) continue;

    let composite = true;
    for (let i = 1n; i < r; i++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }

    if (composite) return false;
  }

  return true;
}
