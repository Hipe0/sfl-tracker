import { describe, it, expect } from 'vitest';
import { formatCurrency, calculateProfit, calculateROI } from '../src/utils/currencyUtils';

describe('currencyUtils', () => {
  describe('formatCurrency', () => {
    it('should format a clean integer correctly', () => {
      expect(formatCurrency(100)).toBe('100');
    });

    it('should trim floating point errors like 114.00000000000036', () => {
      expect(formatCurrency(114.00000000000036)).toBe('114');
    });

    it('should keep decimals if they are meaningful up to 4 places', () => {
      expect(formatCurrency(114.12345)).toBe('114.1235'); // rounding
    });

    it('should handle undefined or null by returning "0"', () => {
      expect(formatCurrency(null)).toBe('0');
      expect(formatCurrency(undefined)).toBe('0');
    });
  });

  describe('calculateProfit', () => {
    it('should return revenue minus cost', () => {
      expect(calculateProfit(150.5, 50)).toBe(100.5);
    });

    it('should handle string inputs correctly', () => {
      expect(calculateProfit('200', '50.5')).toBe(149.5);
    });

    it('should return negative if cost > revenue', () => {
      expect(calculateProfit(50, 100)).toBe(-50);
    });
  });

  describe('calculateROI', () => {
    it('should calculate positive ROI correctly and format with "+"', () => {
      expect(calculateROI(50, 100)).toBe('+50');
    });

    it('should calculate negative ROI correctly', () => {
      expect(calculateROI(-20, 100)).toBe('-20');
    });

    it('should handle zero cost', () => {
      expect(calculateROI(10, 0)).toBe('+100');
      expect(calculateROI(-10, 0)).toBe('0');
    });
  });
});
