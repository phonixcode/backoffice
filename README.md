# BackOffice NG

A production-grade company backoffice management platform built for Nigerian businesses. Built with Node.js, Express, and MongoDB.

---

## Features

- **Authentication** — JWT access tokens + refresh token rotation via HTTP-only cookies
- **Dynamic RBAC** — Create resources and permissions at runtime, assign to roles, assign roles to users
- **Employee Management** — Hire, manage, and terminate employees
- **Department Management** — Nested department structure with department heads
- **Payroll** — Process, approve, and mark payroll as paid with Nigerian allowances and deductions
- **Leave Management** — Request, approve, and reject leave with overlap detection
- **Audit Logs** — Every mutating request is automatically logged with device and location info
- **Suspicious Activity Detection** — Flags repeated forbidden attempts, bulk deletions, odd-hours access
- **Dashboard & Stats** — Overview, HR, payroll, leave analytics, and activity feed
- **Security** — Rate limiting, account lockout, password reset, NoSQL injection prevention

---

## Tech Stack

```
Runtime     Node.js 20
Framework   Express
Database    MongoDB + Mongoose
Auth        JWT + bcryptjs
Email       Nodemailer
Geolocation geoip-lite
UA Parsing  ua-parser-js
Validation  Joi
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB 7+

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
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

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

# dev data — 1500 employees, payroll, leave, audit logs
npm run seed:dev
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
├── config/           — DB connection, env, mailer, seeder
├── middleware/        — authenticate, authorize, audit logger, rate limiter
├── modules/
│   ├── auth/          — login, register, refresh, logout, password reset
│   ├── users/         — user management, role assignment
│   ├── roles/         — role CRUD, permission assignment
│   ├── resources/     — dynamic resource + permission creation
│   ├── permissions/   — permission management
│   ├── employees/     — employee lifecycle
│   ├── departments/   — department management
│   ├── payroll/       — payroll processing
│   ├── leave/         — leave requests
│   ├── audit/         — audit logs, suspicious activity
│   └── dashboard/     — stats and analytics
├── routes/
│   ├── index.js       — root + health endpoints
│   └── v1/api.js      — all v1 routes
└── utils/             — asyncHandler, apiResponse, paginate, getRoutes
```

---

## API Overview

Base URL: `/api/v1`

| Resource      | Endpoint                  |
|---------------|---------------------------|
| Auth          | `/api/v1/auth`            |
| Users         | `/api/v1/users`           |
| Roles         | `/api/v1/roles`           |
| Resources     | `/api/v1/resources`       |
| Employees     | `/api/v1/employees`       |
| Departments   | `/api/v1/departments`     |
| Payroll       | `/api/v1/payroll`         |
| Leave         | `/api/v1/leave`           |
| Audit Logs    | `/api/v1/audit`           |
| Dashboard     | `/api/v1/dashboard`       |

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

## Rate Limits

| Endpoint              | Limit                    |
|-----------------------|--------------------------|
| All routes            | 100 requests / 15 minutes |
| Auth routes           | 10 requests / 15 minutes  |
| Password reset        | 5 requests / hour         |

---

## Account Security

- **5 failed login attempts** → account locked for 30 minutes
- **Password reset** → secure token sent via email, expires in 30 minutes
- **Logout** → invalidates access token immediately via token versioning
- **Logout all** → revokes all refresh tokens across all devices

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

## Scripts

```bash
npm run dev          # start with nodemon
npm start            # start production
npm run seed         # seed base data
npm run seed:dev     # seed dev data (~13,000 records)
npm run seed:dev -- --fresh   # wipe and reseed
```

---

## Health Check

```
GET /health
```

Returns uptime, memory usage, CPU info, and process details.

---

## License

MIT