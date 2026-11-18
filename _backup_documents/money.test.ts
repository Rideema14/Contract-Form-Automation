import { describe, it, expect } from 'vitest';
import { formatMoney, sumMoney } from './money';

describe('money helpers', () => {
  it('adds exactly (no floating-point error)', () => {
    expect(sumMoney(['0.1', '0.2'])).toBe('0.30');
    expect(sumMoney(['1200.5000', '99.9900'])).toBe('1300.49');
  });
  it('handles empty lists, negatives and large values', () => {
    expect(sumMoney([])).toBe('0.00');
    expect(sumMoney(['-5.50', '2'])).toBe('-3.50');
    expect(sumMoney(['123456789012345.1234', '0.0001'], 4)).toBe('123456789012345.1235');
  });
  it('rounds half up to the requested decimals', () => {
    expect(formatMoney('1.005')).toBe('1.01');
    expect(formatMoney('2.5', 0)).toBe('3');
    expect(formatMoney('1200.5000')).toBe('1200.50');
  });
  it('rejects invalid input', () => {
    expect(() => formatMoney('abc')).toThrow();
  });
});
