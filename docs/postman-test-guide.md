# MoneyTrack Postman Test Guide

This guide tests the implemented MoneyTrack backend APIs in a full user flow.

## 0. Postman environment variables

Create a Postman environment, then add these variables:

| Variable | Initial value | Current value |
| --- | --- | --- |
| `baseUrl` | `http://localhost:5000` | `http://localhost:5000` |
| `accessToken` | empty | empty |
| `adminAccessToken` | empty | empty |
| `userSepayCode` | empty | empty |
| `expenseCategoryId` | empty | empty |
| `sepayTransactionId` | empty | empty |

All authenticated requests use:

```http
Authorization: Bearer {{accessToken}}
```

Admin requests use:

```http
Authorization: Bearer {{adminAccessToken}}
```

## A. Register normal user

Method: `POST`

URL:

```http
{{baseUrl}}/auth/register
```

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "name": "Demo User",
  "email": "user@test.com",
  "password": "12345678"
}
```

Expected response:

```json
{
  "success": true,
  "data": {
    "user": {
      "role": "USER",
      "sepayCode": "MTU..."
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

Check:

- `success` is `true`
- `data.user` exists
- `data.user.sepayCode` exists, for example `MTU001` or another `MTU...` value

Optional Tests tab:

```javascript
const json = pm.response.json();
pm.test("Register success", () => pm.expect(json.success).to.eql(true));
pm.test("User has sepayCode", () => pm.expect(json.data.user.sepayCode).to.match(/^MTU/));
```

## B. Login normal user

Method: `POST`

URL:

```http
{{baseUrl}}/auth/login
```

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "email": "user@test.com",
  "password": "12345678"
}
```

Expected response:

- `success` is `true`
- `data.accessToken` exists
- `data.user.role` is `USER`
- `data.user.sepayCode` exists

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Login success", () => pm.expect(json.success).to.eql(true));
pm.test("Access token returned", () => pm.expect(json.data.accessToken).to.be.a("string"));
pm.test("User role is USER", () => pm.expect(json.data.user.role).to.eql("USER"));
pm.test("User sepayCode exists", () => pm.expect(json.data.user.sepayCode).to.match(/^MTU/));

pm.environment.set("accessToken", json.data.accessToken);
pm.environment.set("userSepayCode", json.data.user.sepayCode);
```

## C. Get current user

Method: `GET`

URL:

```http
{{baseUrl}}/auth/me
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- `success` is `true`
- `data.role` is `USER`
- `data.sepayCode` exists

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Get me success", () => pm.expect(json.success).to.eql(true));
pm.test("Role is USER", () => pm.expect(json.data.role).to.eql("USER"));
pm.test("Sepay code exists", () => pm.expect(json.data.sepayCode).to.match(/^MTU/));
```

## D. Create or get expense category

First, you can list existing categories.

Method: `GET`

URL:

```http
{{baseUrl}}/api/categories
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

If you already have an `EXPENSE` category, copy its `id` into the Postman environment variable `expenseCategoryId`.

To create a category:

Method: `POST`

URL:

```http
{{baseUrl}}/api/categories
```

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "name": "Ăn uống",
  "type": "EXPENSE",
  "icon": "🍔",
  "color": "#ef4444"
}
```

Expected response:

- `success` is `true`
- `data.id` exists
- `data.type` is `EXPENSE`

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Category created", () => pm.expect(json.success).to.eql(true));
pm.test("Expense category", () => pm.expect(json.data.type).to.eql("EXPENSE"));

pm.environment.set("expenseCategoryId", json.data.id);
```

Note: if the backend validator does not persist `color`, that is OK for this flow; `id`, `name`, `type`, and `icon` are the important fields.

## E. Create manual expense transaction

Method: `POST`

URL:

```http
{{baseUrl}}/api/transactions
```

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "categoryId": "{{expenseCategoryId}}",
  "type": "EXPENSE",
  "amount": 100000,
  "note": "Ăn trưa",
  "transactionDate": "2026-06-03T10:00:00.000Z"
}
```

Expected response:

- `success` is `true`
- `data.source` is `MANUAL`
- `data.categoryId` is not `null`

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Transaction created", () => pm.expect(json.success).to.eql(true));
pm.test("Source is MANUAL", () => pm.expect(json.data.source).to.eql("MANUAL"));
pm.test("Category is set", () => pm.expect(json.data.categoryId).to.not.eql(null));
```

## F. Create monthly budget

Method: `POST`

URL:

```http
{{baseUrl}}/api/budgets
```

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "categoryId": "{{expenseCategoryId}}",
  "limitAmount": 1000000,
  "period": "MONTHLY",
  "month": 6,
  "year": 2026
}
```

Expected response:

- `success` is `true`
- budget is created
- `data.limitAmount` is `1000000`
- computed fields exist: `spentAmount`, `remainingAmount`, `percentUsed`, `status`

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Budget created", () => pm.expect(json.success).to.eql(true));
pm.test("Budget has computed fields", () => {
  pm.expect(json.data).to.have.property("spentAmount");
  pm.expect(json.data).to.have.property("remainingAmount");
  pm.expect(json.data).to.have.property("percentUsed");
  pm.expect(json.data).to.have.property("status");
});
```

## G. Get budgets

Method: `GET`

URL:

```http
{{baseUrl}}/api/budgets?month=6&year=2026
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- `success` is `true`
- one budget exists for `expenseCategoryId`
- `spentAmount` includes the manual expense
- `percentUsed` is calculated
- `status` is `SAFE`, `WARNING`, or `EXCEEDED`

Tests tab:

```javascript
const json = pm.response.json();
const budget = json.data.find(item => item.categoryId === pm.environment.get("expenseCategoryId"));

pm.test("Budgets loaded", () => pm.expect(json.success).to.eql(true));
pm.test("Budget for category exists", () => pm.expect(budget).to.exist);
pm.test("Spent includes manual expense", () => pm.expect(Number(budget.spentAmount)).to.be.at.least(100000));
pm.test("Percent used is calculated", () => pm.expect(Number(budget.percentUsed)).to.be.at.least(10));
pm.test("Status is valid", () => pm.expect(["SAFE", "WARNING", "EXCEEDED"]).to.include(budget.status));
```

## H. Register or prepare admin user

If your register endpoint supports `role`, create an admin directly. In the current implementation, registration creates `USER`, so prepare an admin account like this:

1. Register a second user:

Method: `POST`

URL:

```http
{{baseUrl}}/auth/register
```

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "name": "Admin User",
  "email": "admin@test.com",
  "password": "12345678"
}
```

2. Open Prisma Studio:

```bash
npx prisma studio
```

3. Find `admin@test.com` in the `User` table.
4. Set `role` to `ADMIN`.
5. Save the row.

Expected:

- admin user exists
- `user.role` is `ADMIN`

## I. Login admin

Method: `POST`

URL:

```http
{{baseUrl}}/auth/login
```

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "email": "admin@test.com",
  "password": "12345678"
}
```

Expected response:

- `success` is `true`
- `data.accessToken` exists
- `data.user.role` is `ADMIN`

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Admin login success", () => pm.expect(json.success).to.eql(true));
pm.test("Admin access token returned", () => pm.expect(json.data.accessToken).to.be.a("string"));
pm.test("Role is ADMIN", () => pm.expect(json.data.user.role).to.eql("ADMIN"));

pm.environment.set("adminAccessToken", json.data.accessToken);
```

## J. Test Admin SePay Simulator

Method: `POST`

URL:

```http
{{baseUrl}}/api/admin/sepay-simulator
```

Headers:

```http
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

Body:

```json
{
  "sepayId": "SEPAY_TEST_001",
  "gateway": "MBBank",
  "transferAmount": 200000,
  "transferType": "OUT",
  "content": "{{userSepayCode}} DEMO AN UONG",
  "transactionDate": "2026-06-03T11:00:00.000Z"
}
```

Expected response:

- `success` is `true`
- matched user is found through `content`
- transaction is created
- `data.transaction.source` is `SEPAY`
- `data.transaction.categoryId` is `null`

Tests tab:

```javascript
const json = pm.response.json();

pm.test("SePay simulator success", () => pm.expect(json.success).to.eql(true));
pm.test("SePay processed", () => pm.expect(json.data.status).to.eql("PROCESSED"));
pm.test("Transaction created", () => pm.expect(json.data.transaction.id).to.be.a("string"));
pm.test("Transaction source is SEPAY", () => pm.expect(json.data.transaction.source).to.eql("SEPAY"));
pm.test("Transaction category is null", () => pm.expect(json.data.transaction.categoryId).to.eql(null));

pm.environment.set("sepayTransactionId", json.data.transaction.id);
```

## K. Test duplicate SePay

Send the same simulator request again with the same `sepayId`.

Method: `POST`

URL:

```http
{{baseUrl}}/api/admin/sepay-simulator
```

Headers:

```http
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

Body:

```json
{
  "sepayId": "SEPAY_TEST_001",
  "gateway": "MBBank",
  "transferAmount": 200000,
  "transferType": "OUT",
  "content": "{{userSepayCode}} DEMO AN UONG",
  "transactionDate": "2026-06-03T11:00:00.000Z"
}
```

Expected response:

- `success` is `true`
- duplicate message or status is returned
- no second transaction is created

Tests tab:

```javascript
const json = pm.response.json();

pm.test("Duplicate detected", () => {
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.status).to.eql("DUPLICATE");
});
```

## L. Get transactions

Method: `GET`

URL:

```http
{{baseUrl}}/api/transactions
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- `success` is `true`
- at least one transaction has `source = SEPAY`
- SePay transaction has `categoryId = null`
- SePay transaction has `sepayId = SEPAY_TEST_001`

