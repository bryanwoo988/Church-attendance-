import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db } from './helpers';

const PHONE = '+60123456789';

beforeEach(clearDb);

describe('ensureProfile', () => {
  it('asks for a name for a new phone and writes nothing', async () => {
    const r = await callFn('ensureProfile', {}, { uid: 'u1', phone: PHONE });
    expect(r).toEqual({ ok: true, data: expect.objectContaining({ needsName: true }) });
    expect((await db.collection('people').get()).size).toBe(0);
    expect((await db.doc('users/u1').get()).exists).toBe(false);
  });

  it('creates person, household and user when a name is given', async () => {
    const r = await callFn<any>('ensureProfile', { name: 'Mary Tan' }, { uid: 'u1', phone: PHONE });
    if (!r.ok) throw new Error(r.message);
    expect(r.data.needsName).toBe(false);
    const person = (await db.doc(`people/${r.data.personId}`).get()).data()!;
    expect(person).toMatchObject({ name: 'Mary Tan', phone: PHONE, accountUid: 'u1', status: 'visitor', kind: 'adult', active: true, householdId: r.data.householdId });
    expect((await db.doc(`households/${r.data.householdId}`).get()).data()).toMatchObject({ ownerUid: 'u1' });
    expect((await db.doc('users/u1').get()).data()).toMatchObject({ personId: r.data.personId, householdId: r.data.householdId, roles: [] });
  });

  it('attaches to an existing visitor with the same phone', async () => {
    await db.doc('households/h1').set({ createdAt: new Date() });
    await db.doc('people/p1').set({ name: 'Visitor', phone: PHONE, householdId: 'h1', kind: 'adult', status: 'visitor', active: true, visitCount: 2 });
    const r = await callFn<any>('ensureProfile', {}, { uid: 'u1', phone: PHONE });
    if (!r.ok) throw new Error(r.message);
    expect(r.data).toMatchObject({ personId: 'p1', householdId: 'h1', needsName: false });
    expect((await db.collection('people').get()).size).toBe(1);
    expect((await db.doc('people/p1').get()).data()).toMatchObject({ accountUid: 'u1' });
    expect((await db.doc('households/h1').get()).data()).toMatchObject({ ownerUid: 'u1' });
  });

  it('is idempotent', async () => {
    const a = await callFn<any>('ensureProfile', { name: 'Mary' }, { uid: 'u1', phone: PHONE });
    const b = await callFn<any>('ensureProfile', { name: 'Mary' }, { uid: 'u1', phone: PHONE });
    expect(a.ok && b.ok && a.data.personId === b.data.personId).toBe(true);
    expect((await db.collection('people').get()).size).toBe(1);
  });

  it('rejects unauthenticated calls', async () => {
    const r = await callFn('ensureProfile', { name: 'x' });
    expect(r).toMatchObject({ ok: false, status: 'UNAUTHENTICATED' });
  });
});

describe('ensureProfile for a family member with their own phone', () => {
  it('moves them to their own household instead of taking over the parent household', async () => {
    await db.doc('households/h1').set({ ownerUid: 'u_parent' });
    await db.doc('people/p_parent').set({ name: 'Parent', phone: '+60199999999', accountUid: 'u_parent', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0 });
    await db.doc('people/p_teen').set({ name: 'Teen', phone: PHONE, householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0 });
    const r = await callFn<any>('ensureProfile', {}, { uid: 'u_teen', phone: PHONE });
    if (!r.ok) throw new Error(r.message);
    expect(r.data.personId).toBe('p_teen');
    expect(r.data.householdId).not.toBe('h1');
    expect((await db.doc('households/h1').get()).get('ownerUid')).toBe('u_parent');
    expect((await db.doc('people/p_teen').get()).get('householdId')).toBe(r.data.householdId);
  });
});
