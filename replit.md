# HR Productivity Dashboard — Doodle

## Overview

Internal HR tool for Doodle that reads from an external MySQL database (`doodle360_staging`, read-only).
Displays employee leave records and EOD productivity lag.

**Live on EC2:** `13.232.220.60` via Docker Compose (`/home/ubuntu/Hr_dashboard`)

---

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Node.js | v24 |
| Package manager | pnpm 10 |
| TypeScript | 5.9 |
| API framework | Express 5 |
| Frontend | React + Vite + Tailwind (shadcn/ui) |
| Routing (frontend) | wouter |
| Data fetching | TanStack React Query |
| Validation | Zod v4 |
| API codegen | Orval (from OpenAPI spec) |
| API build | esbuild (ESM bundle) |
| DB (external) | MySQL — `doodle360_staging` (read-only, credentials via env secrets) |
| DB (internal) | PostgreSQL via Drizzle ORM (Replit-managed) |

---

## Monorepo Structure

```
artifacts/
  api-server/          Express API — reads MySQL, serves /api/*
  hr-dashboard/        React + Vite frontend — port 18229 (dev), 80 (prod nginx)
lib/
  api-spec/            OpenAPI spec + Orval codegen config
  api-client-react/    Generated React Query hooks
  api-zod/             Generated Zod schemas
  db/                  Drizzle ORM (PostgreSQL)
scripts/               Utility scripts
```

---

## External DB Secrets (env vars)

```
DB_360_HOST   — MySQL host
DB_360_NAME   — Database name (doodle360_staging)
DB_360_USER   — MySQL username
DB_360_PASS   — MySQL password
```

DB connection is in `artifacts/api-server/src/lib/db360.ts`.
SSL is enabled (`rejectUnauthorized: false`).

---

## Key DB Tables (doodle360_staging)

| Table | Purpose |
|---|---|
| `employees` | All employees; `status=1` = active; `deleted_at` = leaving date |
| `` `leave` `` | Leave records; `status IN (1,5)` = approved; `leave_type`: 1=SL, 2=EL, 3/4/5=Other |
| `other_eods` | EOD submissions; `task_date`, `hours_spent`, `status=1` |
| `approved_resource_requests` | Project allocations per employee |
| `projects` | Project metadata including `project_type` |
| `teams` | Team names |
| `emp_profile` | Grade/profile info |
| `holidays` | Public holidays; column `holidays_date`, `title` |

---

## API Routes (`artifacts/api-server/src/routes/`)

### `dashboard.ts`
| Route | Description |
|---|---|
| `GET /api/dashboard/summary` | Total / FT / DTN headcount (date-aware, includes departed employees active in range) |
| `GET /api/dashboard/resource-counts` | Headcount grouped by project category (Retainer / Fixed Fee / Managed Service / Internal / Other) |
| `GET /api/dashboard/leave-analytics` | Leave days grouped by project category, split FT/DTN |
| `GET /api/dashboard/productivity` | Overall productivity % (EOD hours vs approved hours) |
| `GET /api/dashboard/productivity-trend` | Per-day trend (last 14 or 30 data points) |
| `GET /api/dashboard/lagging-resources` | Employees below 80% EOD submission, grouped by category |

### `employees.ts`
| Route | Description |
|---|---|
| `GET /api/employees` | Paginated FT employee list with leave counts, lag days, HR/PM comments, `leftOn` field |
| `GET /api/employees/export` | Same data as CSV download; includes Status and Left On columns |
| `GET /api/employees/:empId/report` | Full individual report: leave breakdown, lag, productivity trend, PM comments |
| `PUT /api/employees/:empId/comment` | Save HR comment (stored in-memory, resets on server restart) |

### `docs.ts`
| Route | Description |
|---|---|
| `GET /api/docs` | Swagger UI (CDN-based, dark theme) |
| `GET /api/docs/openapi.json` | Raw OpenAPI 3.0 JSON spec |

---

## Important Business Logic

### Departed Employees
- `employees.deleted_at` stores the actual leaving date (reliable).
- All queries use `(deleted_at IS NULL OR deleted_at >= fromDate)` so employees who left mid-period appear in historical reports.
- The API adds a `leftOn` field (YYYY-MM-DD) to employee list and export rows for departed employees.
- Departed employees who left **before** the selected date range are excluded automatically.

### Leave Types
- `leave_type = 1` → Sick / Emergency Leave (SL)
- `leave_type = 2` → Earned Leave (EL)
- `leave_type IN (3, 4, 5)` → Other (Comp-off, Optional Holiday, etc.)
- `leavePeriod = 'half_day'` → counts as 0.5 days; `'full_day'` → 1 day
- Approved statuses: `status IN (1, 5)` (1 = Manual Approved, 5 = Auto-Approved)
- Leave counts are clamped to the selected date range and exclude weekends/holidays

### Lag Days & Days Logged

**Formula:**
```
Lag Days = Total Working Days − Days Logged
```

**What counts as "Days Logged":**
A day is counted as logged only when ALL 3 conditions are true in `other_eods`:

