/**
 * Make an existing app user an admin.
 * Usage: npx tsx scripts/grant-admin.ts +60123456789
 * Needs Google credentials for the project (`gcloud auth application-default login`)
 * and GOOGLE_CLOUD_PROJECT set to the Firebase project id.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { normalizeMyPhone } from '../shared/phone';

const arg = process.argv[2] ?? '';
const phone = normalizeMyPhone(arg);
if (!phone.ok) {
  console.error(`电话号码不正确 / Invalid phone: "${arg}"`);
  process.exit(1);
}

initializeApp();
try {
  const user = await getAuth().getUserByPhoneNumber(phone.e164);
  const ref = getFirestore().doc(`users/${user.uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('这个号码登录过，但还没完成个人资料。请先在 App 里填好名字。');
    process.exit(1);
  }
  await ref.update({ roles: FieldValue.arrayUnion('admin') });
  console.log(`✓ ${phone.e164} 现在是管理员 / is now admin`);
} catch (e: any) {
  if (e?.code === 'auth/user-not-found') {
    console.error('这个号码还没登录过 App。请先用这个号码登录一次，再运行这个指令。');
    process.exit(1);
  }
  throw e;
}
