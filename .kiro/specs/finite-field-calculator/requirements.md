# Requirements Document

## Introduction

The Finite Field Calculator is a client-side web application hosted on GitHub Pages that provides an accessible interface for performing arithmetic and algebraic operations within finite fields (Galois fields). It supports both prime fields GF(p) and extension fields GF(p^n), enabling users to perform addition, subtraction, multiplication, division, exponentiation, inverse computation, and polynomial arithmetic. The application targets students, researchers, and engineers working with cryptography, coding theory, and abstract algebra. The project is stored in a GitHub repository with automated deployment to GitHub Pages.

## Glossary

- **Calculator**: The finite field calculator application that accepts user input, performs field operations, and displays results.
- **Prime_Field**: A finite field GF(p) where p is a prime number and arithmetic is performed modulo p.
- **Extension_Field**: A finite field GF(p^n) where p is prime, n > 1, and arithmetic is performed modulo an irreducible polynomial of degree n over GF(p).
- **Field_Element**: A valid member of the currently selected finite field.
- **Irreducible_Polynomial**: A polynomial over GF(p) of degree n that cannot be factored into non-trivial polynomials over GF(p), used to define GF(p^n).
- **Polynomial**: A mathematical expression consisting of coefficients from GF(p) with non-negative integer exponents.
- **Inverse**: The multiplicative inverse of a non-zero Field_Element a such that a × a⁻¹ = 1 in the field.
- **Field_Configuration**: The set of parameters defining the active field, including the prime p, the extension degree n, and (when n > 1) the Irreducible_Polynomial.
- **Result_Display**: The component of the Calculator that presents computation results to the user.
- **Input_Parser**: The component of the Calculator that interprets user-provided expressions and field elements.
- **Pretty_Printer**: The component of the Calculator that formats Field_Elements and Polynomials into human-readable string representations.
- **GitHub_Pages**: The static site hosting service provided by GitHub, used to deploy and serve the Calculator as a publicly accessible web application.
- **Repository**: The GitHub repository containing the source code, build configuration, and deployment workflow for the Calculator.

## Requirements

### Requirement 1: Field Configuration

**User Story:** As a user, I want to configure the finite field I am working in, so that all subsequent operations are performed within the correct algebraic structure.

#### Acceptance Criteria

1. WHEN the user specifies a prime p, THE Calculator SHALL configure a Prime_Field GF(p) for subsequent operations.
2. WHEN the user specifies a prime p and an extension degree n greater than 1, THE Calculator SHALL require an Irreducible_Polynomial of degree n over GF(p) to configure an Extension_Field GF(p^n).
3. IF the user provides a value of p that is not a prime number, THEN THE Calculator SHALL display an error message indicating that p must be prime.
4. IF the user provides a polynomial that is not irreducible over GF(p), THEN THE Calculator SHALL display an error message indicating the polynomial is reducible.
5. WHEN the user changes the Field_Configuration, THE Calculator SHALL clear any previous computation state and apply the new configuration immediately.

### Requirement 2: Element Input and Parsing

**User Story:** As a user, I want to input field elements in a natural notation, so that I can work with the calculator without memorizing obscure syntax.

#### Acceptance Criteria

1. WHEN the user enters an integer value within the range [0, p-1], THE Input_Parser SHALL interpret it as a valid Field_Element of GF(p).
2. WHEN the user enters a polynomial expression with coefficients in [0, p-1] and degree less than n, THE Input_Parser SHALL interpret it as a valid Field_Element of GF(p^n).
3. IF the user enters a value outside the valid range for the current Field_Configuration, THEN THE Input_Parser SHALL display an error message specifying the valid range.
4. FOR ALL valid Field_Elements, parsing then pretty-printing then parsing SHALL produce an equivalent Field_Element (round-trip property).

### Requirement 3: Addition and Subtraction

**User Story:** As a user, I want to add and subtract field elements, so that I can perform basic arithmetic in the finite field.

#### Acceptance Criteria

1. WHEN the user requests addition of two Field_Elements a and b, THE Calculator SHALL compute and display (a + b) mod p for Prime_Field operations.
2. WHEN the user requests addition of two Field_Elements a and b in an Extension_Field, THE Calculator SHALL compute and display the coefficient-wise sum modulo p of the two polynomial representations.
3. WHEN the user requests subtraction of two Field_Elements a and b, THE Calculator SHALL compute and display (a - b) mod p for Prime_Field operations.
4. WHEN the user requests subtraction of two Field_Elements a and b in an Extension_Field, THE Calculator SHALL compute and display the coefficient-wise difference modulo p of the two polynomial representations.

### Requirement 4: Multiplication

**User Story:** As a user, I want to multiply field elements, so that I can explore multiplicative structure in the finite field.

#### Acceptance Criteria

