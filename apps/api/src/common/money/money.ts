import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Money is handled as exact decimals (Prisma.Decimal) end to end. JavaScript numbers cannot
 * represent most paise values exactly, so sums and balances drift when added repeatedly.
 */
export type Money = Prisma.Decimal;
export type MoneyInput = Prisma.Decimal.Value;

export function money(value: MoneyInput | null | undefined): Money {
  return new Prisma.Decimal(value ?? 0);
}

/** Converts an integer amount in paise (as payment gateways report it) to rupees. */
export function fromPaise(paise: number | string): Money {
  return new Prisma.Decimal(paise).dividedBy(100);
}

/** Converts rupees to integer paise, rejecting fractions of a paisa. */
export function toPaise(amount: MoneyInput): number {
  const paise = new Prisma.Decimal(amount).times(100);
  if (!paise.isInteger()) {
    throw new Error(`Amount ${amount} has more than two decimal places`);
  }
  return paise.toNumber();
}

/** For API responses and events, which carry plain numbers rounded to paise. */
export function toRupees(value: MoneyInput): number {
  return new Prisma.Decimal(value).toDecimalPlaces(2).toNumber();
}

/** Request validation for a rupee amount: positive, whole paise, below a sanity ceiling. */
export const rupeeAmount = (message = 'Amount must be greater than zero') =>
  z
    .number()
    .positive(message)
    .max(100_000_000, 'Amount is too large')
    .refine((v) => new Prisma.Decimal(v).decimalPlaces() <= 2, 'Amount cannot have more than two decimal places');
