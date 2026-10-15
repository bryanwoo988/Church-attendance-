import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db } from './helpers';
import { klDate } from '../../shared/dates';

const today = klDate(new Date());
const lastWeek = klDate(new Date(Date.now() - 7 * 86_400_000));
const form = (over: object = {}) => ({ name: 'New Friend', phone: '012-345 6789', contactConsent: true, pdpaConsent: true, ...over });

beforeEach(async () => {
  await clearDb();
  await db.doc(`meetings/sunday-${today}`).set({ type: 'sunday', title: '主日', date: today, checkinMode: 'always' });
});

describe('submitVisitorForm', () => {
  it('first visit creates a visitor and records attendance', async () => {
    const r = await callFn<any>('submitVisitorForm', form());
    if (!r.ok) throw new Error(r.message);
    expect(r.data).toMatchObject({ visitNumber: 1, checkedIn: true });
    const p = (await db.doc(`people/${r.data.personId}`).get()).data()!;
    expect(p).toMatchObject({ phone: '+60123456789', status: 'visitor', visitCount: 1, firstVisitDate: today, lastVisitDate: today, contactConsent: true });
    expect((await db.doc(`attendance/sunday-${today}_${r.data.personId}`).get()).data()).toMatchObject({ method: 'visitorForm' });
  });

  it('second submit on the same day does not count twice', async () => {
    const a = await callFn<any>('submitVisitorForm', form());
    const b = await callFn<any>('submitVisitorForm', form());
    expect(b.ok && b.data.visitNumber).toBe(1);
    expect(a.ok && b.ok && a.data.personId === b.data.personId).toBe(true);
    expect((await db.collection('attendance').get()).size).toBe(1);
  });

  it('a visit next week counts as visit 2', async () => {
    await db.doc('households/h1').set({ createdAt: new Date() });
    await db.doc('people/p1').set({ name: 'X', phone: '+60123456789', householdId: 'h1', kind: 'adult', status: 'visitor', active: true, visitCount: 1, firstVisitDate: lastWeek, lastVisitDate: lastWeek });
    const r = await callFn<any>('submitVisitorForm', form());
    expect(r.ok && r.data).toMatchObject({ personId: 'p1', visitNumber: 2 });
  });

  it('records family members as people in the same household', async () => {
    const r = await callFn<any>('submitVisitorForm', form({ familyNames: ['Kid A', ' '] }));
    if (!r.ok) throw new Error(r.message);
    const ppl = await db.collection('people').get();
    expect(ppl.size).toBe(2);
    expect((await db.collection('attendance').get()).size).toBe(2);
  });

  it('reports checkedIn false when no meeting is open', async () => {
    await db.doc(`meetings/sunday-${today}`).delete();
    const r = await callFn<any>('submitVisitorForm', form());
    expect(r.ok && r.data.checkedIn).toBe(false);
  });

  it('rejects without PDPA consent', async () => {
    expect(await callFn('submitVisitorForm', form({ pdpaConsent: false }))).toMatchObject({ ok: false, status: 'INVALID_ARGUMENT' });
  });

  it('rejects an invalid phone', async () => {
    expect(await callFn('submitVisitorForm', form({ phone: '12345' }))).toMatchObject({ ok: false, status: 'INVALID_ARGUMENT' });
  });

  it('rate-limits the 6th submit of the day', async () => {
    for (let i = 0; i < 5; i++) await callFn('submitVisitorForm', form());
    expect(await callFn('submitVisitorForm', form())).toMatchObject({ ok: false, status: 'RESOURCE_EXHAUSTED' });
  });
});

describe('submitVisitorForm hardening', () => {
  it('does not alter an existing member: no new family, consent untouched', async () => {
    await db.doc('households/h1').set({ ownerUid: 'u1' });
    await db.doc('people/p1').set({ name: 'Member', phone: '+60123456789', accountUid: 'u1', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0, contactConsent: false });
    const r = await callFn<any>('submitVisitorForm', form({ familyNames: ['Fake 1', 'Fake 2'], contactConsent: true }));
    expect(r.ok).toBe(true);
    expect((await db.collection('people').get()).size).toBe(1);
    expect((await db.doc('people/p1').get()).get('contactConsent')).toBe(false);
  });

  it('does not overwrite an existing scanner attendance', async () => {
    await db.doc('households/h1').set({});
    await db.doc('people/p1').set({ name: 'V', phone: '+60123456789', householdId: 'h1', kind: 'adult', status: 'visitor', active: true, visitCount: 1, lastVisitDate: lastWeek });
    await db.doc(`attendance/sunday-${today}_p1`).set({ meetingId: `sunday-${today}`, personId: 'p1', date: today, method: 'scanner', byUid: 'u_scan' });
    await callFn('submitVisitorForm', form());
    expect((await db.doc(`attendance/sunday-${today}_p1`).get()).data()).toMatchObject({ method: 'scanner', byUid: 'u_scan' });
  });

  it('does not store the phone number in rate-limit document ids', async () => {
    await callFn('submitVisitorForm', form());
    const ids = (await db.collection('rateLimits').get()).docs.map((d) => d.id);
    expect(ids.length).toBe(1);
    expect(ids[0]).not.toContain('60123456789');
  });
});
