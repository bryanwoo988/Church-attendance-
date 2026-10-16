import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { personFrom, meetingFrom, offeringFrom, attendanceFrom, groupFrom } from './data';
import type { Attendance, ChurchSettings, Group, Meeting, Offering, Person, PersonKind, PersonStatus, Role } from '../shared/types';
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

export async function addOffering(o: { uid: string; personId: string; householdId: string; amountSen: number; category: string; date: string }): Promise<string> {
  const ref = await addDoc(collection(db, 'offerings'), { ...o, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateOwnOffering(id: string, amountSen: number, category: string) {
  await updateDoc(doc(db, 'offerings', id), { amountSen, category, updatedAt: serverTimestamp() });
}

export async function deleteOwnOffering(id: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'offerings', id));
}

export function useUsers(): (UserDocLite & { uid: string })[] | undefined {
  return useLive('users', [], (s: any) => ({ uid: s.id, ...(s.data() as UserDocLite) }), []);
}
type UserDocLite = { personId: string; householdId: string; roles: Role[] };

export async function setRoles(uid: string, roles: Role[]) {
  await updateDoc(doc(db, 'users', uid), { roles });
}

export async function updatePerson(id: string, patch: Partial<Pick<Person, 'name' | 'kind' | 'status' | 'phone' | 'active'>>) {
  await updateDoc(doc(db, 'people', id), patch);
}

/** Admin: create someone ahead of their first login. When they log in with this phone, ensureProfile attaches. */
export async function adminCreatePerson(p: { name: string; phone?: string; kind: PersonKind; status: PersonStatus; householdId?: string }): Promise<string> {
  const { setDoc } = await import('firebase/firestore');
  let householdId = p.householdId;
  if (!householdId) {
    const h = doc(collection(db, 'households'));
    await setDoc(h, { createdAt: serverTimestamp() });
    householdId = h.id;
  }
  const ref = await addDoc(collection(db, 'people'), {
    name: p.name, kind: p.kind, status: p.status, householdId, active: true, visitCount: 0, createdAt: serverTimestamp(),
    ...(p.phone ? { phone: p.phone } : {}),
  });
  return ref.id;
}

export async function createMeeting(m: Omit<Meeting, 'id' | 'createdAt'>): Promise<string> {
  const clean = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
  const ref = await addDoc(collection(db, 'meetings'), { ...clean, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteMeeting(id: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'meetings', id));
}

export async function saveSettings(patch: Partial<ChurchSettings>) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'settings', 'church'), patch, { merge: true });
}

export async function createGroup(name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'groups'), { name, leaderUids: [], memberPersonIds: [] });
  return ref.id;
}

export async function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'leaderUids' | 'memberPersonIds'>>) {
  await updateDoc(doc(db, 'groups', id), patch);
}

export async function fetchExportData(from: string, to: string) {
  const { getDocs } = await import('firebase/firestore');
  const range = (col: string) => getDocs(query(collection(db, col), where('date', '>=', from), where('date', '<=', to)));
  const [people, groups, meetings, attendance, offerings] = await Promise.all([
    getDocs(collection(db, 'people')),
    getDocs(collection(db, 'groups')),
    range('meetings'),
    range('attendance'),
    range('offerings'),
  ]);
  return {
    people: people.docs.map(personFrom),
    groups: groups.docs.map(groupFrom),
    meetings: meetings.docs.map(meetingFrom),
    attendance: attendance.docs.map(attendanceFrom),
    offerings: offerings.docs.map(offeringFrom),
  };
}

export function useOfferingsBetween(from: string, to: string): Offering[] | undefined {
  return useLive('offerings', [where('date', '>=', from), where('date', '<=', to), orderBy('date', 'desc')], offeringFrom, [from, to]);
}

export function useGroupMeetings(groupId: string | undefined, from: string, to: string): Meeting[] | undefined {
  return useLive(
    groupId ? 'meetings' : null,
    groupId ? [where('groupId', '==', groupId), where('date', '>=', from), where('date', '<=', to)] : [],
    meetingFrom,
    [groupId, from, to],
  );
}

/** Attendance for up to 30 meetings at a time (Firestore 'in' limit), merged. */
export function useAttendanceForMeetings(meetingIds: string[]): Attendance[] | undefined {
  const [rows, setRows] = useState<Attendance[]>();
  const key = meetingIds.join(',');
  useEffect(() => {
    if (meetingIds.length === 0) {
      setRows([]);
      return;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < meetingIds.length; i += 30) chunks.push(meetingIds.slice(i, i + 30));
    const parts: Attendance[][] = chunks.map(() => []);
    const loaded = new Set<number>();
    setRows(undefined);
    const unsubs = chunks.map((ids, i) =>
      onSnapshot(
        query(collection(db, 'attendance'), where('meetingId', 'in', ids)),
        (snap) => {
          parts[i] = snap.docs.map(attendanceFrom);
          loaded.add(i);
          if (loaded.size === chunks.length) setRows(parts.flat());
        },
        () => setRows([]),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}
