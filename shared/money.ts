export type AmountResult = { ok: true; sen: number } | { ok: false; error: 'invalid' | 'zero' | 'tooLarge' };

export const MAX_SEN = 10_000_000; // RM 100,000.00

const AMOUNT = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/** Parse user-typed ringgit into integer sen without float arithmetic. */
export function parseAmountToSen(input: string): AmountResult {
  const s = input.trim().replace(/^rm\s*/i, '').trim();
  if (!AMOUNT.test(s)) return { ok: false, error: 'invalid' };
  const [whole, frac = ''] = s.replace(/,/g, '').split('.');
  const sen = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(sen)) return { ok: false, error: 'tooLarge' };
  if (sen === 0) return { ok: false, error: 'zero' };
  if (sen > MAX_SEN) return { ok: false, error: 'tooLarge' };
  return { ok: true, sen };
}

export function formatSen(sen: number): string {
  const whole = Math.floor(sen / 100).toLocaleString('en-US');
  const frac = String(sen % 100).padStart(2, '0');
  return `RM ${whole}.${frac}`;
}

export function senToRinggit(sen: number): number {
  return sen / 100;
}
