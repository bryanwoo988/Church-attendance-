import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db, Timestamp } from './helpers';
import { klDate } from '../../shared/dates';

const today = klDate(new Date());
const MEM = { uid: 'u_mem', phone: '+60123456789' };

beforeEach(async () => {
  await clearDb();
  await db.doc('users/u_mem').set({ personId: 'p_mem', householdId: 'h1', roles: [] });
  await db.doc('users/u_admin').set({ personId: 'p_admin', householdId: 'h9', roles: ['admin'] });
  await db.doc('people/p_mem').set({ name: 'Mem', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0 });
  await db.doc('people/p_kid').set({ name: 'Kid', householdId: 'h1', kind: 'child', status: 'member', active: true, visitCount: 0 });
  await db.doc('people/p_other').set({ name: 'Other', householdId: 'h2', kind: 'adult', status: 'member', active: true, visitCount: 0 });
  await db.doc(`meetings/sunday-${today}`).set({ type: 'sunday', title: '主日', date: today, checkinMode: 'always' });
});

describe('selfCheckIn', () => {
  it('checks in self and child', async () => {
    const r = await callFn<any>('selfCheckIn', { personIds: ['p_mem', 'p_kid'] }, MEM);
    if (!r.ok) throw new Error(r.message);
    expect(r.data.meetingId).toBe(`sunday-${today}`);
    expect(r.data.results).toEqual([{ personId: 'p_mem', status: 'ok' }, { personId: 'p_kid', status: 'ok' }]);
    expect((await db.doc(`attendance/sunday-${today}_p_kid`).get()).data()).toMatchObject({ method: 'self', byUid: 'u_mem' });
  });

  it('repeat check-in reports already', async () => {
    await callFn('selfCheckIn', { personIds: ['p_mem', 'p_kid'] }, MEM);
    const r = await callFn<any>('selfCheckIn', { personIds: ['p_mem', 'p_kid'] }, MEM);
    expect(r.ok && r.data.results.map((x: any) => x.status)).toEqual(['already', 'already']);
    expect((await db.collection('attendance').get()).size).toBe(2);
  });

  it('already returns the original check-in time', async () => {
    await callFn('selfCheckIn', { personIds: ['p_mem'] }, MEM);
    const first = (await db.doc(`attendance/sunday-${today}_p_mem`).get()).get('at').toDate().toISOString();
    const r = await callFn<any>('selfCheckIn', { personIds: ['p_mem'] }, MEM);
    expect(r.ok && r.data.results[0]).toEqual({ personId: 'p_mem', status: 'already', at: first });
  });

  it('refuses a person from another household and writes nothing', async () => {
    const r = await callFn('selfCheckIn', { personIds: ['p_mem', 'p_other'] }, MEM);
    expect(r).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
    expect((await db.collection('attendance').get()).size).toBe(0);
  });

  it('refuses a closed window meeting', async () => {
    await db.doc('meetings/g1').set({
      type: 'group', title: 'G', date: today, checkinMode: 'window',
      windowStart: Timestamp.fromMillis(Date.now() - 3 * 3600_000), windowEnd: Timestamp.fromMillis(Date.now() - 2 * 3600_000),
    });
    const r = await callFn('selfCheckIn', { meetingId: 'g1', personIds: ['p_mem'] }, MEM);
    expect(r).toMatchObject({ ok: false, status: 'FAILED_PRECONDITION', message: 'checkin.closed' });
  });

  it('reports no meeting today', async () => {
    await db.doc(`meetings/sunday-${today}`).delete();
    const r = await callFn('selfCheckIn', { personIds: ['p_mem'] }, MEM);
    expect(r).toMatchObject({ ok: false, status: 'FAILED_PRECONDITION', message: 'checkin.noMeeting' });
  });

  it('requires sign-in', async () => {
    expect(await callFn('selfCheckIn', { personIds: ['p_mem'] })).toMatchObject({ ok: false, status: 'UNAUTHENTICATED' });
  });
});

describe('createSundayNow', () => {
  it('is idempotent and admin-only', async () => {
    await db.doc('settings/church').set({ sunday: { weekday: 0, start: '09:00', end: '11:30', checkinMode: 'window' }, offeringCategories: ['x'] });
    const a = await callFn<any>('createSundayNow', {}, { uid: 'u_admin' });
    const b = await callFn<any>('createSundayNow', {}, { uid: 'u_admin' });
    expect(a.ok && b.ok && a.data.meetingId === b.data.meetingId).toBe(true);
    const sundays = await db.collection('meetings').where('type', '==', 'sunday').get();
    expect(sundays.docs.filter((d) => d.id === (a.ok ? a.data.meetingId : '')).length).toBe(1);
    expect(await callFn('createSundayNow', {}, MEM)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
  });
});
