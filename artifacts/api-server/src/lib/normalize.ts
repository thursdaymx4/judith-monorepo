/**
 * Number/date normalization for Judith's voice output.
 *
 * Tagalog copy must always render the amount, the day of week, and the date in
 * English. These helpers produce the canonical English forms that are embedded
 * in the bill context so the model reuses them verbatim.
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
  return r === 0
    ? `${ONES[h]} hundred`
    : `${ONES[h]} hundred ${underHundred(r)}`;
}

export function intToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return `negative ${intToWords(-n)}`;
  const parts: string[] = [];
  let remaining = n;
  for (const [value, name] of SCALES) {
    if (remaining >= value) {
      const count = Math.floor(remaining / value);
      parts.push(`${underThousand(count)} ${name}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(underThousand(remaining));
  return parts.join(" ");
}

/** "three thousand four hundred fifty pesos" */
export function amountToWords(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "an unknown amount";
  }
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  let s = `${intToWords(pesos)} ${pesos === 1 ? "peso" : "pesos"}`;
  if (centavos > 0) {
    s += ` and ${intToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  }
  return s;
}

export function englishDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function englishWeekday(d: Date): string {
  return WEEKDAYS[d.getDay()]!;
}
