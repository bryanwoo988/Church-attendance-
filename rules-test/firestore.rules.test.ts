import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, Timestamp, serverTimestamp, collection, addDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-church',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

const hoursAgo = (h: number) => Timestamp.fromMillis(Date.now() - h * 3600_000);

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const users: Record<string, object> = {
      u_mem: { personId: 'p_mem', householdId: 'h1', roles: [] },
      u_other: { personId: 'p_other', householdId: 'h2', roles: [] },
      u_scan: { personId: 'p_scan', householdId: 'h3', roles: ['scanner'] },
      u_fin: { personId: 'p_fin', householdId: 'h4', roles: ['finance'] },
      u_admin: { personId: 'p_admin', householdId: 'h5', roles: ['admin'] },
      u_lead: { personId: 'p_lead', householdId: 'h6', roles: ['leader'] },
    };
    for (const [uid, data] of Object.entries(users)) await setDoc(doc(db, 'users', uid), data);
    await setDoc(doc(db, 'households/h1'), { ownerUid: 'u_mem' });
    await setDoc(doc(db, 'households/h2'), { ownerUid: 'u_other' });
    await setDoc(doc(db, 'people/p_mem'), { name: 'Mem', householdId: 'h1', kind: 'adult', status: 'member', accountUid: 'u_mem', active: true, visitCount: 0 });
    await setDoc(doc(db, 'people/p_other'), { name: 'Other', householdId: 'h2', kind: 'adult', status: 'member', accountUid: 'u_other', active: true, visitCount: 0 });
    await setDoc(doc(db, 'groups/g1'), { name: 'G1', leaderUids: ['u_lead'], memberPersonIds: [] });
    await setDoc(doc(db, 'groups/g2'), { name: 'G2', leaderUids: [], memberPersonIds: [] });
    await setDoc(doc(db, 'meetings/m1'), { type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' });
    await setDoc(doc(db, 'meetings/mg1'), { type: 'group', title: 'G1', date: '2026-10-18', groupId: 'g1', checkinMode: 'always' });
    await setDoc(doc(db, 'meetings/mg2'), { type: 'group', title: 'G2', date: '2026-10-18', groupId: 'g2', checkinMode: 'always' });
    await setDoc(doc(db, 'offerings/o_other'), { uid: 'u_other', personId: 'p_other', householdId: 'h2', date: '2026-10-18', amountSen: 5000, category: 'x', createdAt: hoursAgo(1) });
    await setDoc(doc(db, 'offerings/o_old'), { uid: 'u_mem', personId: 'p_mem', householdId: 'h1', date: '2026-10-17', amountSen: 5000, category: 'x', createdAt: hoursAgo(25) });
    await setDoc(doc(db, 'offerings/o_new'), { uid: 'u_mem', personId: 'p_mem', householdId: 'h1', date: '2026-10-18', amountSen: 5000, category: 'x', createdAt: hoursAgo(1) });
    await setDoc(doc(db, 'settings/church'), { offeringCategories: ['x'] });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const att = (meetingId: string, personId: string, byUid: string) => ({
  meetingId, personId, date: '2026-10-18', method: 'scanner', byUid, at: serverTimestamp(),
});
const newOffering = (over: object = {}) => ({
  uid: 'u_mem', personId: 'p_mem', householdId: 'h1', date: '2026-10-18', amountSen: 5050, category: 'x',
  createdAt: serverTimestamp(), ...over,
});

describe('offerings privacy', () => {
  it('member cannot read another household offering', async () => {
    await assertFails(getDoc(doc(as('u_mem'), 'offerings/o_other')));
  });
  it('member can read own offering', async () => {
    await assertSucceeds(getDoc(doc(as('u_mem'), 'offerings/o_new')));
  });
  it('scanner cannot read any offering', async () => {
    await assertFails(getDoc(doc(as('u_scan'), 'offerings/o_other')));
  });
  it('leader cannot read any offering', async () => {
    await assertFails(getDoc(doc(as('u_lead'), 'offerings/o_other')));
  });
  it('finance can read all offerings', async () => {
    await assertSucceeds(getDoc(doc(as('u_fin'), 'offerings/o_other')));
  });
  it('unauthenticated cannot read offerings', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'offerings/o_new')));
  });
});

