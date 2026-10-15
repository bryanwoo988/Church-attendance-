import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { db, FieldValue, REGION } from './lib/admin';
import { requireAuth, requireRole, requireUser } from './lib/auth';
import { attendanceId } from '../../shared/checkin';
import { MAX_SEN } from '../../shared/money';

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null);

export const mergePeople = onCall<{ fromPersonId: string; intoPersonId: string }>({ region: REGION }, async (request) => {
  await requireRole(request, ['admin']);
  const fromId = str(request.data?.fromPersonId);
  const intoId = str(request.data?.intoPersonId);
  if (!fromId || !intoId || fromId === intoId) throw new HttpsError('invalid-argument', 'merge.invalid');

  const [fromSnap, intoSnap] = await db.getAll(db.doc(`people/${fromId}`), db.doc(`people/${intoId}`));
  if (!fromSnap.exists || !intoSnap.exists) throw new HttpsError('not-found', 'merge.notFound');
  if (fromSnap.get('accountUid') && intoSnap.get('accountUid')) throw new HttpsError('failed-precondition', 'merge.twoAccounts');

  const att = await db.collection('attendance').where('personId', '==', fromId).get();
  const offs = await db.collection('offerings').where('personId', '==', fromId).get();
  let movedAttendance = 0;
  const batch = db.bulkWriter();
  for (const a of att.docs) {
    const target = db.doc(`attendance/${attendanceId(a.get('meetingId'), intoId)}`);
    if (!(await target.get()).exists) {
      batch.set(target, { ...a.data(), personId: intoId });
      movedAttendance++;
    }
    batch.delete(a.ref);
  }
  for (const o of offs.docs) batch.update(o.ref, { personId: intoId, householdId: intoSnap.get('householdId') });

  const firsts = [fromSnap.get('firstVisitDate'), intoSnap.get('firstVisitDate')].filter(Boolean).sort();
  const lasts = [fromSnap.get('lastVisitDate'), intoSnap.get('lastVisitDate')].filter(Boolean).sort();
  batch.update(intoSnap.ref, {
    visitCount: (fromSnap.get('visitCount') ?? 0) + (intoSnap.get('visitCount') ?? 0),
    ...(firsts[0] ? { firstVisitDate: firsts[0] } : {}),
    ...(lasts.length ? { lastVisitDate: lasts[lasts.length - 1] } : {}),
    ...(!intoSnap.get('accountUid') && fromSnap.get('accountUid') ? { accountUid: fromSnap.get('accountUid') } : {}),
  });
  batch.update(fromSnap.ref, { active: false, mergedInto: intoId, accountUid: FieldValue.delete() });
  if (fromSnap.get('accountUid') && !intoSnap.get('accountUid')) {
    batch.update(db.doc(`users/${fromSnap.get('accountUid')}`), { personId: intoId, householdId: intoSnap.get('householdId') });
  }
  await batch.close();
  return { movedAttendance, movedOfferings: offs.size };
});

interface EditReq { offeringId: string; amountSen?: number; category?: string; delete?: boolean }

export const financeEditOffering = onCall<EditReq>({ region: REGION }, async (request) => {
  const user = await requireRole(request, ['finance', 'admin']);
  const id = str(request.data?.offeringId);
  if (!id) throw new HttpsError('invalid-argument', 'offering.invalid');
  const del = request.data.delete === true;
  const amount = request.data.amountSen;
  if (!del && amount !== undefined && !(Number.isInteger(amount) && amount >= 1 && amount <= MAX_SEN)) {
    throw new HttpsError('invalid-argument', 'offering.invalidAmount');
  }
  const category = typeof request.data.category === 'string' ? request.data.category.slice(0, 60) : undefined;

  await db.runTransaction(async (tx) => {
    const ref = db.doc(`offerings/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'offering.notFound');
    const old = snap.data()!;
    tx.create(ref.collection('history').doc(), {
      byUid: user.uid, at: FieldValue.serverTimestamp(), deleted: del,
      oldAmountSen: old.amountSen, newAmountSen: del ? null : amount ?? old.amountSen,
      oldCategory: old.category, newCategory: del ? null : category ?? old.category,
    });
    if (del) tx.delete(ref);
    else tx.update(ref, { amountSen: amount ?? old.amountSen, category: category ?? old.category, updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

async function erasePeople(personIds: string[]) {
  const w = db.bulkWriter();
  for (const pid of personIds) {
    const att = await db.collection('attendance').where('personId', '==', pid).get();
    att.docs.forEach((a) => w.delete(a.ref));
    const offs = await db.collection('offerings').where('personId', '==', pid).get();
    offs.docs.forEach((o) => w.update(o.ref, { uid: 'deleted', personId: 'deleted', householdId: 'deleted' }));
    w.delete(db.doc(`people/${pid}`));
  }
  await w.close();
}

export const deleteMyData = onCall<{ confirm?: string }>({ region: REGION }, async (request) => {
  requireAuth(request);
  if (request.data?.confirm !== 'DELETE') throw new HttpsError('invalid-argument', 'profile.confirmDelete');
  const user = await requireUser(request);
  const members = await db.collection('people').where('householdId', '==', user.householdId).get();
  await erasePeople(members.docs.map((d) => d.id));
  const offs = await db.collection('offerings').where('uid', '==', user.uid).get();
  await Promise.all(offs.docs.map((o) => o.ref.update({ uid: 'deleted', personId: 'deleted', householdId: 'deleted' })));
  await db.doc(`users/${user.uid}`).delete();
  await db.doc(`households/${user.householdId}`).delete();
  try {
    await getAuth().deleteUser(user.uid);
  } catch (e: any) {
    if (e?.code !== 'auth/user-not-found') throw e;
  }
  return { ok: true };
});

export const deletePersonData = onCall<{ personId: string }>({ region: REGION }, async (request) => {
  await requireRole(request, ['admin']);
  const pid = str(request.data?.personId);
  if (!pid) throw new HttpsError('invalid-argument', 'person.invalid');
  const snap = await db.doc(`people/${pid}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'person.notFound');
  if (snap.get('accountUid')) throw new HttpsError('failed-precondition', 'person.hasAccount');
  await erasePeople([pid]);
  return { ok: true };
});
