import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import type { Meeting } from '../../../shared/types';

if (!getApps().length) initializeApp();
export const db = getFirestore();
export { Timestamp, FieldValue };

export const REGION = 'asia-southeast1';
export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

export function toMeeting(snap: DocumentSnapshot): Meeting {
  const d = snap.data()!;
  return {
    id: snap.id,
    type: d.type,
    title: d.title,
    date: d.date,
    groupId: d.groupId,
    checkinMode: d.checkinMode,
    windowStart: d.windowStart?.toDate?.(),
    windowEnd: d.windowEnd?.toDate?.(),
  };
}

export async function meetingsOn(date: string): Promise<Meeting[]> {
  const snap = await db.collection('meetings').where('date', '==', date).get();
  return snap.docs.map(toMeeting);
}
