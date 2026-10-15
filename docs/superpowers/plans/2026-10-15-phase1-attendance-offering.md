# Church Attendance & Offering PWA — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of a bilingual (华语/English) church PWA: phone login, personal QR codes, family members, two check-in methods, newcomer form, self-reported offerings, in-app admin, and Excel export.

**Architecture:** Vite + React SPA served from Firebase Hosting as a PWA. Firestore is the database; Security Rules enforce roles for direct reads/writes. Anything that must not be trusted to the client (self check-in time windows, newcomer form without login, matching a phone to an existing person, merges, finance edits with history, weekly Sunday creation) runs in Cloud Functions (2nd gen). Pure domain logic lives in `shared/` and is imported by both the app and the functions so it is unit-tested once.

**Tech Stack:** Node 22, TypeScript, Vite 8, React 19, react-router 7, Firebase JS SDK 13 (Auth phone, Firestore with persistent cache, Storage, Functions, App Check), firebase-functions 7, firebase-tools 15 (emulators), vite-plugin-pwa 1, `qr-scanner` 1.4 (scan), `qrcode` (render), `exceljs` 4.4 (export, lazy-loaded), Vitest, `@firebase/rules-unit-testing` 5, Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-10-15-church-attendance-pwa-design.md` (overview: `docs/项目总览-Overview.md`)

## Global Constraints

- Country: Malaysia. Phones stored as E.164 `+60…`. Currency RM; amounts stored as integer **sen** (`amountSen`), never floats.
- All "dates" (offering date, meeting day, "today") are computed in `Asia/Kuala_Lumpur`, format `YYYY-MM-DD`.
- Login is **phone number + SMS only**. No Google login.
- UI strings exist in both `zh` and `en`; default `zh`; choice persisted in `localStorage` key `lang` (wrapped in try/catch).
- Roles: `scanner`, `leader`, `finance`, `admin` (members have no role). A user may hold several. Roles are stored server-side; client never trusts its own role for data access.
- Only `finance` and `admin` can read other people's offerings. Scanners and leaders never can.
- Person status: `visitor` → `regular` → `member`, changed only by admin. Person kind: `adult` | `child`.
- Personal QR payload contains the person ID only, never the phone number.
- Self check-in poster URL is fixed (`/checkin`); newcomer poster is `/welcome`. Neither changes week to week.
- Meeting check-in mode: `always` (valid on the meeting's day) or `window` (valid between `windowStart` and `windowEnd`).
- Newcomer form requires ticking a bilingual PDPA consent before submit.
- No real payment processing. The app shows the church DuitNow QR image and records self-reported amounts.

## Review Focus

1. **Double scan / double tap** — the same person scanned twice, or a member tapping "签到" twice, must produce exactly one attendance record and show "已经签过 / Already checked in". (Task 3 rules test + Task 5 function test.)
2. **Malaysian phone formats** — `012-345 6789`, `0123456789`, `+60 12-345 6789`, `60123456789` all normalize to `+60123456789`; `12345` and non-MY numbers are rejected with a message, not a crash. (Task 2 test.)
3. **Around midnight / UTC drift** — an offering or check-in at 00:30 KL time (16:30 UTC the previous day) belongs to the KL date. (Task 2 test.)
4. **Door Wi-Fi drops** — scans made offline are queued and show "已记录（离线，稍后同步）"; they sync without duplicates when back online. (Task 9 test.)
5. **Amount input** — `50`, `50.5`, `RM 1,000.00`, ` 20 ` parse to sen; `0`, `-5`, `abc`, `50.555`, over RM 100,000 are rejected. (Task 2 test.)

---

## File Structure

```
package.json                 # root workspace: app + shared; scripts
vite.config.ts               # React + PWA plugin
firebase.json, .firebaserc   # hosting, firestore, storage, functions, emulators
firestore.rules, firestore.indexes.json, storage.rules
shared/                      # pure TS, no Firebase imports
  types.ts                   # Person, Household, UserDoc, Meeting, Attendance, Offering, Settings
  dates.ts                   # klDate, klNow helpers
  phone.ts                   # normalizeMyPhone
  money.ts                   # parseAmountToSen, formatSen
  qr.ts                      # personalQrPayload, parsePersonalQr
  checkin.ts                 # isCheckinOpen, resolveCurrentMeeting, attendanceId
  stats.ts                   # attendanceRates
  export.ts                  # buildExportSheets (rows only, no ExcelJS)
  *.test.ts
