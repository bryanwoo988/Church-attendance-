import type { Household } from './types';

/**
 * Who to check in when the door scanner scans a family member, if the family already said who is
 * coming today. Null when there is no list for today (the scanner then picks from the whole family).
 */
export function todaysAttendees(today: Household['today'], date: string, familyIds: string[], scannedId: string): string[] | null {
  if (!today || today.date !== date) return null;
  const listed = today.personIds.filter((id) => familyIds.includes(id));
  if (listed.length === 0) return null;
  return [scannedId, ...listed.filter((id) => id !== scannedId)];
}
