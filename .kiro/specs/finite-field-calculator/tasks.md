# Implementation Plan: Finite Field Calculator

## Overview

Build a client-side finite field calculator as a TypeScript SPA using Vite, deployed to GitHub Pages. Implementation proceeds bottom-up: core modular arithmetic utilities first, then field modules, polynomial arithmetic, irreducible polynomial support, parser/formatter, controller, UI layer, and finally deployment configuration. Testing uses Vitest with fast-check for property-based tests.

## Tasks

- [x] 1. Set up project structure and tooling
  - Initialize Vite project with TypeScript template
  - Configure Vitest and fast-check as dev dependencies
  - Create directory structure: `src/core/`, `src/fields/`, `src/poly/`, `src/parser/`, `src/formatter/`, `src/controller/`, `tests/unit/`, `tests/property/`, `tests/integration/`
  - Define shared types in `src/types.ts`: `Polynomial`, `PrimeFieldConfig`, `ExtFieldConfig`, `Result<T,E>`, `Operation`
  - _Requirements: 10.1_

- [ ] 2. Implement core modular arithmetic utilities
  - [x] 2.1 Implement `src/core/mod-arithmetic.ts`
    - Implement `modAdd`, `modSub`, `modMul` using BigInt arithmetic
    - Implement `modPow` using binary exponentiation (square-and-multiply)
    - Implement `modInverse` using the Extended Euclidean Algorithm
    - Implement `isPrime` using Miller-Rabin primality test with deterministic witnesses for numbers up to 2^64
    - _Requirements: 1.3, 3.1, 3.3, 4.1, 5.1, 6.1_

  - [x] 2.2 Write property test: Non-Prime Rejection (Property 11)
    - **Property 11: Non-Prime Rejection**
    - Test that `isPrime` returns false for all composite numbers and true for primes
    - Use composite number generator (products of small primes)
    - **Validates: Requirements 1.3**

  - [x] 2.3 Write unit tests for core modular arithmetic
    - Test `modAdd`, `modSub`, `modMul` with known values
    - Test `modPow` with edge cases (exponent 0, exponent 1, large exponents)
    - Test `modInverse` with known inverses and verify a × a⁻¹ ≡ 1 (mod p)
    - Test `isPrime` with known primes and composites
    - _Requirements: 3.1, 3.3, 4.1, 5.1, 6.1_

- [ ] 3. Implement polynomial arithmetic module
  - [x] 3.1 Implement `src/poly/polynomial.ts`
    - Implement `polyNormalize` to remove trailing zero coefficients
    - Implement `polyIsZero`, `polyEqual`, `polyDegree`
    - Implement `polyAdd` and `polySub` with coefficient-wise operations modulo p
    - Implement `polyMul` using convolution with coefficients reduced modulo p
    - Implement `polyDivMod` using polynomial long division over GF(p)
    - Implement `polyReduce` to reduce a polynomial modulo another
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 3.2 Write property test: Polynomial Addition Commutativity (Property 9)
    - **Property 9: Polynomial Addition Commutativity**
    - Generate random polynomials over GF(p), verify polyAdd(a, b) === polyAdd(b, a) and all coefficients in [0, p-1]
    - **Validates: Requirements 7.1**

  - [x] 3.3 Write property test: Polynomial Multiplication Coefficients in Range (Property 10)
    - **Property 10: Polynomial Multiplication Coefficients in Range**
    - Generate random polynomials over GF(p), verify all coefficients of polyMul(a, b) are in [0, p-1]
    - **Validates: Requirements 7.2**

  - [x] 3.4 Write property test: Polynomial Division Invariant (Property 8)
    - **Property 8: Polynomial Division Invariant**
    - Generate polynomial a and non-zero polynomial b over GF(p), compute (q, r) = polyDivMod(a, b), verify a === b × q + r and deg(r) < deg(b)
    - **Validates: Requirements 7.3**

  - [x] 3.5 Write unit tests for polynomial arithmetic
    - Test polyAdd, polySub, polyMul with known polynomial examples
    - Test polyDivMod with textbook polynomial division examples
    - Test edge cases: zero polynomial, constant polynomials, degree-1 polynomials
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement prime field module
  - [x] 5.1 Implement `src/fields/prime-field.ts`
    - Implement `primeFieldAdd`, `primeFieldSub`, `primeFieldMul` wrapping core mod functions with PrimeFieldConfig
    - Implement `primeFieldInverse` using `modInverse` with zero-check error handling
    - Implement `primeFieldDiv` as multiplication by inverse with zero-divisor check
    - Implement `primeFieldPow` supporting negative exponents via inverse
    - _Requirements: 3.1, 3.3, 4.1, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 5.2 Write property test: Addition Commutativity (Property 2) for prime fields
    - **Property 2: Addition Commutativity**
    - Generate random prime p and elements a, b in GF(p), verify a + b === b + a
    - **Validates: Requirements 3.1**

  - [x] 5.3 Write property test: Additive Inverse (Property 3) for prime fields
    - **Property 3: Additive Inverse (Subtraction)**
    - Generate random prime p and element a in GF(p), verify a - a === 0 and a + (0 - a) === 0
    - **Validates: Requirements 3.3**

  - [x] 5.4 Write property test: Multiplication Commutativity (Property 4) for prime fields
    - **Property 4: Multiplication Commutativity**
    - Generate random prime p and elements a, b in GF(p), verify a × b === b × a
    - **Validates: Requirements 4.1**

  - [x] 5.5 Write property test: Multiplicative Inverse (Property 5) for prime fields
    - **Property 5: Multiplicative Inverse**
    - Generate random prime p and non-zero element a in GF(p), verify a × inverse(a) === 1
    - **Validates: Requirements 5.1**

  - [x] 5.6 Write property test: Division as Multiplication by Inverse (Property 6) for prime fields
    - **Property 6: Division as Multiplication by Inverse**
    - Generate random prime p, element a, and non-zero element b in GF(p), verify a / b === a × inverse(b)
    - **Validates: Requirements 5.2**

  - [x] 5.7 Write property test: Exponentiation Homomorphism (Property 7) for prime fields
    - **Property 7: Exponentiation Homomorphism**
    - Generate random prime p, non-zero element a in GF(p), and non-negative integers m, n, verify a^(m+n) === a^m × a^n
    - **Validates: Requirements 6.1, 6.2**

