/** Drops spaces, dashes and brackets people type in phone numbers: "98765 43210" -> "9876543210" */
export function normalisePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

/** 10–15 digits, optional leading +, no leading zero (the API's own phone rule) */
export const PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(normalisePhone(phone));
}

/**
 * wa.me link for a number. WhatsApp needs the country code, so a bare 10-digit number is taken
 * as Indian (+91); a leading 0 (trunk prefix) is dropped first.
 */
export function whatsappLink(phone: string): string {
  let digits = normalisePhone(phone).replace(/^\+/, '');
  if (/^0\d{10}$/.test(digits)) digits = digits.slice(1);
  if (/^\d{10}$/.test(digits)) digits = `91${digits}`;
  return `https://wa.me/${digits}`;
}