| Condition | Column | Required Value |
|---|---|---|
| Date is within selected range | `task_date` | between `dateFrom` and `dateTo` |
| Entry is approved | `status` | = 1 |
| Hours were actually entered | `hours_spent` | > 0 |

> An EOD submitted with 0 hours does **not** count as a logged day.

**What counts as a "Working Day" (the denominator):**
The total working days excludes:
- **Weekends** — Saturday and Sunday are always excluded
- **Public holidays** — fetched live from the `holidays` table (`holidays_date` column)

Example for March 1–26, 2026:
```
Calendar days  = 26
− Weekends     = 6
− Holidays     = 2  (Holi Mar 4, Telugu New Year/Ramzan Mar 20)
─────────────────
Working days   = 19
```

**Example scenarios:**

| Employee | Days Logged | Working Days | Lag Days | Status |
|---|---|---|---|---|
| Logged every day | 19 | 19 | 0 | On Track |
| Missed 4 days | 15 | 19 | 4 | Lagging |
| Never logged | 0 | 19 | 19 | Fully Lagging |

**Exempt from lag tracking (always lag = 0):**
DTN employees + these teams:
`Account Manager`, `Accountant`, `Business Analyst`, `Business Development`, `Business Strategy`,
`Delivery`, `Digital Marketing`, `Head of Engineering`, `Tech Head`, `HR`, `Network`, `Operation`, `Tech Arch`, `RGT`

Matching is **case-insensitive** and uses partial match (e.g. "operation" matches "Operations").
Exempt patterns are defined in `artifacts/api-server/src/lib/categoryUtils.ts → LAG_EXEMPT_TEAM_PATTERNS`.

### Productivity %
- Formula: `(total EOD hours submitted) / (total approved allocation hours) × 100`
- Falls back to `hours / (employee count × days × 8)` if no approved hours found

### Project Categories
- Mapped from `projects.project_type`: `retainer` → Retainer, `fixed_fee`/`FF` → Fixed Fee, `manage_service`/`TM` → Managed Service, `internal` → Internal, else → Other

---

## Frontend Pages (`artifacts/hr-dashboard/src/pages/`)

| File | Route | Description |
|---|---|---|
| `Dashboard.tsx` | `/` | Overview: headcount, leave chart, productivity donut, lagging table |
| `EmployeeList.tsx` | `/employees` | Filterable table with inline HR comment editing, CSV export |
| `EmployeeReport.tsx` | `/employees/:empId` | Individual employee detail page |

**Date range context:** `FilterContext` provides `dateFrom`/`dateTo` globally. The dashboard summary uses `useQuery` directly to pass date params; other endpoints use generated hooks.

---

## Deployment

**EC2:** Ubuntu at `13.232.220.60`, project at `/home/ubuntu/Hr_dashboard`
**Deploy command on EC2:**
```bash
git pull && docker-compose up --build -d
```
(Note: uses `docker-compose` with hyphen — Docker Compose v1)

**Frontend Dockerfile:** Must use `node:24-slim` (not alpine) to avoid musl/rollup binary issues.

**Ports:**
- Dev: frontend = 18229, API = 8080
- Prod: nginx on port 80 serves frontend and proxies `/api` to API container

---

## Verified Data (March 2026)

| Check | Result |
|---|---|
| Employee counts (Total/FT/DTN) | ✅ 379 / 330 / 49 |
| FT + DTN = Total per category | ✅ All 5 categories |
| Leave analytics total | ✅ 58 leave days (59 records; 1 half-day = 0.5) |
| Productivity % | ✅ 31% (1,143 EOD entries in 2026) |
| Lagging resources | ✅ 211 employees across 5 categories |
| Individual employee leaves | ✅ Kartheek (EL:2 SL:0 Other:1 Total:3) |
| Half-day leave (Dixita) | ✅ 1.5 days (1 full + 1 half) |
| Departed employee (Kisore SS) | ✅ Appears in 2025 range, absent from 2026 |
| Holidays (March 2026) | 3: Holi (Mar 4), Telugu New Year (Mar 20), Ramzan (Mar 20) |

---

## Bug Fixes Applied (March 2026 — Session 2)

| Fix | Details |
|---|---|
| Leave filter totals wrong | `took_leave`, `took_earned`, `took_sick` filters were applied in-memory after pagination, showing total=330. Now pushed to SQL subquery — returns correct counts (e.g. 51 EL, 71 SL, 54 any-leave for Jan 2026) |
| Column sort added | EmployeeList now has clickable column headers for LAG DAYS, TOTAL L., FINAL TOTAL, EL TAKEN, SL TAKEN — client-side sort within current page with ↑↓ toggle icons |
| PM popup close on outside click | PmCommentCell popup now closes when user clicks anywhere outside it (mousedown listener) |
| Demo guide: Ravikumar M removed | `CLIENT_DEMO_GUIDE.md` Step 5 and Section 4 updated: Ravikumar M (empId=1042) doesn't exist → replaced with HARI SUDAN N (empId=796, DB0931, 12 PM comments) |

---

## GitHub Repo

`https://github.com/sauravdhake/Hr_dashboard.git`

Push from Replit → pull on EC2 → `docker-compose up --build -d`
