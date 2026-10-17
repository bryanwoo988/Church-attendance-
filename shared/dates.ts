const klFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date in Malaysia (UTC+8), formatted YYYY-MM-DD. */
export function klDate(d: Date): string {
  return klFmt.format(d);
}

const klTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Wall-clock time in Malaysia, formatted HH:mm. */
export function klTime(d: Date): string {
  return klTimeFmt.format(d);
}

/** The instant at which `HH:mm` on KL date `date` occurs. */
export function klDateTime(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+08:00`);
}

/** Whole days between two KL dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
