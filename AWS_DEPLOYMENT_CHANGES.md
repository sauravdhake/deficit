# AWS Deployment Change Log

Pull the latest code from GitHub and run `docker compose up --build -d` on the EC2 instance.

---

## Release: 2026-03-25 (Patch 2) — Manager Notes + Calendar Fix

### What changed

#### 1. Employee Report — Manager's Notes Always Visible in HR Card

**Why:** When HR opens an employee's detail page to write a comment, they need to see what the PM/manager wrote. The manager's notes were previously hidden unless there were comments, and in a separate card that required scrolling away from the HR textarea.

**Files changed:**
- `artifacts/hr-dashboard/src/pages/EmployeeReport.tsx`
  - Added a **Manager's Notes (Read-only)** amber block inside the HR Comments card, directly above the textarea
  - Block is **always visible** — when PM has notes they show with dates; when no notes exist, shows *"No manager notes added yet."*
  - HR never needs to scroll to find the manager's input while typing

- `artifacts/api-server/src/routes/employees.ts`
  - **Bug fix**: The employee report endpoint was filtering PM comments by `createdAt BETWEEN fromDate AND toDate` — so any PM comment written outside the selected date range was silently excluded
  - Removed the date filter from the PM comments query on the report endpoint; now returns the 5 most recent PM notes for that employee regardless of date
  - This matches the employee list behaviour which also had no date filter on PM comments

---

#### 2. Date Picker — Single-Selection Double-Highlight Fix

**Why:** When opening either the From or To calendar, today's date showed a coloured background circle alongside the selected date circle — making it look like two dates were selected.

**Root cause:** The shadcn Calendar component applies `bg-accent` to today's date as a built-in modifier. With two separate date pickers open, this competed visually with the primary selection circle.

**Files changed:**
- `artifacts/hr-dashboard/src/components/ui/date-range-picker.tsx`
  - Passed `classNames={{ today: "text-foreground" }}` to both the From and To `<Calendar>` instances
  - Removes the accent background from today's date in these pickers only — today's number stays readable, but only the actually-selected date shows the blue circle
  - No logic changes

---

### Deploy steps on EC2

```bash
ssh ubuntu@13.232.220.60
cd ~/Hr_dashboard
git pull origin main
docker compose up --build -d
docker compose ps
```

---

## Release: 2026-03-25 — Lag Filter + Date Picker Redesign

### What changed

#### 1. Employee List — Lag Status Filter (UI + API)

**Why:** Users needed to quickly isolate lagging or on-track employees without scrolling through the full list.

**Files changed:**
- `artifacts/api-server/src/routes/employees.ts`
  - `GET /api/employees` now accepts a `lagFilter` query param
  - `lagFilter=has_lag` → returns only employees whose lag days > 0 (exempt teams excluded)
  - `lagFilter=on_track` → returns only employees whose lag days = 0 (or are on exempt teams)
  - `lagFilter=all` (default, or omit param) → returns all employees unchanged
  - Previous filter values `last_week` / `last_month` still work as before

- `lib/api-client-react/src/generated/api.schemas.ts`
  - Added `on_track: "on_track"` to the `GetEmployeesLagFilter` enum

- `lib/api-zod/src/generated/types/getEmployeesLagFilter.ts`
  - Added `on_track: "on_track"` to the `GetEmployeesLagFilter` enum

- `artifacts/hr-dashboard/src/pages/EmployeeList.tsx`
  - Added `lagFilter` state (default: `"all"`)
  - Added segmented button group: **All | Lagging | On Track**
  - Buttons sit right next to the search bar; "Lagging" turns red when active, "On Track" turns green
  - Filter is server-side — resets to page 1 and sends `lagFilter` param to API on each click

---

#### 2. Date Range Picker — Full UX Redesign

**Why:** The two-month range calendar (click twice) was confusing — users did not understand they had to click once for start and once for end. The calendar also showed a double-highlight bug when starting a new selection.

**What changed:**
- `artifacts/hr-dashboard/src/components/ui/date-range-picker.tsx` — fully redesigned
  - Replaced the single two-month range calendar with **two separate labelled buttons**: **From** and **To**
  - Each button shows its date (e.g. "From 16 Mar 2026") and opens its own single-month calendar
  - Picking a From date auto-opens the To calendar immediately after
  - Picking a To date commits the range and closes automatically
  - If From > To, dates are auto-swapped so selection always stays valid
  - Internal local state tracks in-progress picks — parent context only updates once both dates are confirmed
  - An arrow (→) between the two buttons makes the From → To flow visually obvious

---

### Deploy steps on EC2

```bash
# SSH into EC2
ssh ubuntu@13.232.220.60

# Go to project directory
cd ~/Hr_dashboard

# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose up --build -d

# Verify both containers are running
docker compose ps
```

> **Note:** Port 80 must be open in the EC2 Security Group inbound rules (TCP 0.0.0.0/0 → Port 80).

---

## Previous Releases

### 2026-03-24 — Initial Docker Deployment
- Docker Compose setup with API server + Nginx-served frontend
- `docker/api.Dockerfile` — Node 24 slim builder
- `docker/web.Dockerfile` — Node 24 slim build → nginx:alpine runner
- `docker/nginx.conf` — proxies `/api` to API container on port 8080
- `docker-compose.yml` — ties both services together
- App is live on EC2 (13.232.220.60) behind port 80