functions/
  package.json, tsconfig.json
  src/index.ts               # exports all functions
  src/profile.ts             # ensureProfile
  src/visitor.ts             # submitVisitorForm
  src/checkin.ts             # selfCheckIn
  src/sunday.ts              # createUpcomingSunday (scheduled)
  src/admin.ts               # mergePeople, financeEditOffering
  src/lib/auth.ts            # requireRole helper
  test/*.test.ts             # run against emulators
scripts/grant-admin.ts       # one-off: make a phone number admin
src/
  main.tsx, App.tsx, routes.tsx
  firebase.ts                # init app, auth, db (persistent cache), storage, functions, app check; emulator wiring
  i18n/{index.ts,zh.ts,en.ts}
  auth/{AuthProvider.tsx,LoginPage.tsx,ProfileSetup.tsx,RequireRole.tsx}
  member/{HomePage.tsx,FamilyPage.tsx,QrCard.tsx}
  checkin/{ScannerPage.tsx,SelfCheckinPage.tsx,FamilyPicker.tsx,offlineStatus.ts}
  welcome/WelcomePage.tsx
  offering/{OfferingPage.tsx,MyOfferings.tsx}
  admin/{PeoplePage.tsx,PersonEditor.tsx,MeetingsPage.tsx,PosterPage.tsx,GroupsPage.tsx,SettingsPage.tsx,NewcomersPage.tsx}
  finance/{ExportPage.tsx,OfferingsPage.tsx,writeXlsx.ts}
e2e/smoke.spec.ts
docs/SETUP.md                # 中文：Firebase console steps, deploy, first admin
```

## Firestore Data Model (decided here; every task uses these names)

| Collection | Doc ID | Fields |
|---|---|---|
| `people` | auto | `name`, `householdId`, `kind: 'adult'\|'child'`, `status: 'visitor'\|'regular'\|'member'`, `phone?: string` (E.164, account holders & visitors only), `accountUid?: string`, `firstVisitDate?: string`, `visitCount: number`, `lastVisitDate?: string`, `howHeard?`, `contactConsent?: boolean`, `pdpaConsentAt?`, `active: boolean`, `mergedInto?: string`, `createdAt` |
| `households` | auto | `ownerUid?: string`, `createdAt` |
| `users` | auth uid | `personId`, `householdId`, `roles: Role[]` (writable by admin only), `lang?` |
| `groups` | auto | `name`, `leaderUids: string[]`, `memberPersonIds: string[]` |
| `meetings` | auto (Sunday: `sunday-YYYY-MM-DD`) | `type: 'sunday'\|'group'\|'event'`, `title`, `date` (KL), `groupId?`, `checkinMode: 'always'\|'window'`, `windowStart?`, `windowEnd?` (Timestamps), `createdBy`, `createdAt` |
| `attendance` | `${meetingId}_${personId}` | `meetingId`, `personId`, `date`, `method: 'scanner'\|'self'\|'visitorForm'`, `byUid?`, `at` |
| `offerings` | auto | `uid`, `personId`, `householdId`, `date` (KL), `amountSen`, `category`, `createdAt`, `updatedAt` |
| `offerings/{id}/history` | auto | `byUid`, `at`, `oldAmountSen`, `newAmountSen`, `oldCategory`, `newCategory`, `deleted: boolean` |
| `settings` | `church` | `paymentQrPath`, `sunday: { weekday: 0, start: 'HH:mm', end: 'HH:mm', checkinMode }`, `offeringCategories: string[]` (default `['一般奉献 General']`) |

Storage: `settings/payment-qr` (admin write, signed-in read).

---

### Task 1: Project scaffold, i18n, Firebase wiring

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `firebase.json`, `.firebaserc`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/routes.tsx`, `src/firebase.ts`, `src/i18n/index.ts`, `src/i18n/zh.ts`, `src/i18n/en.ts`, `public/icons/*`
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `t(key: MessageKey, vars?: Record<string,string|number>): string`; `useT(): { t, lang, setLang(l: 'zh'|'en') }`; `type MessageKey = keyof typeof zh` (en must satisfy `Record<MessageKey,string>` at compile time); `auth`, `db`, `storage`, `functions` exports from `src/firebase.ts`; `call<TReq,TRes>(name: string, data: TReq): Promise<TRes>` wrapper over `httpsCallable` in `src/firebase.ts`.

- [ ] **Step 1:** Scaffold Vite React-TS app; add deps listed in Tech Stack; scripts: `dev`, `build`, `test` (vitest), `test:rules`, `test:functions`, `emulators` (`firebase emulators:start --only auth,firestore,functions,storage,hosting`), `e2e`. `.firebaserc` default project `church-attendance-dev` placeholder. Root `package.json` uses npm workspaces `["functions"]`.
- [ ] **Step 2: Write failing tests** in `src/i18n/i18n.test.ts`: `t('app.title')` is `'教会签到'` when lang zh and `'Church Check-in'` when en; `t('greeting', {name:'Mary'})` interpolates `{name}`; `setLang` survives `localStorage` throwing (mock `getItem/setItem` to throw → no exception, lang still changes in memory).
- [ ] **Step 3:** Run `npm test` — FAIL (module missing).
- [ ] **Step 4:** Implement i18n (plain dictionaries + React context). `src/firebase.ts`: init from `import.meta.env.VITE_FIREBASE_*`; Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`; region `asia-southeast1` for functions; connect emulators when `import.meta.env.VITE_USE_EMULATORS === 'true'`; App Check with `ReCaptchaEnterpriseProvider(VITE_RECAPTCHA_KEY)` skipped under emulators. `vite-plugin-pwa` manifest: name `教会签到 Church Check-in`, `display: 'standalone'`, theme color, 192/512 icons. App shell has a header language toggle (中 / EN).
- [ ] **Step 5:** `npm test` PASS; `npm run build` succeeds.
- [ ] **Step 6:** Commit `feat: scaffold PWA with i18n and firebase wiring`.

### Task 2: Shared domain logic

**Files:**
- Create: `shared/types.ts`, `shared/dates.ts`, `shared/phone.ts`, `shared/money.ts`, `shared/qr.ts`, `shared/checkin.ts`
- Test: `shared/dates.test.ts`, `shared/phone.test.ts`, `shared/money.test.ts`, `shared/qr.test.ts`, `shared/checkin.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Role`, `Person`, `Household`, `UserDoc`, `Group`, `Meeting`, `Attendance`, `Offering`, `ChurchSettings` exactly per the data model table (timestamps typed as `Date` in shared; converters live in app/functions).
  - `klDate(d: Date): string` → `YYYY-MM-DD` in Asia/Kuala_Lumpur.
  - `normalizeMyPhone(input: string): { ok: true; e164: string } | { ok: false; error: 'invalid' }` — accepts MY mobile (`01x`, 9–10 digits after leading 0) and landline-free; strips spaces/dashes/`+`.
  - `parseAmountToSen(input: string): { ok: true; sen: number } | { ok: false; error: 'invalid'|'zero'|'tooLarge' }`; max RM 100,000.00; `formatSen(sen: number, lang): string` → `RM 1,000.00`.
  - `personalQrPayload(personId: string): string` → `cqr:p:${personId}`; `parsePersonalQr(text: string): string | null`.
  - `attendanceId(meetingId: string, personId: string): string` → `${meetingId}_${personId}`.
  - `isCheckinOpen(m: Meeting, now: Date): boolean` — `always`: `klDate(now) === m.date`; `window`: `windowStart <= now <= windowEnd`.
  - `resolveCurrentMeeting(meetings: Meeting[], now: Date): Meeting | null` — among open meetings prefer `sunday`, then earliest `windowStart`; null if none.

- [ ] **Step 1: Write failing tests**
  - dates: `klDate(new Date('2026-10-17T16:30:00Z')) === '2026-10-18'`; `klDate(new Date('2026-10-18T15:59:00Z')) === '2026-10-18'`.
  - phone: each of `'012-345 6789'`, `'0123456789'`, `'+60 12-345 6789'`, `'60123456789'` → `'+60123456789'`; `'011-1234 5678'` → `'+601112345678'`; `'12345'`, `'+6591234567'`, `''` → `{ok:false}`.
  - money: `'50'`→5000, `'50.5'`→5050, `'RM 1,000.00'`→100000, `' 20 '`→2000; `'0'`→zero, `'-5'`/`'abc'`/`'50.555'`→invalid, `'100000.01'`→tooLarge; `formatSen(100000,'en') === 'RM 1,000.00'`.
  - qr: round-trip; `parsePersonalQr('https://evil.com')` null; `parsePersonalQr('cqr:p:')` null.
  - checkin: `always` meeting dated `2026-10-18` open at `2026-10-17T16:30Z`, closed at `2026-10-18T16:30Z`; window meeting open at exact `windowStart` and `windowEnd`, closed one minute after; `resolveCurrentMeeting` returns the sunday meeting when a group meeting is also open; returns null for empty list.
- [ ] **Step 2:** `npx vitest run shared` — FAIL.
- [ ] **Step 3:** Implement. Use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })` for `klDate`. Money parsing on strings with a regex (`^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$` after stripping `RM` and spaces); no float math.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: shared domain logic (dates, phone, money, qr, checkin)`.

### Task 3: Firestore & Storage security rules

**Files:**
- Create: `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- Test: `rules-test/firestore.rules.test.ts`, `rules-test/storage.rules.test.ts` (run via `firebase emulators:exec --only firestore,storage "vitest run rules-test"`)

**Interfaces:**
- Consumes: data model table; `attendanceId` format.
- Produces: rule helpers `roles()`, `hasRole(r)`, `isLeaderOf(groupId)`, `myHousehold()` that later tasks rely on behaviorally (no code import).

Rules to encode:
- `users/{uid}`: read self, or admin. Self may create/update only `lang` (and nothing on create — creation is by `ensureProfile`). Admin may update `roles`. Nobody else writes.
- `people/{id}`: read if same household, or role in [scanner, leader, admin, finance]. Household owner may create people in their own household with exactly `name`, `kind`, `householdId`, `active:true`, `visitCount:0`, `createdAt==request.time`, and `status` equal to the owner's own person `status`; owner may later update only `name`, `kind`, `active`. Owner can never set `phone`, `accountUid`, `visitCount`, `mergedInto`. Admin may write any field.
- `households`: read own; admin all. Writes via functions/admin only.
- `groups`: read signed-in; write admin; leaders may update `memberPersonIds` of groups where `request.auth.uid in leaderUids`.
- `meetings`: read signed-in; create/update by admin, or leader when `groupId` is a group they lead and `type=='group'`.
- `attendance/{aid}`: read own household's records; scanner/admin/finance read all; leader reads where meeting's group is theirs. **Create** by scanner/admin (any meeting) or leader (own group meetings) only if `aid == meetingId + '_' + personId`, `method=='scanner'`, `byUid==request.auth.uid`, and doc does not exist. No updates; delete admin only. (Self check-in goes through the function.)
- `offerings/{id}`: create by signed-in user when `uid==auth.uid`, `personId`/`householdId` match their `users` doc, `amountSen` int in `1..10000000`, `createdAt==request.time`. Read own (`uid==auth.uid`) or finance/admin. Owner update/delete only within 24h of `createdAt` and only `amountSen`/`category`/`updatedAt`. Finance edits go through the function. `history` subcollection: read finance/admin; no client writes.
- `settings/church`: read signed-in; write admin.
- Storage `settings/payment-qr`: read signed-in; write admin, image/*, < 2 MB.

- [ ] **Step 1: Write failing tests** (seed with `withSecurityRulesDisabled`): member cannot read another household's offering; scanner cannot read any offering; finance can read all offerings; member cannot set own `roles`; admin can; scanner creates `attendance/m1_p1` once, second create fails (**Review Focus 1**); scanner create with mismatched id fails; leader cannot create attendance for a meeting of a group they don't lead; member cannot create attendance at all; member creates offering with `amountSen: 5050` succeeds, with `0`, `5.5`, or someone else's `uid` fails; owner update after 25h fails; household owner adds child with `kind:'child'` succeeds but setting `status:'member'` fails; non-admin storage upload to `settings/payment-qr` fails.
- [ ] **Step 2:** Run `npm run test:rules` — FAIL (default deny).
- [ ] **Step 3:** Write rules.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: firestore and storage security rules with tests`.

### Task 4: Functions — profile & newcomer form

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `functions/src/lib/auth.ts`, `functions/src/profile.ts`, `functions/src/visitor.ts`, `scripts/grant-admin.ts`
- Test: `functions/test/profile.test.ts`, `functions/test/visitor.test.ts` (against emulators; call handlers through the Functions emulator with a signed-in test user from the Auth emulator)

**Interfaces:**
- Consumes: `normalizeMyPhone`, `klDate`, `resolveCurrentMeeting`, `attendanceId` from `shared/`.
- Produces (callables, region `asia-southeast1`):
  - `ensureProfile({ name?: string }) → { personId, householdId, needsName: boolean }`. Uses `request.auth.token.phone_number`. If `users/{uid}` exists → return it. Else find `people` where `phone == e164` and no `accountUid` and `active` → attach (`accountUid=uid`, household `ownerUid=uid`). Else if `name` missing → `{needsName:true}` without writing; else create household + person (`status:'visitor'`, `kind:'adult'`, `visitCount:0`). Then create `users/{uid}` with `roles: []`.
  - `submitVisitorForm({ name, phone, familyNames?: string[], howHeard?: string, contactConsent: boolean, pdpaConsent: true }) → { personId, visitNumber: number, checkedIn: boolean }`. No auth required; `enforceAppCheck: true` (off in emulator). Reject if `pdpaConsent !== true` or phone invalid. Find person by phone → if found and `lastVisitDate !== today` increment `visitCount`, set `lastVisitDate`; if same day, do not increment. If not found → new household + person (`status:'visitor'`, `firstVisitDate=today`, `visitCount:1`) + child/adult family entries as `kind:'adult'` people without phone. Record attendance (`method:'visitorForm'`) for every new/known household member listed, against `resolveCurrentMeeting` of today's meetings; if none open, `checkedIn:false`. Rate limit: max 5 submissions per phone per day (counter doc `rateLimits/visitor_${e164}_${date}`).
  - `requireRole(request, roles: Role[]): Promise<UserDoc>` in `lib/auth.ts` — throws `HttpsError('permission-denied')`.
  - `scripts/grant-admin.ts`: `npx tsx scripts/grant-admin.ts +60123456789` — uses Admin SDK with ADC; looks up auth user by phone, adds `'admin'` to `users/{uid}.roles`; prints a clear error if the user has never logged in.

- [ ] **Step 1: Write failing tests**: new phone without name → `needsName:true` and no docs written; with name → person+household+user created; phone matching an existing visitor person attaches instead of creating (one person total); calling twice is idempotent. Visitor: first submit → `visitNumber:1`, attendance `sunday-2026-10-18_<pid>` exists when a Sunday meeting is open; second submit same day → still `visitNumber:1`, no duplicate attendance; submit next week → `visitNumber:2`; `pdpaConsent:false` → `invalid-argument`; phone `'12345'` → `invalid-argument`; 6th submit same day → `resource-exhausted`.
- [ ] **Step 2:** Run `npm run test:functions` — FAIL.
- [ ] **Step 3:** Implement with `firebase-functions/v2/https` `onCall`, Firestore transactions for the find-or-create paths.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: ensureProfile and newcomer form functions`.

### Task 5: Functions — self check-in & weekly Sunday

**Files:**
- Create: `functions/src/checkin.ts`, `functions/src/sunday.ts`
- Test: `functions/test/checkin.test.ts`, `functions/test/sunday.test.ts`

**Interfaces:**
- Consumes: `isCheckinOpen`, `resolveCurrentMeeting`, `attendanceId`, `klDate`.
- Produces:
  - `selfCheckIn({ meetingId?: string, personIds: string[] }) → { meetingId, meetingTitle, results: { personId, status: 'ok'|'already' }[] }`. Requires auth + `users` doc. Every `personId` must belong to caller's household, else `permission-denied`. If `meetingId` given, it must be open (`failed-precondition`, message key `checkin.closed`); else resolve current meeting among meetings with `date == today`; none → `failed-precondition` `checkin.noMeeting`. Writes with `create()` (existing → `'already'`).
  - `createUpcomingSunday` — `onSchedule('every saturday 00:05', timeZone 'Asia/Kuala_Lumpur')`; pure helper `sundayMeetingFor(settings: ChurchSettings, now: Date): Meeting` exported for tests; idempotent via doc ID `sunday-YYYY-MM-DD`. Also export callable `createSundayNow()` (admin) for first setup.

- [ ] **Step 1: Write failing tests**: member checks in self + child → two `ok`; repeat → both `already` (**Review Focus 1**); includes a personId from another household → `permission-denied`, nothing written; window meeting closed → `failed-precondition`; no meeting today → `checkin.noMeeting`; `sundayMeetingFor` on Sat 2026-10-17 with `start '09:00', end '11:30', checkinMode 'window'` returns id `sunday-2026-10-18`, windowStart `2026-10-18T01:00:00Z`; calling scheduler body twice leaves one doc.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: self check-in and weekly Sunday meeting functions`.

### Task 6: Functions — merge people & finance edits

**Files:**
- Create: `functions/src/admin.ts`
- Test: `functions/test/admin.test.ts`

**Interfaces:**
- Produces:
  - `mergePeople({ fromPersonId, intoPersonId }) → { movedAttendance: number, movedOfferings: number }` — admin only. Moves attendance to `attendanceId(meetingId, into)` (skip if exists), repoints offerings' `personId`, sums `visitCount`, keeps earliest `firstVisitDate`, sets `from.active=false, mergedInto=into`. If `from.accountUid` set and `into.accountUid` set → `failed-precondition`. Covers "family member gets own phone" (admin merges the old child record into the new account's person).
  - `financeEditOffering({ offeringId, amountSen?, category?, delete?: boolean }) → { ok: true }` — finance/admin. Writes a `history` doc in the same transaction; delete marks `deleted:true` in history and deletes the offering.
  - `deleteMyData({ confirm: 'DELETE' }) → { ok: true }` — PDPA right to deletion, caller only. Deletes caller's household people, their attendance, `users/{uid}`, household, and the Auth user. Offerings are kept for the church's accounts but anonymized: `uid`, `personId`, `householdId` set to `'deleted'`. Admin equivalent `deletePersonData({ personId })` for visitors who ask in person.

- [ ] **Step 1: Write failing tests**: `deleteMyData` removes people/attendance/users docs and leaves the household's offerings with `personId:'deleted'` and amounts intact; `deleteMyData` without `confirm:'DELETE'` → `invalid-argument`; merge moves 3 attendance docs, collision on same meeting keeps one; merge by non-admin → `permission-denied`; two account holders → `failed-precondition`; finance edit 5000→6000 creates history `{oldAmountSen:5000,newAmountSen:6000}`; scanner calling edit → `permission-denied`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: admin merge and finance offering edit functions`.

### Task 7: Phone login & profile setup UI

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/LoginPage.tsx`, `src/auth/ProfileSetup.tsx`, `src/auth/RequireRole.tsx`
- Modify: `src/routes.tsx`, `src/i18n/zh.ts`, `src/i18n/en.ts`
- Test: `src/auth/LoginPage.test.tsx`, `src/auth/RequireRole.test.tsx`

**Interfaces:**
- Consumes: `call('ensureProfile')`, `normalizeMyPhone`.
- Produces: `useAuth(): { status: 'loading'|'signedOut'|'needsName'|'ready', uid?, user?: UserDoc, person?: Person, roles: Role[], signOut() }` (live `onSnapshot` of `users/{uid}`); `<RequireRole any={Role[]}>`; `<RequireAuth>` that remembers the intended path (e.g. `/checkin?m=…`) and returns to it after login.

- [ ] **Step 1: Write failing tests** (React Testing Library, Firebase mocked): invalid phone shows `t('login.invalidPhone')` and does not call `signInWithPhoneNumber`; valid `012-345 6789` calls it with `+60123456789`; `RequireRole any={['finance']}` renders children for finance, renders `t('common.noPermission')` for a member.
- [ ] **Step 2:** FAIL. **Step 3:** Implement: invisible `RecaptchaVerifier`; 6-digit code screen with resend after 60 s; `auth/invalid-verification-code` and `auth/too-many-requests` map to translated messages; after sign-in call `ensureProfile`, route to `ProfileSetup` when `needsName`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: phone login and profile setup`.

### Task 8: Member home, personal QR, family

**Files:**
- Create: `src/member/HomePage.tsx`, `src/member/QrCard.tsx`, `src/member/FamilyPage.tsx`
- Test: `src/member/FamilyPage.test.tsx`, `src/member/QrCard.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `personalQrPayload`.
- Produces: `<QrCard person={Person} />` (renders `qrcode` to canvas, large, high contrast, name under it; brightness hint).

- [ ] **Step 1: Write failing tests**: `QrCard` encodes `cqr:p:<id>` (spy on `QRCode.toCanvas`); FamilyPage add form requires name and a choice of 成人/小孩 (radio), writes `people` doc with `householdId` of owner and `kind`; family list shows each member's QR on tap.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Home shows: my QR, family QRs (swipe/tabs), buttons 签到 / 奉献 / 我的记录, and role-gated links (签到员, 管理, 财务). "我的记录": last 20 attendance rows for the household. "我的资料" shows every stored field of the household's people (PDPA access) and a "删除我的资料" button that requires typing DELETE and calls `deleteMyData`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: member home, personal QR and family members`.

### Task 9: Door scanner

**Files:**
- Create: `src/checkin/ScannerPage.tsx`, `src/checkin/FamilyPicker.tsx`, `src/checkin/offlineStatus.ts`
- Test: `src/checkin/ScannerPage.test.tsx`, `src/checkin/offlineStatus.test.ts`

**Interfaces:**
- Consumes: `parsePersonalQr`, `attendanceId`, rules from Task 3.
- Produces: `<FamilyPicker people={Person[]} defaultAll onConfirm(ids: string[]) />` (reused in Task 10); `recordScan(meetingId, personIds, byUid): Promise<{personId, status:'ok'|'already'|'queued'}[]>` in `offlineStatus.ts`.

Behavior: guarded by `RequireRole any={['scanner','leader','admin']}`. Pick meeting (today's meetings; leaders see only their groups'). Continuous scanning with `qr-scanner` (rear camera). Scan of an account holder's QR whose household has >1 active person → `FamilyPicker` (all ticked, one tap confirm). Scan of a family member's own QR → record just that person. Show name + ✓ for 1.5 s, then resume. Same QR within 3 s ignored client-side. `recordScan` checks `getDoc(attendance)` from cache first → `'already'`; when `navigator.onLine === false` it calls `setDoc` without awaiting the server and returns `'queued'`.

- [ ] **Step 1: Write failing tests**: non-personal QR shows `t('scan.notChurchQr')`; scanning same payload twice within 3 s triggers one write; `recordScan` returns `'already'` when doc exists; with `navigator.onLine=false` returns `'queued'` and UI shows `t('scan.savedOffline')` = "已记录（离线，稍后同步）" (**Review Focus 4**).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: door scanner with family picker and offline queue`.

### Task 10: Self check-in page

**Files:**
- Create: `src/checkin/SelfCheckinPage.tsx`
- Test: `src/checkin/SelfCheckinPage.test.tsx`

**Interfaces:**
- Consumes: `call('selfCheckIn')`, `FamilyPicker`, `RequireAuth`.

Route `/checkin` (optional `?m=meetingId` for group/event posters). Single-person household → check in immediately on load. Otherwise `FamilyPicker` (all ticked). Result screen: meeting title, each name with ✓ 已签到 / 已经签过. `checkin.closed` → "不在签到时间内"; `checkin.noMeeting` → "今天没有进行中的聚会".

- [ ] **Step 1: Write failing tests**: single-person household calls `selfCheckIn` once with `[personId]` on mount; multi-person shows picker, unticking one sends only the rest; error `failed-precondition` with `checkin.closed` renders the translated closed message.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: member self check-in`.

### Task 11: Newcomer welcome form

**Files:**
- Create: `src/welcome/WelcomePage.tsx`
- Modify: i18n files (PDPA notice text both languages)
- Test: `src/welcome/WelcomePage.test.tsx`

Route `/welcome`, no login. Fields: 名字 (required), 电话 (required, validated by `normalizeMyPhone`), 同行家人 (repeatable name inputs), 怎样认识教会 (optional select: 朋友介绍 / 家人 / 网络 / 路过 / 其他), 可以联络我 (checkbox), PDPA notice + required consent checkbox. Submit button disabled until required fields valid. Success: "欢迎你！这是你第 N 次来" + "下次可以用这个电话号码登录 App".

PDPA notice copy (zh; en equivalent): "你提供的名字和电话只用于教会记录出席及联络关怀，不会提供给第三方。你可以随时要求查看或删除你的资料。"

- [ ] **Step 1: Write failing tests**: submit disabled without PDPA tick; invalid phone shows message; successful submit calls `submitVisitorForm` with normalized `phone` and `pdpaConsent:true`, then shows visit number.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: newcomer welcome form with PDPA consent`.

### Task 12: Offering

**Files:**
- Create: `src/offering/OfferingPage.tsx`, `src/offering/MyOfferings.tsx`
- Test: `src/offering/OfferingPage.test.tsx`

**Interfaces:**
- Consumes: `parseAmountToSen`, `formatSen`, `klDate`, `settings/church`, Storage `settings/payment-qr`.

Page flow: step 1 show DuitNow QR image large with "长按保存 / 截图后在银行 App 扫描" hint and a button "我已转账，记录金额"; step 2 amount input (`inputMode="decimal"`) + category select (from settings) → add `offerings` doc. My records list with edit/delete shown only within 24 h of `createdAt`. If no QR uploaded yet: "管理员还没设定收款 QR 码".

- [ ] **Step 1: Write failing tests**: input `RM 1,000` writes `amountSen:100000` and `date` = `klDate(now)`; input `0` shows `t('offering.zero')` and writes nothing; edit button hidden for a record created 25 h ago.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: offering page with DuitNow QR and self-reported amounts`.

### Task 13: Admin — people, roles, merge, newcomers

**Files:**
- Create: `src/admin/PeoplePage.tsx`, `src/admin/PersonEditor.tsx`, `src/admin/NewcomersPage.tsx`
- Test: `src/admin/PeoplePage.test.tsx`, `src/admin/NewcomersPage.test.tsx`

All under `RequireRole any={['admin']}`.
- People list: search by name/phone, filter by status; shows household grouping.
- Person editor: "删除此人资料" (confirm) → `deletePersonData`; name, kind, status (新朋友/常来的朋友/正式会友), phone (admin "create account for someone": create household + person with phone; when that phone logs in, `ensureProfile` attaches), active toggle, roles checkboxes (only for people with `accountUid`; writes `users/{uid}.roles`), "合并到…" picker calling `mergePeople` with a confirmation dialog showing both names.
- Newcomers page: people with `status=='visitor'` sorted by `lastVisitDate` desc; columns 名字, 电话, 第几次来, 首次来访, 最近来访, 多久没来 (days), 可联络.

- [ ] **Step 1: Write failing tests**: toggling `finance` role writes `roles` containing `'finance'`; roles section hidden for a person without `accountUid`; newcomers page computes "多久没来" = 7 for `lastVisitDate` one week before today (KL); merge dialog calls `mergePeople` only after confirm.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: admin people, roles, merge and newcomers`.

### Task 14: Admin — meetings, groups, posters, settings

**Files:**
- Create: `src/admin/MeetingsPage.tsx`, `src/admin/GroupsPage.tsx`, `src/admin/PosterPage.tsx`, `src/admin/SettingsPage.tsx`
- Test: `src/admin/MeetingsPage.test.tsx`, `src/admin/SettingsPage.test.tsx`

- Meetings: list by date; create group/event meeting (title, date, group for leaders, check-in mode 长期有效 / 限时 with start/end). Leaders see and create only for their groups. Button "立即建立本周主日" calls `createSundayNow`.
- Groups (admin): create group, assign leaders (from account holders) and members (any person). Leaders can edit members of their own groups.
- Poster page (printable, A4, `@media print`): (a) 签到 QR → `${origin}/checkin`; (b) 新朋友 QR → `${origin}/welcome`; (c) per-meeting QR → `${origin}/checkin?m=${id}`. Bilingual caption under each.
- Settings: upload DuitNow QR (image, ≤2 MB, preview), Sunday weekday/start/end/mode, offering categories list.

- [ ] **Step 1: Write failing tests**: creating a 限时 meeting without end time shows validation error; leader's meeting form only lists their groups; uploading a 3 MB file shows `t('settings.fileTooLarge')` and does not upload.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: admin meetings, groups, posters and settings`.

### Task 15: Attendance rates & Excel export

**Files:**
- Create: `shared/stats.ts`, `shared/export.ts`, `src/finance/ExportPage.tsx`, `src/finance/OfferingsPage.tsx`, `src/finance/writeXlsx.ts`
- Test: `shared/stats.test.ts`, `shared/export.test.ts`

**Interfaces:**
- Produces:
  - `attendanceRates(input: { people: Person[]; meetings: Meeting[]; attendance: Attendance[]; groups: Group[]; from: string; to: string }): { personRates: { personId, attended, expected, rate }[]; groupRates: { groupId, rate }[] }` — expected Sundays = Sunday meetings in range on/after the person's `firstVisitDate` (or `createdAt` date); expected group meetings = meetings of groups listing the person. Visitors excluded from `groupRates`; rate `null` when expected is 0.
  - `buildExportSheets(input & { offerings: Offering[] }): { name: string; rows: (string|number|null)[][] }[]` — four sheets with these headers (bilingual): 出席记录 `日期 Date | 聚会 Meeting | 名字 Name | 方式 Method`; 奉献记录 `日期 | 名字 | 类别 | 金额 RM`; 合并表 `名字 | 日期 | 聚会 | 出席 | 当天奉献 RM` (one row per person × meeting; offering on that date's Sunday row, otherwise a row with meeting `—`); 出席率 `名字 | 身份 | 出席 | 应出席 | 出席率`. Amounts as numbers in RM (sen/100).
  - `downloadXlsx(sheets, filename)` in `writeXlsx.ts` — dynamic `import('exceljs')`, bold header row, frozen first row, RM number format `#,##0.00`.

- [ ] **Step 1: Write failing tests**: person first visiting on the 3rd of 4 Sundays with 2 attended → `expected 2, rate 1`; person with no expected meetings → `rate null`; offering RM 50 on a Sunday appears on that Sunday's merged row as `50`; offering on a Wednesday appears in a `—` row; family child attendance appears under the child's name.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; `ExportPage` (finance/admin) picks a date range (default this month), queries by `date` range, calls `downloadXlsx(…, 'church-YYYY-MM-DD_YYYY-MM-DD.xlsx')`. `OfferingsPage` lists offerings with edit/delete via `financeEditOffering`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: attendance rates and Excel export`.

### Task 16: Setup guide, deploy, smoke test

**Files:**
- Create: `docs/SETUP.md`, `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (scripts `deploy`, `e2e`)

`docs/SETUP.md` in 中文, step by step with where to click: create Firebase project (region `asia-southeast1`); upgrade to Blaze with the developer's card; **budget alert RM 20/month**; Authentication → Phone enabled; **SMS region policy: allow only Malaysia (MY)**; Firestore + Storage created; App Check with reCAPTCHA Enterprise; copy web config into `.env.local` (`VITE_FIREBASE_*`, `VITE_RECAPTCHA_KEY`); `firebase login`, `npm run deploy` (`npm run build && firebase deploy`); log in once on the phone, then `npx tsx scripts/grant-admin.ts +60…`; first steps in Admin (upload DuitNow QR, set Sunday time, `立即建立本周主日`, print posters); how to later transfer the project to the church (add church Google account as Owner, switch billing account). Also note: before going live, check Firebase's current SMS price for Malaysia on the pricing page.

- [ ] **Step 1: Write the smoke test** (Playwright on Chromium, against emulators with seeded data and Auth-emulator phone codes): log in as admin with `+60123456789` → set Sunday + create meeting → log in as member → self check-in shows ✓ → scanner page records the child via family picker → finance export downloads a file whose name starts with `church-` → switching to EN changes the home title to "Church Check-in".
- [ ] **Step 2:** `npm run e2e` — FAIL until wiring complete; fix gaps.
- [ ] **Step 3:** PASS; also `npm test`, `npm run test:rules`, `npm run test:functions`, `npm run build` all green.
- [ ] **Step 4:** Commit `docs: setup guide; test: e2e smoke`.

---

## Left to the implementer
Visual design and layout (mobile-first, large touch targets, readable for older members), component library choice (none required), exact i18n key names beyond those cited, icon artwork, Firestore index definitions as queries require.