Tests tab:

```javascript
const json = pm.response.json();
const transactions = json.data.transactions || json.data;
const sepayTx = transactions.find(item => item.sepayId === "SEPAY_TEST_001");

pm.test("Transactions loaded", () => pm.expect(json.success).to.eql(true));
pm.test("SePay transaction exists", () => pm.expect(sepayTx).to.exist);
pm.test("SePay transaction source", () => pm.expect(sepayTx.source).to.eql("SEPAY"));
pm.test("SePay transaction category is null", () => pm.expect(sepayTx.categoryId).to.eql(null));
```

## M. Classify SePay transaction

Method: `PUT`

URL:

```http
{{baseUrl}}/api/transactions/{{sepayTransactionId}}
```

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "categoryId": "{{expenseCategoryId}}",
  "type": "EXPENSE",
  "amount": 200000,
  "note": "Phân loại giao dịch SePay",
  "transactionDate": "2026-06-03T11:00:00.000Z"
}
```

Expected response:

- `success` is `true`
- `data.categoryId` is updated to `expenseCategoryId`
- `data.source` remains `SEPAY` if the implementation preserves source on update

Tests tab:

```javascript
const json = pm.response.json();

pm.test("SePay transaction classified", () => pm.expect(json.success).to.eql(true));
pm.test("Category updated", () => {
  pm.expect(json.data.categoryId).to.eql(pm.environment.get("expenseCategoryId"));
});
pm.test("Source remains SEPAY", () => pm.expect(json.data.source).to.eql("SEPAY"));
```

## N. Get budgets again

Method: `GET`

URL:

```http
{{baseUrl}}/api/budgets?month=6&year=2026
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- `success` is `true`
- `spentAmount` increases from `100000` to `300000`
- `percentUsed` updates to `30` when `limitAmount` is `1000000`