describe('offering writes', () => {
  it('member creates a valid offering', async () => {
    await assertSucceeds(addDoc(collection(as('u_mem'), 'offerings'), newOffering()));
  });
  it('rejects zero amount', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'offerings'), newOffering({ amountSen: 0 })));
  });
  it('rejects fractional sen', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'offerings'), newOffering({ amountSen: 5.5 })));
  });
  it('rejects over the maximum', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'offerings'), newOffering({ amountSen: 10_000_001 })));
  });
  it('rejects someone else uid', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'offerings'), newOffering({ uid: 'u_other' })));
  });
  it('rejects a personId outside own household', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'offerings'), newOffering({ personId: 'p_other', householdId: 'h2' })));
  });
  it('owner updates within 24h', async () => {
    await assertSucceeds(updateDoc(doc(as('u_mem'), 'offerings/o_new'), { amountSen: 6000, updatedAt: serverTimestamp() }));
  });
  it('owner cannot update after 25h', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'offerings/o_old'), { amountSen: 6000, updatedAt: serverTimestamp() }));
  });
  it('owner cannot change the date', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'offerings/o_new'), { date: '2026-01-01', updatedAt: serverTimestamp() }));
  });
});

describe('roles', () => {
  it('member cannot set own roles', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'users/u_mem'), { roles: ['admin'] }));
  });
  it('member can set own lang', async () => {
    await assertSucceeds(updateDoc(doc(as('u_mem'), 'users/u_mem'), { lang: 'en' }));
  });
  it('admin can set roles', async () => {
    await assertSucceeds(updateDoc(doc(as('u_admin'), 'users/u_mem'), { roles: ['finance'] }));
  });
  it('member cannot read another user doc', async () => {
    await assertFails(getDoc(doc(as('u_mem'), 'users/u_other')));
  });
});

describe('attendance', () => {
  it('scanner creates attendance once; a second create fails', async () => {
    const db = as('u_scan');
    await assertSucceeds(setDoc(doc(db, 'attendance/m1_p_mem'), att('m1', 'p_mem', 'u_scan')));
    await assertFails(setDoc(doc(db, 'attendance/m1_p_mem'), att('m1', 'p_mem', 'u_scan')));
  });
  it('rejects mismatched id', async () => {
    await assertFails(setDoc(doc(as('u_scan'), 'attendance/m1_p_other'), att('m1', 'p_mem', 'u_scan')));
  });
  it('rejects byUid of someone else', async () => {
    await assertFails(setDoc(doc(as('u_scan'), 'attendance/m1_p_mem'), att('m1', 'p_mem', 'u_admin')));
  });
  it('leader records attendance for own group meeting', async () => {
    await assertSucceeds(setDoc(doc(as('u_lead'), 'attendance/mg1_p_mem'), att('mg1', 'p_mem', 'u_lead')));
  });
  it('leader cannot record for a group they do not lead', async () => {
    await assertFails(setDoc(doc(as('u_lead'), 'attendance/mg2_p_mem'), att('mg2', 'p_mem', 'u_lead')));
  });
  it('member cannot create attendance directly', async () => {
    await assertFails(setDoc(doc(as('u_mem'), 'attendance/m1_p_mem'), att('m1', 'p_mem', 'u_mem')));
  });
  it('member reads own household attendance', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'attendance/m1_p_mem'), att('m1', 'p_mem', 'u_scan')));
    await assertSucceeds(getDoc(doc(as('u_mem'), 'attendance/m1_p_mem')));
  });
});

