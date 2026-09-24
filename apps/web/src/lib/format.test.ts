import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('groups rupees in lakhs', () => {
    expect(formatCurrency(150000)).toBe('₹1,50,000');
  });

  it('accepts the decimal strings the API sends and keeps paise', () => {
    expect(formatCurrency('1500.5')).toBe('₹1,500.50');
  });

  it('shows a dash for values that are not numbers', () => {
    expect(formatCurrency('abc')).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats in India time, so late-evening UTC timestamps show the Indian date', () => {
    // 20:00 UTC on 23 Sept is 01:30 on 24 Sept in India
    expect(formatDate('2026-09-23T20:00:00Z')).toMatch(/^24 Sept? 2026$/);
  });

  it('shows a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});
