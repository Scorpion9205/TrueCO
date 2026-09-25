// Rupee amounts in words for receipts, in the Indian system (thousand, lakh, crore)

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0–99 */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[Math.floor(n / 10)]!;
}

/** 0–999 */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? twoDigits(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** Whole number in words: 1,25,500 -> "One Lakh Twenty-Five Thousand Five Hundred" */
export function numberInWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${numberInWords(crore)} Crore` : '',
    lakh ? `${twoDigits(lakh)} Lakh` : '',
    thousand ? `${twoDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 25500.5 -> "Rupees Twenty-Five Thousand Five Hundred and Fifty Paise Only" */
export function rupeesInWords(amount: number): string {
  const paiseTotal = Math.round(amount * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const words = `Rupees ${numberInWords(rupees)}`;
  return paise ? `${words} and ${twoDigits(paise)} Paise Only` : `${words} Only`;
}