describe('people', () => {
  it('household owner adds a child', async () => {
    await assertSucceeds(addDoc(collection(as('u_mem'), 'people'), {
      name: 'Kid', kind: 'child', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: serverTimestamp(),
    }));
  });
  it('household owner cannot give a family member a different status', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'people'), {
      name: 'Kid', kind: 'child', householdId: 'h1', status: 'visitor', active: true, visitCount: 0, createdAt: serverTimestamp(),
    }));
  });
  it('owner cannot add people to another household', async () => {
    await assertFails(addDoc(collection(as('u_mem'), 'people'), {
      name: 'Kid', kind: 'child', householdId: 'h2', status: 'member', active: true, visitCount: 0, createdAt: serverTimestamp(),
    }));
  });
  it('owner cannot change own status', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'people/p_mem'), { status: 'visitor' }));
  });
  it('owner can rename own person', async () => {
    await assertSucceeds(updateDoc(doc(as('u_mem'), 'people/p_mem'), { name: 'New name' }));
  });
  it('owner can change a family member to child and remove them', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'people/p_kid'), { name: 'Kid', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0 }));
    await assertSucceeds(updateDoc(doc(as('u_mem'), 'people/p_kid'), { name: 'Kid Tan', kind: 'child' }));
    await assertSucceeds(updateDoc(doc(as('u_mem'), 'people/p_kid'), { active: false }));
  });
  it('member cannot edit people of another household', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'people/p_other'), { kind: 'child' }));
  });
  it('member cannot read people of another household', async () => {
    await assertFails(getDoc(doc(as('u_mem'), 'people/p_other')));
  });
  it('scanner can read people', async () => {
    await assertSucceeds(getDoc(doc(as('u_scan'), 'people/p_other')));
  });
  it('admin can change status', async () => {
    await assertSucceeds(updateDoc(doc(as('u_admin'), 'people/p_mem'), { status: 'regular' }));
  });
});

describe('meetings, groups, settings', () => {
  it('leader creates a meeting for own group', async () => {
    await assertSucceeds(setDoc(doc(as('u_lead'), 'meetings/new1'), { type: 'group', title: 't', date: '2026-10-20', groupId: 'g1', checkinMode: 'always', createdBy: 'u_lead' }));
  });
  it('leader cannot create a sunday meeting', async () => {
    await assertFails(setDoc(doc(as('u_lead'), 'meetings/new2'), { type: 'sunday', title: 't', date: '2026-10-20', checkinMode: 'always', createdBy: 'u_lead' }));
  });
  it('member cannot write settings', async () => {
    await assertFails(updateDoc(doc(as('u_mem'), 'settings/church'), { offeringCategories: ['y'] }));
  });
  it('member can read settings', async () => {
    await assertSucceeds(getDoc(doc(as('u_mem'), 'settings/church')));
  });
  it('leader updates members of own group', async () => {
    await assertSucceeds(updateDoc(doc(as('u_lead'), 'groups/g1'), { memberPersonIds: ['p_mem'] }));
  });
  it('leader cannot add themselves as leader of another group', async () => {
    await assertFails(updateDoc(doc(as('u_lead'), 'groups/g2'), { leaderUids: ['u_lead'] }));
  });
});

describe('payment QR in settings', () => {
  it('admin can store a payment QR data URL', async () => {
    await assertSucceeds(updateDoc(doc(as('u_admin'), 'settings/church'), { paymentQrDataUrl: 'data:image/png;base64,AAAA' }));
  });
  it('admin cannot store a non-image data URL', async () => {
    await assertFails(updateDoc(doc(as('u_admin'), 'settings/church'), { paymentQrDataUrl: 'javascript:alert(1)' }));
  });
  it('rejects a payment QR over 900 KB', async () => {
    await assertFails(updateDoc(doc(as('u_admin'), 'settings/church'), { paymentQrDataUrl: 'data:image/png;base64,' + 'A'.repeat(900_001) }));
  });
});

describe('households', () => {
  it('admin can create a household', async () => {
    await assertSucceeds(setDoc(doc(as('u_admin'), 'households/hx'), { createdAt: serverTimestamp() }));
  });
  it('member cannot create a household', async () => {
    await assertFails(setDoc(doc(as('u_mem'), 'households/hy'), { createdAt: serverTimestamp() }));
  });
  it('admin can list users', async () => {
    await assertSucceeds(getDoc(doc(as('u_admin'), 'users/u_mem')));
  });
});

describe('leader attendance list', () => {
  it('leader lists attendance of own group meeting', async () => {
    const { query, where, getDocs } = await import('firebase/firestore');
    await assertSucceeds(getDocs(query(collection(as('u_lead'), 'attendance'), where('meetingId', 'in', ['mg1']))));
  });
  it('leader cannot list attendance of another group meeting', async () => {
    const { query, where, getDocs } = await import('firebase/firestore');
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'attendance/mg2_p_mem'), att('mg2', 'p_mem', 'u_admin')));
    await assertFails(getDocs(query(collection(as('u_lead'), 'attendance'), where('meetingId', 'in', ['mg2']))));
  });
});
