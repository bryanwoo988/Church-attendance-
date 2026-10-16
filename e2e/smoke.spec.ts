import { test, expect, type Page } from '@playwright/test';
const PROJECT = 'demo-church';
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

/** Grant roles through the emulators' admin REST endpoints (bypasses security rules). */
async function grantRoles(phone: string, roles: string[]) {
  const look = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
    method: 'POST', headers: OWNER, body: JSON.stringify({ phoneNumber: [phone] }),
  });
  const uid = ((await look.json()) as { users: { localId: string }[] }).users[0].localId;
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=roles`, {
    method: 'PATCH', headers: OWNER,
    body: JSON.stringify({ fields: { roles: { arrayValue: { values: roles.map((r) => ({ stringValue: r })) } } } }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function latestCode(phone: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`);
  const body = (await res.json()) as { verificationCodes: { phoneNumber: string; code: string }[] };
  const codes = body.verificationCodes.filter((c) => c.phoneNumber === phone);
  return codes[codes.length - 1].code;
}

async function login(page: Page, local: string, e164: string, name: string) {
  await page.goto('/login');
  await page.getByLabel('电话号码').fill(local);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByLabel('验证码')).toBeVisible();
  await page.getByLabel('验证码').fill(await latestCode(e164));
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByLabel('名字')).toBeVisible({ timeout: 15_000 }); // first callable can be a cold start
  await page.getByLabel('名字').fill(name);
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByRole('link', { name: '签到', exact: true })).toBeVisible();
}

test('admin sets up, family checks in, finance exports, language switches', async ({ page }) => {
  const phone = '+60123456789';
  await login(page, '012-345 6789', phone, 'Admin Tan');

  await grantRoles(phone, ['admin', 'finance', 'scanner']);
  await page.reload();

  // Admin: create today's event meeting, valid all day.
  await page.getByRole('link', { name: '聚会' }).click();
  await page.getByLabel('名称').fill('测试聚会');
  await page.getByRole('button', { name: '建立聚会' }).click();
  await expect(page.getByText('已建立')).toBeVisible();

  // Member: add a child.
  await page.goto('/family');
  await page.getByLabel('家人名字').fill('Little Tan');
  await page.getByLabel('小孩').check();
  await page.getByRole('button', { name: '加入家人' }).click();
  await expect(page.getByText('Little Tan')).toBeVisible();

  // Self check-in with the family picker.
  await page.goto('/checkin');
  await page.getByRole('button', { name: '确认签到（2 人）' }).click();
  await expect(page.getByText('✓ 已签到')).toHaveCount(2);

  // Doing it again reports already checked in.
  await page.goto('/checkin');
  await page.getByRole('button', { name: '确认签到（2 人）' }).click();
  await expect(page.getByText('已经签过')).toHaveCount(2);

  // Offering.
  await page.goto('/offering');
  await page.getByRole('button', { name: '我已转账，记录金额' }).click();
  await page.getByLabel('金额（RM）').fill('50');
  await page.getByRole('button', { name: '提交' }).click();
  await expect(page.getByText('已记录 RM 50.00')).toBeVisible();

  // Finance export.
  await page.goto('/finance/export');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出 Excel' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^church-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/);

  // Language switch.
  await page.goto('/');
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('link', { name: 'Church Check-in' })).toBeVisible();
});

test('newcomer form works without login', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByLabel('名字').fill('New Friend');
  await page.getByLabel('手机号码').fill('017-765 4321');
  await page.getByLabel('我同意以上个人资料使用说明（PDPA）').check();
  await page.getByRole('button', { name: '提交' }).click();
  await expect(page.getByText('这是你第 1 次来')).toBeVisible();
});