- [ ] 6. Implement extension field module
  - [x] 6.1 Implement `src/fields/extension-field.ts`
    - Implement `extFieldAdd` and `extFieldSub` using polynomial coefficient-wise operations modulo p
    - Implement `extFieldMul` using polynomial multiplication followed by reduction modulo the irreducible polynomial
    - Implement `extFieldInverse` using the extended Euclidean algorithm for polynomials over GF(p)
    - Implement `extFieldDiv` as multiplication by inverse
    - Implement `extFieldPow` using binary exponentiation with polynomial reduction, supporting negative exponents
    - _Requirements: 3.2, 3.4, 4.2, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 6.2 Write property tests for extension field (Properties 2–7 for GF(p^n))
    - **Property 2: Addition Commutativity** for extension fields
    - **Property 3: Additive Inverse** for extension fields
    - **Property 4: Multiplication Commutativity** for extension fields
    - **Property 5: Multiplicative Inverse** for extension fields
    - **Property 6: Division as Multiplication by Inverse** for extension fields
    - **Property 7: Exponentiation Homomorphism** for extension fields
    - Use extension field config generator (valid p, n, irreducible triples)
    - **Validates: Requirements 3.2, 3.4, 4.2, 5.1, 5.2, 6.1, 6.2**

  - [x] 6.3 Write unit tests for extension field
    - Test with GF(2^8) using AES irreducible polynomial (x^8 + x^4 + x^3 + x + 1)
    - Test with small fields GF(2^2), GF(3^2) using known results
    - Test error cases: inverse of zero, division by zero
    - _Requirements: 3.2, 3.4, 4.2, 5.1, 5.2, 5.3, 5.4_

- [ ] 7. Implement irreducible polynomial module
  - [x] 7.1 Implement `src/poly/irreducible.ts`
    - Implement `isIrreducible` by checking that no polynomial of degree ≤ n/2 divides the candidate over GF(p)
    - Implement `findIrreducible` by generating candidate monic polynomials of degree n and testing irreducibility
    - _Requirements: 1.4, 11.1, 11.2_

  - [-] 7.2 Write property test: Irreducible Polynomial Generation (Property 12)
    - **Property 12: Irreducible Polynomial Generation**
    - Generate random prime p and degree n ≥ 2, verify findIrreducible(n, p) returns a polynomial of degree n that passes isIrreducible
    - **Validates: Requirements 11.1**

  - [ ] 7.3 Write property test: Irreducibility Check Correctness (Property 13)
    - **Property 13: Irreducibility Check Correctness (Reducible Polynomials)**
    - Generate two non-constant polynomials f, g over GF(p), verify isIrreducible(f × g, p) returns false
    - **Validates: Requirements 1.4, 11.2**

  - [ ] 7.4 Write unit tests for irreducible polynomial module
    - Test isIrreducible with known irreducible polynomials (e.g., x^2 + 1 over GF(2))
    - Test isIrreducible with known reducible polynomials
    - Test findIrreducible for small degrees and primes
    - _Requirements: 11.1, 11.2_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement input parser
  - [ ] 9.1 Implement `src/parser/input-parser.ts`
    - Implement `parseFieldElement` for prime fields: parse integer strings, validate range [0, p-1]
    - Implement `parseFieldElement` for extension fields: parse polynomial expressions (e.g., "2x^2 + 3x + 1"), validate coefficients and degree
    - Implement `parsePolynomial` for standalone polynomial parsing (any degree)
    - Support variable names `x` (case-insensitive), exponent notation with `^`
    - Return `Result` type with descriptive error messages for invalid input
    - _Requirements: 2.1, 2.2, 2.3, 9.1_

  - [ ] 9.2 Write unit tests for input parser
    - Test integer parsing for prime field elements
    - Test polynomial parsing with various notations (e.g., "x^2 + 1", "3x + 2", "5")
    - Test error cases: out-of-range values, malformed expressions, invalid coefficients
    - _Requirements: 2.1, 2.2, 2.3, 9.1_

