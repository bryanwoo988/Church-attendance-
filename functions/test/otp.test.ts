import { beforeEach, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { callFn, clearDb, db, PROJECT } from './helpers';

// In the emulator the SMS provider is faked: every requested code is 123456.
const CODE = '123456';
const PHONE = '+60123456789';

async function clearAuth() {
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
}

beforeEach(async () => {
  await clearDb();
  await clearAuth();
});

describe('requestLoginCode', () => {
  it('sends a code to a valid Malaysian number', async () => {
    expect(await callFn('requestLoginCode', { phone: '012-345 6789' })).toMatchObject({ ok: true, data: { sent: true } });
  });

  it('rejects an invalid number', async () => {
    expect(await callFn('requestLoginCode', { phone: '123' })).toMatchObject({ ok: false, message: 'login.invalidPhone' });
  });

  it('stops after the daily limit for one number, which admins can change', async () => {
    await db.doc('settings/church').set({ otpPerPhonePerDay: 2 });
    expect(await callFn('requestLoginCode', { phone: PHONE })).toMatchObject({ ok: true });
    expect(await callFn('requestLoginCode', { phone: PHONE })).toMatchObject({ ok: true });
    expect(await callFn('requestLoginCode', { phone: PHONE })).toMatchObject({ ok: false, message: 'login.tooMany' });
    // another number is unaffected
    expect(await callFn('requestLoginCode', { phone: '+60177654321' })).toMatchObject({ ok: true });
  });

  it('does not store the phone number in the rate-limit record', async () => {
    await callFn('requestLoginCode', { phone: PHONE });
    const ids = (await db.collection('rateLimits').get()).docs.map((d) => d.id).join(',');
    expect(ids).not.toContain('123456789');
  });
});

describe('verifyLoginCode', () => {
  it('refuses a wrong code', async () => {
    await callFn('requestLoginCode', { phone: PHONE });
    expect(await callFn('verifyLoginCode', { phone: PHONE, code: '000000' })).toMatchObject({ ok: false, message: 'login.wrongCode' });
  });

  it('refuses when no code was requested', async () => {
    expect(await callFn('verifyLoginCode', { phone: PHONE, code: CODE })).toMatchObject({ ok: false, message: 'login.codeExpired' });
  });

  it('creates the account for a new number and returns a sign-in token', async () => {
    await callFn('requestLoginCode', { phone: PHONE });
    const r = await callFn<any>('verifyLoginCode', { phone: '012-345 6789', code: CODE });
    expect(r.ok && typeof r.data.token).toBe('string');
    const user = await getAuth().getUserByPhoneNumber(PHONE);
    expect(user.uid).toBeTruthy();
  });

  it('signs an existing account back in, keeping its records', async () => {
    await getAuth().createUser({ uid: 'u_old', phoneNumber: PHONE });
    await callFn('requestLoginCode', { phone: PHONE });
    const r = await callFn<any>('verifyLoginCode', { phone: PHONE, code: CODE });
    expect(r.ok && r.data.uid).toBe('u_old');
  });

  it('a code works only once', async () => {
    await callFn('requestLoginCode', { phone: PHONE });
    expect(await callFn('verifyLoginCode', { phone: PHONE, code: CODE })).toMatchObject({ ok: true });
    expect(await callFn('verifyLoginCode', { phone: PHONE, code: CODE })).toMatchObject({ ok: false, message: 'login.codeExpired' });
  });
});

describe('ensureProfile after a Twilio sign-in', () => {
  it('reads the verified phone from the account when the token has none', async () => {
    await getAuth().createUser({ uid: 'u_new', phoneNumber: PHONE });
    const r = await callFn<any>('ensureProfile', { name: 'Mary' }, { uid: 'u_new' });
    expect(r).toMatchObject({ ok: true });
    const u = await db.doc('users/u_new').get();
    expect((await db.doc(`people/${u.get('personId')}`).get()).get('phone')).toBe(PHONE);
  });
});

describe('change phone', () => {
  const NEW = '+60177654321';
  beforeEach(async () => {
    await getAuth().createUser({ uid: 'u1', phoneNumber: PHONE });
    await db.doc('users/u1').set({ personId: 'p1', householdId: 'h1', roles: ['admin'] });
    await db.doc('people/p1').set({ name: 'Bryan', phone: PHONE, accountUid: 'u1', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 1 });
  });

  it('needs sign-in', async () => {
    expect(await callFn('requestPhoneChangeCode', { phone: NEW })).toMatchObject({ ok: false, status: 'UNAUTHENTICATED' });
  });

  it('moves the account and the person record to the verified new number', async () => {
    expect(await callFn('requestPhoneChangeCode', { phone: NEW }, { uid: 'u1' })).toMatchObject({ ok: true });
    expect(await callFn('confirmPhoneChange', { phone: NEW, code: '000000' }, { uid: 'u1' })).toMatchObject({ ok: false, message: 'login.wrongCode' });
    const r = await callFn('confirmPhoneChange', { phone: NEW, code: CODE }, { uid: 'u1' });
    expect(r).toMatchObject({ ok: true, data: { phone: NEW } });
    expect((await getAuth().getUser('u1')).phoneNumber).toBe(NEW);
    expect((await db.doc('people/p1').get()).get('phone')).toBe(NEW);
    expect((await db.doc('users/u1').get()).get('roles')).toEqual(['admin']);
  });

  it('merges an earlier newcomer record with the new number', async () => {
    await db.doc('people/v1').set({ name: 'Bryan (visitor)', phone: NEW, householdId: 'h9', kind: 'adult', status: 'visitor', active: true, visitCount: 2 });
    await callFn('requestPhoneChangeCode', { phone: NEW }, { uid: 'u1' });
    const r = await callFn<any>('confirmPhoneChange', { phone: NEW, code: CODE }, { uid: 'u1' });
    expect(r.ok && r.data.merged).toBe(1);
    expect((await db.doc('people/v1').get()).get('mergedInto')).toBe('p1');
  });

  it('refuses a number that belongs to another account', async () => {
    await getAuth().createUser({ uid: 'u2', phoneNumber: NEW });
    await callFn('requestPhoneChangeCode', { phone: NEW }, { uid: 'u1' });
    expect(await callFn('confirmPhoneChange', { phone: NEW, code: CODE }, { uid: 'u1' })).toMatchObject({ ok: false, message: 'phone.inUse' });
    expect((await getAuth().getUser('u1')).phoneNumber).toBe(PHONE);
  });

  it('refuses the current number', async () => {
    expect(await callFn('requestPhoneChangeCode', { phone: PHONE }, { uid: 'u1' })).toMatchObject({ ok: false, message: 'phone.same' });
  });
});
