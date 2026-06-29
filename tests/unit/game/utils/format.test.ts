import { describe, it, expect } from 'vitest';
import { formatNumber } from '../../../../src/game/utils/format';

describe('formatNumber', () => {
  describe('values below 1K', () => {
    it('formats 0 as "0"', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('formats 1 as "1"', () => {
      expect(formatNumber(1)).toBe('1');
    });

    it('formats 999 as "999"', () => {
      expect(formatNumber(999)).toBe('999');
    });

    it('formats 500 as "500"', () => {
      expect(formatNumber(500)).toBe('500');
    });
  });

  describe('values at 1K boundary', () => {
    it('formats 1000 as "1.0K"', () => {
      expect(formatNumber(1000)).toBe('1.0K');
    });

    it('formats 1500 as "1.5K"', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('formats 999999 as "1000.0K"', () => {
      // Just below 1M, still uses K notation
      expect(formatNumber(999999)).toBe('1000.0K');
    });
  });

  describe('values at 1M boundary', () => {
    it('formats 1000000 as "1.0M"', () => {
      expect(formatNumber(1_000_000)).toBe('1.0M');
    });

    it('formats 2500000 as "2.5M"', () => {
      expect(formatNumber(2_500_000)).toBe('2.5M');
    });

    it('formats 999999999 as "1000.0M"', () => {
      // Just below 1B, still uses M notation
      expect(formatNumber(999_999_999)).toBe('1000.0M');
    });
  });

  describe('values at 1B boundary', () => {
    it('formats 1000000000 as "1.0B"', () => {
      expect(formatNumber(1_000_000_000)).toBe('1.0B');
    });

    it('formats 7500000000 as "7.5B"', () => {
      expect(formatNumber(7_500_000_000)).toBe('7.5B');
    });
  });

  describe('edge cases', () => {
    it('formats negative numbers below 1K as integers', () => {
      expect(formatNumber(-5)).toBe('-5');
    });

    it('formats very large numbers in B notation', () => {
      expect(formatNumber(100_000_000_000)).toBe('100.0B');
    });
  });
});