- [ ] 10. Implement pretty printer
  - [ ] 10.1 Implement `src/formatter/pretty-printer.ts`
    - Implement `formatPrimeElement` to output integer string representation
    - Implement `formatPolynomial` to output descending-degree polynomial string with consistent variable symbol
    - Handle special cases: zero polynomial → "0", constant polynomial → just the constant, coefficient of 1 suppressed
    - Implement `formatResult` to combine operation description with operands and result
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 10.2 Write property test: Parse–Format Round Trip (Property 1)
    - **Property 1: Parse–Format Round Trip**
    - Generate valid field elements (prime and extension), format with Pretty Printer, parse the result, verify equivalence to original
    - **Validates: Requirements 2.4**

  - [ ] 10.3 Write property test: Formatting Produces Valid Range (Property 15)
    - **Property 15: Formatting Produces Valid Range (Prime Field)**
    - Generate prime field elements in GF(p), format with formatPrimeElement, parse the output as integer, verify it is in [0, p-1]
    - **Validates: Requirements 8.1**

  - [ ] 10.4 Write unit tests for pretty printer
    - Test formatPrimeElement with various values
    - Test formatPolynomial: zero polynomial, constants, multi-term polynomials, descending order
    - Test formatResult output structure
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 11. Implement calculator controller
  - [ ] 11.1 Implement `src/controller/calculator-controller.ts`
    - Implement `configureField`: validate prime, validate irreducible polynomial if extension field, return FieldConfig or error
    - Implement `executeOperation`: dispatch to appropriate field module based on current config and operation type
    - Handle all error categories: invalid prime, reducible polynomial, division by zero, inverse of zero, zero to negative power, parse errors
    - Ensure field configuration is preserved on errors (no state mutation on failure)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.3, 5.4, 6.3, 9.2, 9.3_

  - [ ] 11.2 Write property test: Error Preservation of Field Configuration (Property 14)
    - **Property 14: Error Preservation of Field Configuration**
    - Configure a valid field, trigger various error operations, verify field configuration remains unchanged
    - **Validates: Requirements 9.3**

  - [ ] 11.3 Write integration tests for calculator controller
    - Test full flow: configure field → parse input → compute → format result
    - Test field reconfiguration clears previous state
    - Test error recovery: error does not break subsequent valid operations
    - _Requirements: 1.1, 1.2, 1.5, 9.2, 9.3_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement UI layer
  - [ ] 13.1 Create HTML structure and CSS styling in `index.html` and `src/styles.css`
    - Build field configuration panel: prime input, extension degree input, irreducible polynomial input
    - Build operation panel: operation selector, operand inputs, compute button
    - Build result display area showing operation performed and result
    - Build error display area for validation and computation errors
    - Build polynomial tools section: irreducible polynomial finder and checker
    - Ensure accessible markup with labels, ARIA attributes, and keyboard navigation
    - _Requirements: 8.3, 9.1, 9.2, 10.1_

  - [ ] 13.2 Implement `src/main.ts` wiring UI to controller
    - Bind field configuration form to `configureField` controller method
    - Bind operation form to `executeOperation` controller method
    - Display results and errors in appropriate UI regions
    - Clear computation state when field configuration changes
    - Wire polynomial tools (find irreducible, check irreducible) to corresponding modules
    - _Requirements: 1.5, 8.3, 9.2, 9.3, 11.1, 11.2_

- [ ] 14. Configure build and deployment
  - [ ] 14.1 Configure Vite for GitHub Pages deployment
    - Set `base` in `vite.config.ts` for GitHub Pages path
    - Ensure production build outputs to `dist/` directory
    - _Requirements: 10.1, 10.3_

  - [ ] 14.2 Create GitHub Actions workflow in `.github/workflows/deploy.yml`
    - Trigger on push to main branch
    - Install dependencies, run tests (`vitest --run`), build, and deploy to GitHub Pages
    - Fail deployment if any tests fail
    - _Requirements: 10.2_

  - [ ] 14.3 Create README.md with project documentation
    - Include project description, feature list, and usage instructions
    - Include link to live GitHub Pages deployment
    - Include development setup instructions (install, test, build)
    - _Requirements: 10.4_

- [ ] 15. Final checkpoint - Ensure all tests pass and app works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Implementation proceeds bottom-up: core → fields → poly tools → parser/formatter → controller → UI → deployment
