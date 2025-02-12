/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitizes user input by removing special characters and trimming whitespace
 * @param {string} input - The input string to sanitize
 * @returns {string} The sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[^\w\s-]/g, '').trim();
}

/**
 * Validates and sanitizes numeric input
 * @param {number|string} input - The input to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} The validated and sanitized number
 */
export function validateNumericInput(input, min = -Infinity, max = Infinity) {
  const num = Number(input);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(Math.max(num, min), max);
}
