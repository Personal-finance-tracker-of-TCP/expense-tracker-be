# MoneyTrack API Test Guide

Base URL:

```bash
BASE_URL=http://localhost:5000
```

## 1. Register normal user

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Normal User","email":"user@example.com","password":"Password123"}'
```

Copy `data.accessToken` as `USER_TOKEN` and `data.user.sepayCode` as `USER_SEPAY_CODE`.

```bash
USER_TOKEN=replace_with_user_access_token
USER_SEPAY_CODE=replace_with_user_sepay_code
```

## 2. Login user

```bash
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}'
```

## 3. Create and get categories

```bash
curl -s -X POST "$BASE_URL/api/categories" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"An trua","icon":"🍜","type":"EXPENSE"}'
```

Copy `data.id` as `EXPENSE_CATEGORY_ID`.

```bash
EXPENSE_CATEGORY_ID=replace_with_category_id

curl -s "$BASE_URL/api/categories" \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 4. Create manual transaction

```bash
curl -s -X POST "$BASE_URL/api/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"EXPENSE\",\"amount\":50000,\"categoryId\":\"$EXPENSE_CATEGORY_ID\",\"note\":\"Lunch\",\"transactionDate\":\"2026-06-02T09:00:00.000Z\"}"
```

## 5. Create budget

```bash
curl -s -X POST "$BASE_URL/api/budgets" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$EXPENSE_CATEGORY_ID\",\"limitAmount\":200000,\"period\":\"MONTHLY\",\"month\":6,\"year\":2026}"
```

## 6. Get budget list

```bash
curl -s "$BASE_URL/api/budgets" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Verify `spentAmount`, `remainingAmount`, `percentUsed`, and `status`.

## 7. Admin login

Create an admin user, then set its role in the database:

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@example.com","password":"Password123"}'
```

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin@example.com';
```

```bash
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123"}'
```

Copy `data.accessToken` as `ADMIN_TOKEN`.

```bash
ADMIN_TOKEN=replace_with_admin_access_token
```

## 8. Call SePay simulator

```bash
curl -s -X POST "$BASE_URL/api/admin/sepay-simulator" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sepayId\":\"SEPAY_TEST_001\",\"gateway\":\"MBBank\",\"transferAmount\":200000,\"transferType\":\"OUT\",\"content\":\"$USER_SEPAY_CODE DEMO AN TRUA\",\"transactionDate\":\"2026-06-02T10:00:00.000Z\"}"
```

## 9. Get transactions and verify SePay transaction

```bash
curl -s "$BASE_URL/api/transactions?month=6&year=2026" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Verify one transaction has `source=SEPAY` and `categoryId=null`.

## 10. Classify SePay transaction

Copy the SePay transaction `id` as `SEPAY_TRANSACTION_ID`.

```bash
SEPAY_TRANSACTION_ID=replace_with_sepay_transaction_id

curl -s -X PUT "$BASE_URL/api/transactions/$SEPAY_TRANSACTION_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$EXPENSE_CATEGORY_ID\"}"
```

## 11. Get budgets again

```bash
curl -s "$BASE_URL/api/budgets" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Verify the budget spend changed after classifying the SePay transaction.

## 12. Export Excel

```bash
curl -L "$BASE_URL/api/reports/export?format=excel&month=6&year=2026" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -o moneytrack-report.xlsx
```

Verify sheets `Giao dịch` and `Tóm tắt` exist.

## 13. Export PDF

```bash
curl -L "$BASE_URL/api/reports/export?format=pdf&month=6&year=2026" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -o moneytrack-report.pdf
```

## 14. Call AI Advisor

```bash
curl -s -X POST "$BASE_URL/api/ai/advice" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month":6,"year":2026}'
```

If `GEMINI_API_KEY` is not set, verify `data.source` is `fallback`.

## 15. Test duplicate SePay payload

```bash
curl -s -X POST "$BASE_URL/api/admin/sepay-simulator" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sepayId\":\"SEPAY_TEST_001\",\"gateway\":\"MBBank\",\"transferAmount\":200000,\"transferType\":\"OUT\",\"content\":\"$USER_SEPAY_CODE DEMO AN TRUA\",\"transactionDate\":\"2026-06-02T10:00:00.000Z\"}"
```

Verify `data.status` is `DUPLICATE`, then re-run the transactions query and confirm no second transaction was created.

## 16. Get SePay logs

```bash
curl -s "$BASE_URL/api/admin/sepay-logs" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## External webhook smoke test

Set `SEPAY_WEBHOOK_SECRET` in `.env`, then:

```bash
curl -s -X POST "$BASE_URL/api/webhooks/sepay" \
  -H "x-sepay-secret: your_sepay_webhook_secret" \
  -H "Content-Type: application/json" \
  -d "{\"sepayId\":\"SEPAY_WEBHOOK_001\",\"gateway\":\"MBBank\",\"transferAmount\":100000,\"transferType\":\"IN\",\"content\":\"$USER_SEPAY_CODE WEBHOOK TEST\",\"transactionDate\":\"2026-06-02T11:00:00.000Z\"}"
```
