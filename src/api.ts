import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { personFrom, meetingFrom, offeringFrom, attendanceFrom, groupFrom } from './data';
import type { Attendance, ChurchSettings, Group, Meeting, Offering, Person, PersonKind, PersonStatus } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';

/** Live query helper. Returns undefined while loading. */
function useLive<T>(path: string | null, constraints: QueryConstraint[], map: (s: any) => T, deps: unknown[]): T[] | undefined {
  const [rows, setRows] = useState<T[]>();
  useEffect(() => {
    if (!path) return;
    setRows(undefined);
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (snap) => setRows(snap.docs.map(map)),
      () => setRows([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return rows;
}

export function useHousehold(householdId: string | undefined): Person[] | undefined {
  const rows = useLive(householdId ? 'people' : null, householdId ? [where('householdId', '==', householdId)] : [], personFrom, [householdId]);
  return rows?.filter((p) => p.active);
}

export function usePeople(): Person[] | undefined {
  return useLive('people', [], personFrom, []);
}

export function useMeetingsOn(date: string): Meeting[] | undefined {
  return useLive('meetings', [where('date', '==', date)], meetingFrom, [date]);
}

export function useMeetingsBetween(from: string, to: string): Meeting[] | undefined {
  return useLive('meetings', [where('date', '>=', from), where('date', '<=', to), orderBy('date', 'desc')], meetingFrom, [from, to]);
}

export function useGroups(): Group[] | undefined {
  return useLive('groups', [], groupFrom, []);
}

export function useHouseholdAttendance(personIds: string[]): Attendance[] | undefined {
  const key = personIds.slice(0, 30).join(',');
  return useLive(
    personIds.length ? 'attendance' : null,
    personIds.length ? [where('personId', 'in', personIds.slice(0, 30)), orderBy('at', 'desc'), limit(20)] : [],
    attendanceFrom,
    [key],
  );
}

export function useMyOfferings(uid: string | undefined): Offering[] | undefined {
  return useLive(uid ? 'offerings' : null, uid ? [where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(50)] : [], offeringFrom, [uid]);
}

export function useSettings(): ChurchSettings | undefined {
  const [s, setS] = useState<ChurchSettings>();
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'church'),
        (snap) => setS({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ChurchSettings> | undefined) }),
        () => setS(DEFAULT_SETTINGS),
      ),
    [],
  );
  return s;
}

export async function addFamilyMember(p: { householdId: string; name: string; kind: PersonKind; status: PersonStatus }): Promise<string> {
  const ref = await addDoc(collection(db, 'people'), { ...p, active: true, visitCount: 0, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateFamilyMember(id: string, patch: { name?: string; kind?: PersonKind; active?: boolean }) {
  await updateDoc(doc(db, 'people', id), patch);
}

export async function fetchPersonWithFamily(personId: string): Promise<{ person: Person; family: Person[] } | null> {
  const { getDoc, getDocs } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'people', personId));
  if (!snap.exists()) return null;
  const person = personFrom(snap);
  if (!person.active) return null;
  const fam = await getDocs(query(collection(db, 'people'), where('householdId', '==', person.householdId)));
  return { person, family: fam.docs.map(personFrom).filter((p) => p.active) };
}
