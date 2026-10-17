import { beforeEach, describe, expect, it } from 'vitest';
import { callFn, clearDb, db } from './helpers';
import { klDate } from '../../shared/dates';

const today = klDate(new Date());
const SCAN = { uid: 'u_scan' };
const MEM = { uid: 'u_mem' };
const LEAD = { uid: 'u_lead' };
const M = `sunday-${today}`;

beforeEach(async () => {
  await clearDb();
  await db.doc('users/u_scan').set({ personId: 'p_scan', householdId: 'h3', roles: ['scanner'] });
  await db.doc('users/u_mem').set({ personId: 'p_mem', householdId: 'h1', roles: [] });
  await db.doc('users/u_lead').set({ personId: 'p_lead', householdId: 'h6', roles: ['leader'] });
  await db.doc('people/p_mem').set({ name: 'Mem', phone: '+60123456789', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0 });
  await db.doc('groups/g1').set({ name: 'G1', leaderUids: ['u_lead'], memberPersonIds: [] });
  await db.doc(`meetings/${M}`).set({ type: 'sunday', title: '主日', date: today, checkinMode: 'always' });
  await db.doc('meetings/mg1').set({ type: 'group', title: 'G1', date: today, groupId: 'g1', checkinMode: 'always' });
});

describe('scannerAddVisitor', () => {
  it('creates a newcomer and checks them in', async () => {
    const r = await callFn<any>('scannerAddVisitor', { meetingId: M, name: ' Ah Kow ', phone: '012-888 7777', kind: 'adult', howHeard: 'welcome.how.friend', contactConsent: true, pdpaTold: true }, SCAN);
    expect(r).toMatchObject({ ok: true, data: { status: 'ok', created: true } });
    const p = (await db.doc(`people/${r.ok && r.data.personId}`).get()).data();
    expect(p).toMatchObject({ name: 'Ah Kow', phone: '+60128887777', status: 'visitor', kind: 'adult', visitCount: 1, firstVisitDate: today, lastVisitDate: today, active: true, howHeard: 'welcome.how.friend', contactConsent: true });
    expect(p?.pdpaConsentAt).toBeDefined();
    const a = (await db.doc(`attendance/${M}_${r.ok && r.data.personId}`).get()).data();
    expect(a).toMatchObject({ meetingId: M, method: 'scanner', byUid: 'u_scan', date: today });
  });

  it('phone is optional', async () => {
    const r = await callFn<any>('scannerAddVisitor', { meetingId: M, name: 'Baby', kind: 'child' }, SCAN);
    expect(r.ok && r.data.created).toBe(true);
    const p = (await db.doc(`people/${r.ok && r.data.personId}`).get()).data();
    expect(p?.phone).toBeUndefined();
    expect(p?.kind).toBe('child');
  });

  it('a known phone checks in that person instead of creating a duplicate', async () => {
    const r = await callFn<any>('scannerAddVisitor', { meetingId: M, name: 'Someone', phone: '0123456789', kind: 'adult', pdpaTold: true }, SCAN);
    expect(r).toMatchObject({ ok: true, data: { personId: 'p_mem', status: 'ok', created: false } });
    expect((await db.collection('people').get()).size).toBe(1);
    const again = await callFn<any>('scannerAddVisitor', { meetingId: M, name: 'Someone', phone: '0123456789', kind: 'adult', pdpaTold: true }, SCAN);
    expect(again).toMatchObject({ ok: true, data: { personId: 'p_mem', status: 'already' } });
  });

  it('rejects members without a scanner role, a missing name and a bad phone', async () => {
    expect(await callFn('scannerAddVisitor', { meetingId: M, name: 'X', kind: 'adult' }, MEM)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
    expect(await callFn('scannerAddVisitor', { meetingId: M, name: ' ', kind: 'adult' }, SCAN)).toMatchObject({ ok: false, message: 'welcome.nameRequired' });
    expect(await callFn('scannerAddVisitor', { meetingId: M, name: 'X', phone: '123', kind: 'adult', pdpaTold: true }, SCAN)).toMatchObject({ ok: false, message: 'welcome.invalidPhone' });
    expect((await db.collection('people').get()).size).toBe(1);
  });

  it('a leader may add only to their own group meeting', async () => {
    expect(await callFn('scannerAddVisitor', { meetingId: M, name: 'X', kind: 'adult' }, LEAD)).toMatchObject({ ok: false, status: 'PERMISSION_DENIED' });
    expect(await callFn('scannerAddVisitor', { meetingId: 'mg1', name: 'X', kind: 'adult' }, LEAD)).toMatchObject({ ok: true });
  });

  it('a phone number needs the PDPA notice to have been given', async () => {
    const r = await callFn('scannerAddVisitor', { meetingId: M, name: 'X', phone: '0128887777', kind: 'adult' }, SCAN);
    expect(r).toMatchObject({ ok: false, message: 'manual.pdpaRequired' });
    expect((await db.collection('people').get()).size).toBe(1);
  });
});
