# BackOffice NG

A production-grade company backoffice management platform built for Nigerian businesses. Built with Node.js, Express, and MongoDB.

---

## Features

- **Authentication** — JWT access tokens + refresh token rotation via HTTP-only cookies
- **Dynamic RBAC** — Create resources and permissions at runtime, assign to roles, assign roles to users
- **Employee Management** — Hire, manage, and terminate employees with auto-generated employee IDs
- **Department Management** — Nested department structure with department heads
- **Payroll** — Process, approve, and mark payroll as paid with Nigerian allowances and deductions
- **Leave Management** — Request, approve, and reject leave with overlap detection
- **Audit Logs** — Every mutating request is automatically logged with device and location info
- **Suspicious Activity Detection** — Flags repeated forbidden attempts, bulk deletions, odd-hours access
- **Dashboard & Stats** — Overview, HR, payroll, leave analytics, and activity feed
- **Notifications** — Real-time in-app notifications via Server-Sent Events (SSE)
- **CSV Export** — Background export of employees, payroll, leave, and audit logs
- **PDF Generation** — Background generation of payslips, payroll reports, leave and audit reports
- **Email Notifications** — Transactional emails for all key business events
- **Background Jobs** — Redis-backed Bull queues for PDF, CSV, and email processing
- **Security** — Rate limiting, account lockout, password reset, NoSQL injection prevention

---

## Tech Stack

```
Runtime        Node.js 20
Framework      Express
Database       MongoDB + Mongoose
Auth           JWT + bcryptjs
Queue          Bull + Redis
PDF            Puppeteer + Handlebars
Email          Nodemailer + Handlebars
Geolocation    geoip-lite
UA Parsing     ua-parser-js
Validation     Joi
Unique IDs     uuid
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB 7+
- Redis

### Installation

```bash
git clone https://github.com/phonixcode/backoffice.git
cd backoffice-ng
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Fill in your `.env`:

```bash
PORT=9000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/backoffice

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

# App
CLIENT_URL=http://localhost:3000
```

### Run

```bash
# development
npm run dev

# production
npm start
```

### Seed Database

```bash
# base data — resources, roles, super admin
npm run seed

# dev data — employees, payroll, leave, audit logs
npm run seed:dev

# wipe and reseed fresh
npm run seed:dev -- --fresh
```

---

## Default Credentials

After running `npm run seed`:

```
Email:    superadmin@backoffice.com
Password: SuperAdmin@123
```

> Change this immediately in production.

---

## Project Structure

```
src/
├── config/             — DB connection, env, mailer, seeder
├── jobs/
│   ├── queue.js        — Bull queue definitions (pdf, csv, email)
│   └── processors/
│       ├── pdf.processor.js
│       ├── csv.processor.js
│       └── email.processor.js
├── middleware/         — authenticate, authorize, audit logger, rate limiter, sanitize
├── modules/
│   ├── auth/           — login, register, refresh, logout, password reset
│   ├── users/          — user management, role assignment
│   ├── roles/          — role CRUD, permission assignment
│   ├── resources/      — dynamic resource + permission creation
│   ├── employees/      — employee lifecycle
│   ├── departments/    — department management
│   ├── payroll/        — payroll processing
│   ├── leave/          — leave requests
│   ├── audit/          — audit logs, suspicious activity
│   ├── dashboard/      — stats and analytics
│   ├── notifications/  — SSE real-time notifications
│   ├── exports/        — CSV export (background)
│   ├── pdf/            — PDF generation (background)
│   └── email/          — email templates + service
├── routes/
│   ├── index.js        — root + health endpoints
│   └── v1/api.js       — all v1 routes
└── utils/              — asyncHandler, apiResponse, paginate, getRoutes
```

---

## API Overview

Base URL: `/api/v1`

| Resource       | Endpoint                   |
|----------------|----------------------------|
| Auth           | `/api/v1/auth`             |
| Users          | `/api/v1/users`            |
| Roles          | `/api/v1/roles`            |
| Resources      | `/api/v1/resources`        |
| Employees      | `/api/v1/employees`        |
| Departments    | `/api/v1/departments`      |
| Payroll        | `/api/v1/payroll`          |
| Leave          | `/api/v1/leave`            |
| Audit Logs     | `/api/v1/audit`            |
| Dashboard      | `/api/v1/dashboard`        |
| Notifications  | `/api/v1/notifications`    |
| CSV Export     | `/api/v1/export`           |
| PDF Reports    | `/api/v1/pdf`              |

Full route list available at `GET /`.

### Authentication

All protected routes require:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in 15 minutes. Use `POST /api/v1/auth/refresh` to get a new one via the refresh token cookie.

### Pagination

All list endpoints support:
```
?page=1&limit=10
```

Default limit is 10, maximum is 100. Responses include:
```json
{
  "pagination": {
    "total": 1469,
    "page": 1,
    "limit": 10,
    "pages": 147,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Background Jobs

Heavy tasks are processed in the background via Bull queues backed by Redis. The server responds instantly with a `jobId` — the client is notified via SSE and email when the job completes.

### PDF Generation

```bash
# queue a payslip (requires payroll ID)
POST /api/v1/pdf/payslip/:payrollId