Tests tab:

```javascript
const json = pm.response.json();
const budget = json.data.find(item => item.categoryId === pm.environment.get("expenseCategoryId"));

pm.test("Budget updated after classification", () => pm.expect(json.success).to.eql(true));
pm.test("Spent amount is 300000", () => pm.expect(Number(budget.spentAmount)).to.eql(300000));
pm.test("Percent used is 30", () => pm.expect(Number(budget.percentUsed)).to.eql(30));
```

## O. Get SePay logs

Method: `GET`

URL:

```http
{{baseUrl}}/api/admin/sepay-logs
```

Headers:

```http
Authorization: Bearer {{adminAccessToken}}
```

Expected response:

- `success` is `true`
- response contains `SEPAY_TEST_001`
- log has `processed = true`
- `transactionId` exists

Tests tab:

```javascript
const json = pm.response.json();
const logs = json.data.logs || json.data;
const log = logs.find(item => item.sepayId === "SEPAY_TEST_001");

pm.test("SePay logs loaded", () => pm.expect(json.success).to.eql(true));
pm.test("SePay log exists", () => pm.expect(log).to.exist);
pm.test("Log processed", () => pm.expect(log.processed).to.eql(true));
pm.test("Transaction id exists", () => pm.expect(log.transactionId).to.be.a("string"));
```

## P. Export Excel

Method: `GET`

URL:

