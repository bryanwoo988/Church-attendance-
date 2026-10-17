import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Meeting, Person, Offering, Attendance, Group } from '../shared/types';

type Snap = DocumentSnapshot | QueryDocumentSnapshot;
const toDate = (v: any): Date | undefined => (v && typeof v.toDate === 'function' ? v.toDate() : v instanceof Date ? v : undefined);

export function personFrom(s: Snap): Person {
  const d = s.data()!;
  return { ...(d as any), id: s.id, createdAt: toDate(d.createdAt) ?? new Date(0), pdpaConsentAt: toDate(d.pdpaConsentAt), visitCount: d.visitCount ?? 0, active: d.active !== false };
}

export function meetingFrom(s: Snap): Meeting {
  const d = s.data()!;
  return { ...(d as any), id: s.id, windowStart: toDate(d.windowStart), windowEnd: toDate(d.windowEnd), createdAt: toDate(d.createdAt) };
}

export function offeringFrom(s: Snap): Offering {
  const d = s.data()!;
  return { ...(d as any), id: s.id, createdAt: toDate(d.createdAt) ?? new Date(), updatedAt: toDate(d.updatedAt) };
}

export function attendanceFrom(s: Snap): Attendance {
  const d = s.data()!;
  return { ...(d as any), at: toDate(d.at) ?? new Date() };
}

export function groupFrom(s: Snap): Group {
  const d = s.data()!;
  return { id: s.id, name: d.name, leaderUids: d.leaderUids ?? [], memberPersonIds: d.memberPersonIds ?? [] };
}

/** Map a callable error to its message key when it is one of ours (e.g. 'checkin.closed'). */
export function errorKey(e: unknown): string | null {
  // The Firebase SDK appends the HTTP status, e.g. "checkin.closed [400]".
  const m = (e as { message?: string })?.message?.replace(/\s*\[\d{3}\]$/, '');
  return m && /^[a-z]+\.[A-Za-z]+$/.test(m) ? m : null;
}
