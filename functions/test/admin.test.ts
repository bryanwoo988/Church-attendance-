import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db } from './helpers';

const ADMIN = { uid: 'u_admin' };
const FIN = { uid: 'u_fin' };
const SCAN = { uid: 'u_scan' };
const MEM = { uid: 'u_mem' };

beforeEach(async () => {
  await clearDb();
  await db.doc('users/u_admin').set({ personId: 'p_admin', householdId: 'h9', roles: ['admin'] });
  await db.doc('users/u_fin').set({ personId: 'p_fin', householdId: 'h8', roles: ['finance'] });
  await db.doc('users/u_scan').set({ personId: 'p_scan', householdId: 'h7', roles: ['scanner'] });
  await db.doc('users/u_mem').set({ personId: 'p_mem', householdId: 'h1', roles: [] });
  await db.doc('households/h1').set({ ownerUid: 'u_mem' });
  await db.doc('people/p_mem').set({ name: 'Mem', householdId: 'h1', kind: 'adult', status: 'member', accountUid: 'u_mem', active: true, visitCount: 3, firstVisitDate: '2026-05-01' });
  await db.doc('people/p_kid').set({ name: 'Kid', householdId: 'h1', kind: 'child', status: 'member', active: true, visitCount: 2, firstVisitDate: '2026-03-01' });
  await db.doc('people/p_new').set({ name: 'Kid grown', householdId: 'h5', kind: 'adult', status: 'member', accountUid: 'u_new', active: true, visitCount: 1, firstVisitDate: '2026-10-01' });
  for (const m of ['m1', 'm2', 'm3']) await db.doc(`attendance/${m}_p_kid`).set({ meetingId: m, personId: 'p_kid', date: '2026-10-01', method: 'scanner' });
  await db.doc('attendance/m1_p_new').set({ meetingId: 'm1', personId: 'p_new', date: '2026-10-01', method: 'self' });
  await db.doc('attendance/m1_p_mem').set({ meetingId: 'm1', personId: 'p_mem', date: '2026-10-01', method: 'self' });
  await db.doc('offerings/o1').set({ uid: 'u_mem', personId: 'p_mem', householdId: 'h1', date: '2026-10-01', amountSen: 5000, category: 'x', createdAt: new Date() });
});