```http
{{baseUrl}}/api/reports/export?format=excel&month=6&year=2026
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- response is an `.xlsx` file
- `Content-Type` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Postman can save the response to file
- file is not empty

Postman steps:

1. Click `Send and Download`.
2. Save as `moneytrack-report.xlsx`.
3. Open the file and verify it contains sheets `Giao dịch` and `Tóm tắt`.

Tests tab:

```javascript
pm.test("Excel content type", () => {
  pm.expect(pm.response.headers.get("Content-Type")).to.include(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
});
pm.test("Excel response is not empty", () => pm.expect(pm.response.responseSize).to.be.above(0));
```

## Q. Export PDF

Method: `GET`

URL:

```http
{{baseUrl}}/api/reports/export?format=pdf&month=6&year=2026
```

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Expected response:

- response is `application/pdf`
- Postman can save the response to file
- file is not empty

Postman steps:

1. Click `Send and Download`.
2. Save as `moneytrack-report.pdf`.
3. Open the file and verify it contains summary and transaction list.

Tests tab:

```javascript
pm.test("PDF content type", () => {
  pm.expect(pm.response.headers.get("Content-Type")).to.include("application/pdf");
});
pm.test("PDF response is not empty", () => pm.expect(pm.response.responseSize).to.be.above(0));
```

## R. AI Advisor

Method: `POST`

URL:

```http
{{baseUrl}}/api/ai/advice
```

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "month": 6,
  "year": 2026
}
```

Expected response:

- `success` is `true`
- response returns `summary`
- response returns `riskLevel`
- response returns `insights`
- response returns `suggestions`
- response returns `savingGoal`
- works even without `GEMINI_API_KEY` by using fallback advice

Tests tab:

```javascript
const json = pm.response.json();

pm.test("AI Advisor success", () => pm.expect(json.success).to.eql(true));
pm.test("Summary returned", () => pm.expect(json.data.summary).to.exist);
pm.test("Risk level returned", () => pm.expect(json.data.riskLevel).to.be.a("string"));
pm.test("Insights returned", () => pm.expect(json.data.insights).to.be.an("array"));
pm.test("Suggestions returned", () => pm.expect(json.data.suggestions).to.be.an("array"));
pm.test("Saving goal returned", () => pm.expect(json.data.savingGoal).to.exist);
```

## Optional. External SePay webhook

Use this only when `.env` has `SEPAY_WEBHOOK_SECRET`.

Method: `POST`

URL:

```http
{{baseUrl}}/api/webhooks/sepay
```

Headers:

```http
Content-Type: application/json
x-sepay-secret: your_sepay_webhook_secret
```

Body:

```json
{
  "sepayId": "SEPAY_WEBHOOK_001",
  "gateway": "MBBank",
  "transferAmount": 150000,
  "transferType": "IN",
  "content": "{{userSepayCode}} WEBHOOK TEST",
  "transactionDate": "2026-06-03T12:00:00.000Z"
}
```

Expected response:

- `success` is `true`
- `data.status` is `PROCESSED`
- transaction is created with `source = SEPAY`

## Troubleshooting

### 401 Unauthorized

Check that the request has the correct header:

```http
Authorization: Bearer {{accessToken}}
```

For admin routes, use:

```http
Authorization: Bearer {{adminAccessToken}}
```

Log in again if the token is empty or expired.

### 403 Forbidden on admin route

The authenticated user is not `ADMIN`. Open Prisma Studio:

```bash
npx prisma studio
```

Set the admin account `role` to `ADMIN`, save, then log in again and refresh `{{adminAccessToken}}`.

### Prisma error with `categoryId` null

The nullable transaction category migration was not applied, or Prisma Client was not regenerated.

Run:

```bash
npx prisma migrate dev
npx prisma generate
```

### Export crashes on null category

The report code still assumes `transaction.category` always exists. Confirm export code uses fallback display values for unclassified transactions:

- name: `Chưa phân loại`
- icon: `📦`

### SePay unmatched

Check the simulator or webhook `content`. It must contain the exact user SePay code:

```json
{
  "content": "{{userSepayCode}} DEMO AN UONG"
}
```

Also confirm `{{userSepayCode}}` is set in the Postman environment.

### Duplicate not working

Use the exact same `sepayId` twice:

```json
{
  "sepayId": "SEPAY_TEST_001"
}
```

Duplicate prevention depends on the unique `sepayId` and the service checking `SepayLog` before creating a transaction.

### `DATABASE_URL` missing

Add a local `.env` file with:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/moneytrack
JWT_ACCESS_SECRET=your_access_secret_key_min_32_chars_change_this
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_chars_change_this
SEPAY_WEBHOOK_SECRET=your_sepay_webhook_secret
PORT=5000
```

Then run:

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Final checklist

- [ ] Register/login works
- [ ] User has `sepayCode`
- [ ] Budget CRUD works
- [ ] SePay simulator creates one transaction
- [ ] Duplicate `sepayId` does not create a second transaction
- [ ] User can classify SePay transaction
- [ ] Budget updates after classification
- [ ] Export Excel/PDF works
- [ ] AI Advisor fallback works
