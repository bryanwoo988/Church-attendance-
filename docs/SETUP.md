# 上线设置指南（第一次部署）

这份指南带你从零开始，把 App 放到网上。全程大约 45–60 分钟。需要：一台电脑、一个 Google 账号、一张信用卡（Firebase Blaze 方案用）。

> 目前项目放在你自己的 Google 账号下。教会以后正式采用时，见最后一节「转给教会」。

---

## 1. 开 Firebase 项目

1. 打开 <https://console.firebase.google.com>，用你的 Google 账号登录。
2. 按 **「建立项目」**，名字例如 `church-attendance`。Google Analytics 可以关掉。
3. 建好后，记下 **项目 ID**（项目设定 → 一般，例如 `church-attendance-1a2b3`）。

## 2. 升级到 Blaze 方案并设预算提醒（一定要做）

1. 左下角 **「Spark」** → **「升级」** → 选 **Blaze**，绑定你的信用卡。
2. 升级后，打开 <https://console.cloud.google.com/billing> → 选这个结算账号 → **预算和提醒** → **建立预算**：
   - 金额：**RM 20 / 月**（或你能接受的数字）
   - 提醒：50%、90%、100% 时发邮件
3. 预算提醒只会通知，不会自动停止扣费；收到邮件时请上来看看是什么用量。

## 3. 打开电话号码登录，并限定只发短信到马来西亚

1. Firebase 控制台 → **Authentication** → **开始使用** → **登录方式** → 启用 **电话**。
2. Authentication → **设定** → **SMS 地区政策**（SMS region policy）→ 选 **允许**，只勾选 **Malaysia (MY)**。这样可以防止有人用外国号码大量触发短信刷你的钱。
3. Authentication → 设定 → **已授权网域**：部署后把你的网址（例如 `church-attendance-1a2b3.web.app`）加进去（通常会自动加）。
4. 上线前，在 Firebase 价格页（<https://firebase.google.com/pricing>）确认发往马来西亚的短信单价。

## 4. 建立 Firestore 数据库

1. Firebase 控制台 → **Firestore Database** → **建立数据库**。
2. 位置选 **asia-southeast1 (Singapore)**（离马来西亚最近，之后不能改）。
3. 选 **正式版模式**（规则会由我们部署覆盖）。
4. 设定自动清除：Firestore Database → **TTL**（存留时间）→ **建立政策** → 集合群组填 `rateLimits`，时间戳栏位填 `expiresAt`。这样新朋友表格的防滥用计数会在两天后自动删除。

## 5. App Check（保护新朋友表格，一定要做）

新朋友表格不用登录，所以要用 App Check 挡掉机器人。没设定的话，新朋友表格会提交失败。

1. 打开 <https://console.cloud.google.com/security/recaptcha>（选同一个项目）→ **建立金钥** → 类型 **网站**，网域填你的网址（例如 `church-attendance-1a2b3.web.app`）。记下 **金钥 ID**。
2. Firebase 控制台 → **App Check** → 选你的 Web App → **reCAPTCHA Enterprise** → 贴上金钥 ID → 储存。
3. App Check → **API** → Cloud Functions 先保持「未强制」也可以（我们的函数自己会检查）。

## 6. 取得网页设定

1. Firebase 控制台 → 项目设定 → **你的应用程式** → 按 **</>**（网页）→ 名字随意 → 注册。
2. 会看到一段 `firebaseConfig`。在项目根目录复制 `.env.example` 为 `.env.local`，把数值填进去：

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_RECAPTCHA_KEY=（第 5 步的金钥 ID）
VITE_USE_EMULATORS=false
```

3. 把 `.firebaserc` 里的 `church-attendance-dev` 改成你的项目 ID。

## 7. 部署

电脑需要安装 Node.js 22。在项目目录：

```bash
npm install
npx firebase login
npm run deploy
```

完成后会显示网址，例如 `https://church-attendance-1a2b3.web.app`。

第一次部署函数时，Google 可能会要求启用几个 API（Cloud Functions、Cloud Build、Cloud Scheduler、Artifact Registry），照提示按「启用」再部署一次即可。

## 8. 设定第一位管理员

1. 用手机打开网址，用你的电话号码登录，填名字。
2. 打开 Firebase 控制台 → Firestore Database → `users` 集合 → 找到你的那一笔（`personId` 对应你的名字）→ 把 `roles` 栏位改成包含 `admin` 的阵列：`["admin"]`。
3. 回到 App 重新整理，就会看到「同工功能」。

（会用指令的话，也可以：`gcloud auth application-default login` 后执行 `GOOGLE_CLOUD_PROJECT=你的项目ID npx tsx scripts/grant-admin.ts +60123456789`。）

之后其他人的权限，都在 App 里的 **会友管理** 设定，不用再进 Firebase。

## 9. 在 App 里做第一次设定

1. **设定** → 上传教会 **DuitNow 收款 QR 码** 图片。
2. **设定** → 主日聚会星期几、签到开始 / 结束时间、要不要限时。
3. **聚会** → 按 **「立即建立本周主日」**（以后每个星期六凌晨会自动建立下一个主日）。
4. **打印海报** → 打印「签到」和「新朋友」两张，贴在门口和迎新处。
5. **会友管理** → 给签到员、财务、小组长勾选权限。

## 10. 手机加到主屏幕

- **iPhone（Safari）**：分享按钮 → 加入主画面。
- **Android（Chrome）**：右上角 ⋮ → 安装应用程式 / 加到主画面。

---

## 转给教会（教会正式采用时）

1. Firebase 控制台 → 项目设定 → **使用者和权限** → 新增教会的 Google 账号，角色 **Owner**。
2. <https://console.cloud.google.com/billing> → 把项目改连到教会的结算账号（教会的信用卡）。
3. 你可以继续留在项目里当 Owner 或 Editor。
4. 网址、资料、代码都不用改。

## 本地开发与测试（给开发者）

```bash
npm test                 # 单元测试
npm run test:rules       # 数据库权限规则测试（需要 Java）
npm run test:functions   # 服务器函数测试
npm run e2e              # 端到端测试（emulator + Chromium）
npm run emulators        # 本地 emulator
```
