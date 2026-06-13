# MoneyTrack / FinTrack Backend

Backend MoneyTrack / FinTrack là REST API cho đồ án INT1334 Lập trình Web. Hệ thống phục vụ quản lý thu chi cá nhân, báo cáo, AI Advisor, notification, BankHub Sandbox và webhook SePay.

## Tech Stack

- Node.js, Express 5, CommonJS
- PostgreSQL, Prisma ORM, Prisma migrations/seed
- JWT access token và refresh token
- Zod validation
- bcryptjs, cookie-parser, CORS
- PDFKit và ExcelJS cho export báo cáo
- Jest cho backend tests
- Gemini API cho AI Advisor, có fallback rule-based khi thiếu key/lỗi quota

## Kiến Trúc

Backend theo luồng:

```text
Route -> Controller -> Service -> Prisma -> PostgreSQL
```

- `src/routes`: khai báo REST endpoint và middleware auth/admin.
- `src/controllers`: parse request, validate input, trả JSON response/status code.
- `src/services`: business logic, ownership checks, transaction DB, AI, BankHub, webhook.
- `src/validators`: Zod schemas.
- `src/middlewares`: auth middleware, validation, error handling.
- `prisma/schema.prisma`: database schema.
- `prisma/migrations`: migration history.
- `prisma/seed.js`: seed demo accounts, categories, budgets, transactions.

## Cài Đặt Local

Yêu cầu:

- Node.js 20+
- PostgreSQL local/cloud
- npm

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

API local mặc định chạy tại `http://localhost:5000`.

## Biến Môi Trường

Xem [.env.example](./.env.example). Nhóm biến chính:

| Nhóm | Biến |
| --- | --- |
| Database | `DATABASE_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_EXCHANGE_SECRET` |
| App/CORS | `PORT`, `FRONTEND_URL`, `CORS_ORIGIN`, `APP_NAME` |
| Email OTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` |
| AI | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| SePay webhook | `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANKHUB_IPN_API_KEY` |
| BankHub Sandbox | `BANKHUB_API_BASE_URL`, `BANKHUB_CLIENT_ID`, `BANKHUB_CLIENT_SECRET`, `BANKHUB_COMPANY_NAME`, `BANKHUB_COMPANY_XID`, `BANKHUB_USER_AGENT`, `BANKHUB_REQUEST_TIMEOUT_MS` |
| Manual bank link fallback | `SYSTEM_BANK_NAME`, `SYSTEM_BANK_ACCOUNT`, `SYSTEM_BANK_HOLDER` |

Không commit `.env` hoặc secret thật.

## Prisma

```bash
npx prisma migrate dev      # áp dụng migrations local
npx prisma generate         # generate Prisma Client
npx prisma db seed          # seed demo data
npx prisma studio           # mở Prisma Studio nếu cần
```

Demo accounts sau khi seed:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@moneytrack.local` | `12345678` |
| User | `user@moneytrack.local` | `12345678` |

## Scripts

```bash
npm run dev                 # nodemon src/app.js
npm start                   # node src/app.js
npm test                    # jest
npm run build --if-present  # backend hiện không cần build step
```

## API Endpoint Table

Tất cả response JSON nên có dạng `{ success, data }` hoặc `{ success: false, message }`. Các route bên dưới trừ auth/public/webhook đều cần JWT nếu route đã gắn `authMiddleware`.

