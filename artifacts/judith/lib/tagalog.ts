/**
 * Display + voice normalization helpers.
 *
 * Tagalog copy always renders amounts, weekdays, and dates in English. These
 * helpers produce both the on-screen display (₱3,450) and the spoken English
 * forms ("three thousand four hundred fifty pesos").
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];
const SCALES: [number, string][] = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function underHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r === 0 ? TENS[t]! : `${TENS[t]}-${ONES[r]}`;
}

function underThousand(n: number): string {
  if (n < 100) return underHundred(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred ${underHundred(r)}`;
}

export function intToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return `negative ${intToWords(-n)}`;
  const parts: string[] = [];
  let remaining = n;
  for (const [value, name] of SCALES) {
    if (remaining >= value) {
      parts.push(`${underThousand(Math.floor(remaining / value))} ${name}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(underThousand(remaining));
  return parts.join(" ");
}

/** Spoken English amount, e.g. "three thousand four hundred fifty pesos". */
export function amountToWords(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "an unknown amount";
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  let s = `${intToWords(pesos)} ${pesos === 1 ? "peso" : "pesos"}`;
  if (centavos > 0) {
    s += ` and ${intToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  }
  return s;
}

/** On-screen peso display, e.g. "₱3,450". */
export function pesoDisplay(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "₱—";
  return `₱${Math.round(amount).toLocaleString("en-US")}`;
}

export function englishDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function englishWeekday(d: Date): string {
  return WEEKDAYS[d.getDay()]!;
}

/** Short Tagalog urgency phrase, with the count in English digits. */
export function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} araw overdue`;
  if (days === 0) return "Due ngayon";
  if (days === 1) return "Due bukas";
  return `Due in ${days} araw`;
}
