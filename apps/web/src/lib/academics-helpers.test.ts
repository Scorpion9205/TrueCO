import { describe, expect, it } from 'vitest';
import { todayInIndia } from '@/components/students/student-form-dialog';
import { changedFields, compact, fullName } from './academics';
import { whatsappLink } from './phone';
import { currentAcademicYear, formatTime, sortDays } from './schedule';

describe('schedule helpers', () => {
  it.each([
    ['07:30', '7:30 AM'],
    ['00:05', '12:05 AM'],
    ['12:00', '12:00 PM'],
    ['17:45', '5:45 PM'],
    ['after school', 'after school'],
    [null, ''],
  ])('formatTime(%s) = %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it('puts days in week order', () => {
    expect(sortDays(['FRI', 'MON', 'SUN', 'WED'])).toEqual(['MON', 'WED', 'FRI', 'SUN']);
  });

  it.each([
    ['2026-09-24T06:00:00Z', '2026-27'],
    ['2027-02-10T06:00:00Z', '2026-27'],
    ['2027-04-01T06:00:00Z', '2027-28'],
    // 31 March 20:00 UTC is already 1 April in India
    ['2027-03-31T20:00:00Z', '2027-28'],
    ['2099-06-01T06:00:00Z', '2099-00'],
  ])('academic year on %s is %s', (iso, expected) => {
    expect(currentAcademicYear(new Date(iso))).toBe(expected);
  });

  it('dates "today" in India, not UTC', () => {
    expect(todayInIndia(new Date('2026-09-24T20:00:00Z'))).toBe('2026-09-25');
  });
});

describe('student helpers', () => {
  it('joins names', () => {
    expect(fullName({ firstName: 'Aarav', lastName: 'Sharma' })).toBe('Aarav Sharma');
  });

  it('drops blank fields but keeps false and zero', () => {
    expect(compact({ a: 'x', b: '', c: undefined, d: false, e: 0 })).toEqual({
      a: 'x',
      d: false,
      e: 0,
    });
  });

  it.each([
    ['9876543210', 'https://wa.me/919876543210'],
    ['09876543210', 'https://wa.me/919876543210'],
    ['+91 98765 43210', 'https://wa.me/919876543210'],
    ['+1 415 555 0100', 'https://wa.me/14155550100'],
  ])('WhatsApp link for %s', (phone, expected) => {
    expect(whatsappLink(phone)).toBe(expected);
  });
});

describe('changedFields', () => {
  const saved = { name: 'Class 10', subject: 'Physics', email: null, days: ['MON'] };

  it('keeps only edited fields, sending emptied ones as null', () => {
    expect(
      changedFields(saved, { name: 'Class 10', subject: '', email: '', days: ['MON', 'WED'] }),
    ).toEqual({ subject: null, days: ['MON', 'WED'] });
  });

  it('is empty when nothing changed', () => {
    expect(changedFields(saved, { name: 'Class 10', email: '' })).toEqual({});
  });
});