| Nhóm | Method | Endpoint | Mô tả |
| --- | --- | --- | --- |
| Auth | POST | `/auth/register/request-otp` | Gửi OTP đăng ký. |
| Auth | POST | `/auth/register` | Tạo user local. |
| Auth | POST | `/auth/login` | Đăng nhập local. |
| Auth | POST | `/auth/google` | Exchange Google profile từ frontend. |
| Auth | POST | `/auth/refresh` | Cấp access token mới. |
| Auth | POST | `/auth/forgot-password` | Gửi OTP reset password. |
| Auth | POST | `/auth/forgot-password/verify-otp` | Xác thực OTP reset. |
| Auth | POST | `/auth/reset-password` | Đặt lại mật khẩu. |
| Auth | POST | `/auth/logout` | Đăng xuất. |
| Auth | GET | `/auth/me` | Lấy user hiện tại. |
| Users | GET | `/api/users/me` | Hồ sơ user. |
| Users | PATCH | `/api/users/me` | Cập nhật hồ sơ. |
| Users | PATCH | `/api/users/me/balance` | Cập nhật số dư. |
| Users | PATCH | `/api/users/me/password` | Đổi mật khẩu. |
| Users | PATCH | `/api/users/me/sepay-sandbox-link` | Cập nhật link SePay sandbox. |
| Transactions | GET | `/api/transactions` | Danh sách giao dịch. |
| Transactions | POST | `/api/transactions` | Tạo giao dịch thủ công. |
| Transactions | GET | `/api/transactions/:id` | Chi tiết giao dịch. |
| Transactions | PUT | `/api/transactions/:id` | Cập nhật giao dịch. |
| Transactions | DELETE | `/api/transactions/:id` | Xóa giao dịch của chính user. |
| Transactions | PATCH | `/api/transactions/:id/classify` | Phân loại giao dịch. |
| Transactions | PATCH | `/api/transactions/:id/exclude` | Bỏ qua giao dịch SePay khỏi báo cáo. |
| Categories | GET | `/api/categories` | Danh sách danh mục. |
| Categories | POST | `/api/categories` | Tạo danh mục. |
| Categories | PUT | `/api/categories/:id` | Cập nhật danh mục. |
| Categories | DELETE | `/api/categories/:id` | Xóa danh mục. |
| Budgets | GET | `/api/budgets` | Danh sách ngân sách. |
| Budgets | POST | `/api/budgets` | Tạo ngân sách. |
| Budgets | PUT | `/api/budgets/:id` | Cập nhật ngân sách. |
| Budgets | DELETE | `/api/budgets/:id` | Xóa ngân sách. |
| Reports | GET | `/api/reports/summary` | Tổng hợp thu/chi. |
| Reports | GET | `/api/reports/chart` | Dữ liệu chart. |
| Reports | GET | `/api/reports/export?format=pdf` | Export PDF. |
| Reports | GET | `/api/reports/export?format=excel` | Export Excel. |
| AI | GET | `/api/ai/status` | Trạng thái AI provider. |
| AI | POST | `/api/ai/advice` | Tạo lời khuyên tài chính. |
| AI | POST | `/api/ai/chat` | Chatbot tài chính. |
| AI | GET | `/api/ai/history` | Lịch sử AI. |
| Notifications | GET | `/api/notifications` | Danh sách notification user. |
| Notifications | PATCH | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc. |
| Notifications | PATCH | `/api/notifications/:id/read` | Đánh dấu một notification đã đọc. |
| Notifications | DELETE | `/api/notifications/:id` | Xóa notification. |
| Feedback | POST | `/api/feedback` | User gửi feedback. |
| Bank Link | POST | `/api/bank-link` | Liên kết bank link thủ công. |
| Bank Link | POST | `/api/bank-link/regenerate` | Sinh lại mã bank link. |
| Bank Link | GET | `/api/bank-link` | Lấy bank link hiện tại. |
| Bank Link | DELETE | `/api/bank-link` | Hủy bank link. |
| BankHub | POST | `/api/bankhub/hosted-link` | Tạo hosted link BankHub. |
| BankHub | POST | `/api/bankhub/sync-linked-account` | Đồng bộ tài khoản liên kết. |
| BankHub | GET | `/api/bankhub/status` | Refresh trạng thái BankHub. |
| BankHub | PATCH | `/api/bankhub/unlink-local` | Hủy liên kết local. |
| BankHub | GET | `/api/bankhub/linked-accounts` | Admin lấy linked accounts BankHub. |
| Admin | GET | `/api/admin/platform-statistics` | Thống kê nền tảng. |
| Admin | POST | `/api/admin/bankhub-sandbox/transactions` | Tạo giao dịch BankHub sandbox. |
| Admin | GET | `/api/admin/sepay-logs` | Xem SePay logs. |
| Admin | GET | `/api/admin/linked-users` | User đã liên kết BankHub. |
| Admin | POST | `/api/admin/notifications` | Tạo notification. |
| Admin | GET | `/api/admin/notifications` | Danh sách notification admin. |
| Admin | PATCH | `/api/admin/notifications/read-all` | Đánh dấu notification admin đã đọc. |
| Admin | GET | `/api/admin/feedback` | Danh sách feedback. |
| Admin | PATCH | `/api/admin/feedback/:id/status` | Cập nhật trạng thái feedback. |
| Admin | PATCH | `/api/admin/users/:userId/bankhub-account` | Gán BankHub account cho user. |
| Admin | PATCH | `/api/admin/users/:userId/bankhub-unlink-local` | Hủy BankHub local cho user. |
| SePay Webhook | POST | `/api/webhooks/sepay-bankhub` | Webhook SePay/BankHub tạo transaction, log, notification. |
| Public | GET | `/api/public/statistics` | Public statistics cho SSG/ISR frontend. |
| Public | GET | `/api/public/health` | Health check/status. |

