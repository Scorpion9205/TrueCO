import crypto from 'node:crypto';

const MAX_BASE = 40;
const SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)

/**
 * The readable part of an institute code, from its name: "Shārma Classes, Jaipur!" ->
 * "sharma-classes-jaipur". Accents are dropped, anything else becomes a single dash.
 */
export function coachingCodeBase(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : 'institute';
}

/** "sharma-classes" -> "sharma-classes-k7m2": a variant for when the plain code is taken */
export function withSuffix(base: string): string {
  const bytes = crypto.randomBytes(4);
  const suffix = Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('');
  return `${base}-${suffix}`;
}

/**
 * A code no other institute has: the name itself when free, otherwise the name plus a short
 * random suffix. Teachers type it only when their email is registered at more than one institute.
 */
export async function generateCoachingCode(
  name: string,
  isTaken: (code: string) => Promise<boolean>,
): Promise<string> {
  const base = coachingCodeBase(name);
  if (!(await isTaken(base))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = withSuffix(base);
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Could not find a free institute code');
}