1. WHEN the user requests multiplication of two Field_Elements a and b in a Prime_Field, THE Calculator SHALL compute and display (a × b) mod p.
2. WHEN the user requests multiplication of two Field_Elements a and b in an Extension_Field, THE Calculator SHALL compute and display the product of the two polynomial representations reduced modulo the Irreducible_Polynomial.

### Requirement 5: Multiplicative Inverse and Division

**User Story:** As a user, I want to find multiplicative inverses and divide field elements, so that I can solve equations and explore field properties.

#### Acceptance Criteria

1. WHEN the user requests the Inverse of a non-zero Field_Element a, THE Calculator SHALL compute and display a⁻¹ such that a × a⁻¹ = 1 in the current field.
2. WHEN the user requests division of Field_Element a by non-zero Field_Element b, THE Calculator SHALL compute and display a × b⁻¹ in the current field.
3. IF the user requests the Inverse of the zero element, THEN THE Calculator SHALL display an error message indicating that zero has no multiplicative inverse.
4. IF the user requests division by the zero element, THEN THE Calculator SHALL display an error message indicating that division by zero is undefined.

### Requirement 6: Exponentiation

**User Story:** As a user, I want to raise field elements to integer powers, so that I can compute repeated multiplication efficiently.

#### Acceptance Criteria

1. WHEN the user requests exponentiation of a Field_Element a to a non-negative integer power k, THE Calculator SHALL compute and display a^k in the current field.
2. WHEN the user requests exponentiation of a non-zero Field_Element a to a negative integer power k, THE Calculator SHALL compute and display (a⁻¹)^|k| in the current field.
3. IF the user requests exponentiation of the zero element to a negative power, THEN THE Calculator SHALL display an error message indicating the operation is undefined.

### Requirement 7: Polynomial Arithmetic

**User Story:** As a user, I want to perform arithmetic on polynomials over GF(p) without reducing modulo an irreducible polynomial, so that I can work with polynomials as standalone objects.

#### Acceptance Criteria

1. WHEN the user requests polynomial addition of two Polynomials over GF(p), THE Calculator SHALL compute and display the coefficient-wise sum modulo p.
2. WHEN the user requests polynomial multiplication of two Polynomials over GF(p), THE Calculator SHALL compute and display the product with all coefficients reduced modulo p.
3. WHEN the user requests polynomial division of Polynomial a by non-zero Polynomial b over GF(p), THE Calculator SHALL compute and display both the quotient and remainder.
4. IF the user requests polynomial division by the zero polynomial, THEN THE Calculator SHALL display an error message indicating that division by the zero polynomial is undefined.

### Requirement 8: Result Display and Formatting

**User Story:** As a user, I want results displayed in a clear, readable format, so that I can understand computation outputs without ambiguity.

#### Acceptance Criteria

1. THE Pretty_Printer SHALL format Prime_Field elements as integers in the range [0, p-1].
2. THE Pretty_Printer SHALL format Extension_Field elements as polynomials with descending degree order using a consistent variable symbol.
3. WHEN a computation produces a result, THE Result_Display SHALL show both the operation performed and the resulting Field_Element.
4. THE Pretty_Printer SHALL format the zero polynomial as the string "0".

### Requirement 9: Error Handling and Validation

**User Story:** As a user, I want clear error messages when I provide invalid input, so that I can correct mistakes without confusion.

#### Acceptance Criteria

1. IF the user provides a malformed expression that the Input_Parser cannot interpret, THEN THE Calculator SHALL display an error message describing the expected input format.
2. IF an internal computation error occurs, THEN THE Calculator SHALL display a general error message and maintain a usable state.
3. WHEN an error is displayed, THE Calculator SHALL preserve the current Field_Configuration and allow the user to retry the operation.

### Requirement 10: GitHub Hosting and Deployment

**User Story:** As a developer, I want the application stored in a GitHub repository and deployed to GitHub Pages, so that users can access the calculator from any browser without installing anything.

#### Acceptance Criteria

1. THE Calculator SHALL be implemented as a client-side web application requiring no backend server.
2. THE Repository SHALL include a GitHub Actions workflow that automatically builds and deploys the application to GitHub_Pages on push to the main branch.
3. THE Calculator SHALL be accessible via the GitHub_Pages URL and function correctly as a static site.
4. THE Repository SHALL include a README with project description, usage instructions, and a link to the live GitHub_Pages deployment.

### Requirement 11: Irreducible Polynomial Assistance

**User Story:** As a user, I want the calculator to help me find irreducible polynomials, so that I can set up extension fields without manual lookup.

#### Acceptance Criteria

1. WHEN the user requests an irreducible polynomial of degree n over GF(p), THE Calculator SHALL compute and return a valid Irreducible_Polynomial of degree n.
2. WHEN the user provides a polynomial and requests an irreducibility check, THE Calculator SHALL determine and display whether the polynomial is irreducible over GF(p).
