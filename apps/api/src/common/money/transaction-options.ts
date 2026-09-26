/**
 * Payment transactions lock a row (an instalment, an order, a numbering counter) and so run one
 * after another when several arrive together: webhook retries, a double-clicked "Pay", paired
 * gateway events. Prisma's defaults (2 s to start, 5 s to finish) would turn a short queue on a
 * busy or small server into failed payments; these allow for it while still ending a stuck one.
 */
export const MONEY_TRANSACTION = { maxWait: 15_000, timeout: 30_000 } as const;
