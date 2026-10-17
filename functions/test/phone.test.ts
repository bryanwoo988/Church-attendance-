import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db } from './helpers';

const NEW = '+60177654321';

beforeEach(async () => {
  await clearDb();
  await db.doc('users/u1').set({ personId: 'p1', householdId: 'h1', roles: ['admin'] });
  await db.doc('households/h1').set({ ownerUid: 'u1' });
  await db.doc('people/p1').set({ name: 'Bryan', phone: '+60123456789', accountUid: 'u1', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 1, firstVisitDate: '2026-10-01' });
});

describe('syncMyPhone', () => {
  it('stores the verified phone from the sign-in token on my person', async () => {
    const r = await callFn('syncMyPhone', {}, { uid: 'u1', phone: NEW });
    expect(r).toMatchObject({ ok: true, data: { phone: NEW } });
    expect((await db.doc('people/p1').get()).get('phone')).toBe(NEW);
    expect((await db.doc('users/u1').get()).get('roles')).toEqual(['admin']);
  });

  it('merges an earlier newcomer record with the same phone into me', async () => {
    await db.doc('people/v1').set({ name: 'Bryan (visitor)', phone: NEW, householdId: 'h9', kind: 'adult', status: 'visitor', active: true, visitCount: 2, firstVisitDate: '2026-09-01' });
    await db.doc('attendance/m1_v1').set({ meetingId: 'm1', personId: 'v1', date: '2026-09-01', method: 'visitorForm' });
    const r = await callFn<any>('syncMyPhone', {}, { uid: 'u1', phone: NEW });
    expect(r.ok && r.data.merged).toBe(1);
    expect((await db.doc('attendance/m1_p1').get()).exists).toBe(true);
    expect((await db.doc('people/v1').get()).data()).toMatchObject({ active: false, mergedInto: 'p1' });
    expect((await db.doc('people/p1').get()).data()).toMatchObject({ phone: NEW, visitCount: 3, firstVisitDate: '2026-09-01' });
  });

  it('refuses when another account already owns the phone', async () => {
    await db.doc('people/p2').set({ name: 'Other', phone: NEW, accountUid: 'u2', householdId: 'h2', kind: 'adult', status: 'member', active: true, visitCount: 0 });
    expect(await callFn('syncMyPhone', {}, { uid: 'u1', phone: NEW })).toMatchObject({ ok: false, status: 'FAILED_PRECONDITION', message: 'phone.inUse' });
    expect((await db.doc('people/p1').get()).get('phone')).toBe('+60123456789');
  });

  it('requires a phone on the sign-in token', async () => {
    expect(await callFn('syncMyPhone', {}, { uid: 'u1' })).toMatchObject({ ok: false, status: 'FAILED_PRECONDITION' });
  });
});