describe('mergePeople', () => {
  it('moves attendance and keeps one record per meeting', async () => {
    const r = await callFn<any>('mergePeople', { fromPersonId: 'p_kid', intoPersonId: 'p_new' }, ADMIN);
    if (!r.ok) throw new Error(r.message);
    expect(r.data.movedAttendance).toBe(2);
    const ids = (await db.collection('attendance').where('personId', '==', 'p_new').get()).docs.map((d) => d.id).sort();
    expect(ids).toEqual(['m1_p_new', 'm2_p_new', 'm3_p_new']);
    expect((await db.collection('attendance').where('personId', '==', 'p_kid').get()).size).toBe(0);
    expect((await db.doc('people/p_kid').get()).data()).toMatchObject({ active: false, mergedInto: 'p_new' });
    expect((await db.doc('people/p_new').get()).data()).toMatchObject({ visitCount: 3, firstVisitDate: '2026-03-01' });
  });
  it('is admin only', async () => {
    expect(await callFn('mergePeople', { fromPersonId: 'p_kid', intoPersonId: 'p_new' }, FIN)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
  });
  it('refuses to merge two account holders', async () => {
    expect(await callFn('mergePeople', { fromPersonId: 'p_mem', intoPersonId: 'p_new' }, ADMIN)).toMatchObject({ ok: false, status: 'FAILED_PRECONDITION' });
  });
  it('refuses to merge a person into itself', async () => {
    expect(await callFn('mergePeople', { fromPersonId: 'p_kid', intoPersonId: 'p_kid' }, ADMIN)).toMatchObject({ ok: false, status: 'INVALID_ARGUMENT' });
  });
});

describe('financeEditOffering', () => {
  it('edits amount and writes history', async () => {
    const r = await callFn('financeEditOffering', { offeringId: 'o1', amountSen: 6000 }, FIN);
    expect(r.ok).toBe(true);
    expect((await db.doc('offerings/o1').get()).get('amountSen')).toBe(6000);
    const hist = await db.collection('offerings/o1/history').get();
    expect(hist.docs[0].data()).toMatchObject({ byUid: 'u_fin', oldAmountSen: 5000, newAmountSen: 6000, deleted: false });
  });
  it('deletes and records history', async () => {
    await callFn('financeEditOffering', { offeringId: 'o1', delete: true }, FIN);
    expect((await db.doc('offerings/o1').get()).exists).toBe(false);
    expect((await db.collection('offerings/o1/history').get()).docs[0].get('deleted')).toBe(true);
  });
  it('rejects an invalid amount', async () => {
    expect(await callFn('financeEditOffering', { offeringId: 'o1', amountSen: 0 }, FIN)).toMatchObject({ ok: false, status: 'INVALID_ARGUMENT' });
  });
  it('scanner cannot edit', async () => {
    expect(await callFn('financeEditOffering', { offeringId: 'o1', amountSen: 6000 }, SCAN)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
  });
});

describe('deleteMyData', () => {
  it('requires typed confirmation', async () => {
    expect(await callFn('deleteMyData', {}, MEM)).toMatchObject({ ok: false, status: 'INVALID_ARGUMENT' });
  });
  it('removes the household data and anonymizes offerings', async () => {
    const r = await callFn('deleteMyData', { confirm: 'DELETE' }, MEM);
    expect(r.ok).toBe(true);
    expect((await db.doc('people/p_mem').get()).exists).toBe(false);
    expect((await db.doc('people/p_kid').get()).exists).toBe(false);
    expect((await db.doc('users/u_mem').get()).exists).toBe(false);
    expect((await db.doc('households/h1').get()).exists).toBe(false);
    expect((await db.collection('attendance').where('personId', 'in', ['p_mem', 'p_kid']).get()).size).toBe(0);
    expect((await db.doc('offerings/o1').get()).data()).toMatchObject({ uid: 'deleted', personId: 'deleted', householdId: 'deleted', amountSen: 5000 });
  });
});

describe('deletePersonData', () => {
  it('admin deletes one person and their attendance', async () => {
    const r = await callFn('deletePersonData', { personId: 'p_kid' }, ADMIN);
    expect(r.ok).toBe(true);
    expect((await db.doc('people/p_kid').get()).exists).toBe(false);
    expect((await db.collection('attendance').where('personId', '==', 'p_kid').get()).size).toBe(0);
  });
  it('is admin only', async () => {
    expect(await callFn('deletePersonData', { personId: 'p_kid' }, FIN)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
  });
});

describe('deleteMyData with two accounts in one household', () => {
  it('keeps the other account holder and their household intact', async () => {
    await db.doc('people/p_spouse').set({ name: 'Spouse', householdId: 'h1', kind: 'adult', status: 'member', accountUid: 'u_sp', active: true, visitCount: 0 });
    await db.doc('users/u_sp').set({ personId: 'p_spouse', householdId: 'h1', roles: [] });
    await db.doc('offerings/o_sp').set({ uid: 'u_sp', personId: 'p_spouse', householdId: 'h1', date: '2026-10-01', amountSen: 100, category: 'x', createdAt: new Date() });
    const r = await callFn('deleteMyData', { confirm: 'DELETE' }, MEM);
    expect(r.ok).toBe(true);
    expect((await db.doc('people/p_mem').get()).exists).toBe(false);
    expect((await db.doc('people/p_spouse').get()).exists).toBe(true);
    expect((await db.doc('people/p_kid').get()).exists).toBe(true);
    expect((await db.doc('households/h1').get()).exists).toBe(true);
    expect((await db.doc('offerings/o_sp').get()).get('uid')).toBe('u_sp');
  });
});

describe('mergePeople keeps the phone', () => {
  it('copies phone and consent to the target when it has none', async () => {
    await db.doc('people/p_vis').set({ name: 'Vis', householdId: 'h3', kind: 'adult', status: 'visitor', phone: '+60111111111', contactConsent: true, active: true, visitCount: 2 });
    await db.doc('people/p_made').set({ name: 'Made by admin', householdId: 'h4', kind: 'adult', status: 'member', active: true, visitCount: 0 });
    await callFn('mergePeople', { fromPersonId: 'p_vis', intoPersonId: 'p_made' }, ADMIN);
    expect((await db.doc('people/p_made').get()).data()).toMatchObject({ phone: '+60111111111', contactConsent: true });
  });
});