# queue a payroll report (month + year required)
POST /api/v1/pdf/payroll-report?month=12&year=2024

# queue a leave report
POST /api/v1/pdf/leave-report?status=approved

# queue an audit report
POST /api/v1/pdf/audit-report?startDate=2024-01-01&endDate=2024-12-31

# check job status
GET /api/v1/pdf/job/:jobId

# download completed PDF
GET /api/v1/pdf/download/:filename
```

### CSV Export

```bash
# queue employee export
POST /api/v1/export/employees

# queue payroll export
POST /api/v1/export/payroll?month=12&year=2024

# queue leave export
POST /api/v1/export/leave?status=approved

# queue audit log export
POST /api/v1/export/audit-logs

# check job status
GET /api/v1/export/job/:jobId

# download completed CSV
GET /api/v1/export/download/:filename
```

Generated files are stored in `storage/pdfs/` and `storage/csv/` and automatically deleted after 24 hours.

---

## Real-time Notifications (SSE)

Connect once on app load — notifications are pushed instantly when events occur:

```bash
GET /api/v1/notifications/stream
Authorization: Bearer <token>
```

### Notification targeting

| Type        | Description                              |
|-------------|------------------------------------------|
| `userId`    | Personal — only the specific user        |
| `role`      | All users with a specific role           |
| `broadcast` | Everyone                                 |

### Events that trigger notifications

```
Leave submitted    → HR managers notified
Leave approved     → Employee notified
Leave rejected     → Employee notified
Payroll processed  → Finance managers notified
Payroll approved   → Finance managers notified
Salary paid        → Employee notified
PDF ready          → Requesting user notified
CSV ready          → Requesting user notified
```

---

## Email Notifications

All emails are queued via Bull and sent asynchronously — never blocking a request.

| Event                  | Recipient         | Template              |
|------------------------|-------------------|-----------------------|
| Forgot password        | User              | Reset link            |
| Password reset success | User              | Security confirmation |
| Account locked         | User              | Security alert        |
| New employee created   | Employee          | Welcome + credentials |
| Employee terminated    | Employee          | Offboarding notice    |
| Salary paid            | Employee          | Payslip summary       |
| Leave approved         | Employee          | Approval confirmation |
| Leave rejected         | Employee          | Rejection notice      |
| Leave submitted        | HR managers       | Approval request      |
| PDF/CSV ready          | Requesting user   | Download link         |

---

## Security

- **Rate limiting** — global 100 req/15min, auth 10 req/15min, password reset 5 req/hour
- **Account lockout** — 5 failed attempts → 30 minute lock + email alert
- **Password reset** — secure SHA-256 hashed token, expires in 30 minutes
- **Token invalidation** — `tokenVersion` on user document invalidates all sessions on password change
- **Refresh token rotation** — new token issued on every refresh, old one revoked
- **NoSQL injection** — custom sanitizer strips MongoDB operators from all input
- **HTTP param pollution** — `hpp` prevents duplicate query param abuse
- **Security headers** — Helmet with tuned CSP and HSTS
- **Request size limit** — 10kb body limit

---

## Roles

| Role             | Description                          |
|------------------|--------------------------------------|
| `super_admin`    | Full system access                   |
| `hr_manager`     | Employees, departments, leave        |
| `finance_manager`| Payroll processing and approval      |
| `dept_manager`   | Team management and leave approval   |
| `senior_employee`| Extended read access                 |
| `employee`       | Basic access — default role          |
| `auditor`        | Read-only audit and reports          |
| `intern`         | Minimal read-only access             |

---

## Dashboard Endpoints

```bash
GET /api/v1/dashboard/overview   — company snapshot + growth rates
GET /api/v1/dashboard/hr         — headcount, hires, terminations, trends
GET /api/v1/dashboard/payroll    — monthly totals, dept salary ranges
GET /api/v1/dashboard/leave      — pending queue, analytics, trends
GET /api/v1/dashboard/activity   — audit feed + suspicious alerts
```

---

## Scripts

```bash
npm run dev                  # start with nodemon
npm start                    # start production
npm run seed                 # seed base data
npm run seed:dev             # seed dev data
npm run seed:dev -- --fresh  # wipe and reseed
```

---

## Health Check

```
GET /health
```

Returns uptime, memory usage (heap %), CPU info, Node.js version, and process details.

---

## Storage

```
storage/
├── pdfs/    — generated PDF files (auto-deleted after 24 hours)
└── csv/     — generated CSV files (auto-deleted after 24 hours)
```

---

## Performance

Tested against 500k+ employee records and 1.4M+ payroll records:

```
All list endpoints     → paginated, max 100 records per request
Index strategy         → IXSCAN on all critical query paths
Compound indexes       → department + status + type combinations
Lean queries           → .lean() on all list operations
Parallel queries       → Promise.all for count + find
Background exports     → never blocks the request thread
Cursor streaming       → CSV exports use MongoDB cursor (flat memory)
```

---

## License

MIT