## Advanced Features

- PDF/Excel export bằng PDFKit/ExcelJS, hỗ trợ tiếng Việt và format VND.
- AI Advisor/Chatbot gọi Gemini nếu có key, fallback an toàn khi thiếu key/quota.
- BankHub Sandbox để admin mô phỏng giao dịch ngân hàng.
- SePay webhook xử lý giao dịch, chống duplicate, tạo log và notification.
- Notification polling qua frontend NotificationBell.
- Charts lấy dữ liệu từ report endpoints.
- Jest unit tests với Prisma mocked, không gọi DB production.

## Deployment Guide

### Render

1. Tạo PostgreSQL database hoặc dùng database cloud sẵn có.
2. Tạo Web Service từ repo backend.
3. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`.
4. Start command: `npm start`.
5. Thêm env vars từ `.env.example` bằng giá trị production.
6. Set `FRONTEND_URL` và `CORS_ORIGIN` về domain frontend.
7. Sau deploy lần đầu, chạy seed thủ công nếu cần demo: `npx prisma db seed`.

### Railway

1. Tạo project Railway, thêm PostgreSQL plugin.
2. Set `DATABASE_URL` từ Railway PostgreSQL.
3. Deploy backend service từ repo.
4. Start command: `npm start`.
5. Chạy `npx prisma migrate deploy` trong deploy command hoặc Railway shell.
6. Cấu hình webhook URL trên SePay: `https://<backend-domain>/api/webhooks/sepay-bankhub`.

## Demo Script Bảo Vệ

1. Chạy backend, migrate và seed.
2. Login user `user@moneytrack.local`.
3. Mở Dashboard xem tổng quan.
4. Tạo/xem chi tiết/phân loại/xóa giao dịch.
5. Export Reports PDF/Excel.
6. Gọi AI Advisor/Chatbot.
7. Login admin `admin@moneytrack.local`.
8. Mở Admin BankHub Sandbox, chọn user đã liên kết, tạo giao dịch sandbox.
9. Xem `/api/admin/sepay-logs` trên UI admin.
10. Quay lại user, kiểm tra NotificationBell nhận thông báo mới.

## Postman / API Docs

Chưa có Postman collection trong repo. Có thể tạo collection theo bảng endpoint ở trên, cấu hình base URL:

```text
{{baseUrl}} = http://localhost:5000
{{accessToken}} = token nhận từ /auth/login
```

Các route bảo vệ cần header:

```http
Authorization: Bearer {{accessToken}}
```
