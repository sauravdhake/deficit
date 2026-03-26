# HR Productivity Dashboard — Client Demo Guide
**Doodle 360 Staging DB** | Last verified: March 2026 | For internal use only

---

## 1. QUICK DB FACTS (Verified March 2026)

| Metric | Value | How to verify |
|--------|-------|--------------|
| Total FT Employees (active, non-DTN) | 330 | Query Q1 below |
| Working days in March 2026 | **22 days** | Query Q2 below |
| Mandatory holidays in March 2026 | **0** (all 3 are optional) | Query Q3 below |
| Optional holidays (not deducted) | Holi (Mar 4), Telugu New Year (Mar 20), Ramzan (Mar 20) | Query Q3 below |

> **Why 22 working days, not 20?**  
> All March 2026 holidays have `optional_status = 1` (optional). The system only deducts `optional_status = 0` (mandatory) holidays from working days. So 22 weekdays - 0 mandatory holidays = **22 working days**.

---

## 2. FORMULAS — EXACTLY HOW NUMBERS ARE CALCULATED

### 2A. Productivity Lag (Days)

```
lagDays = workingDaysInRange - COUNT(DISTINCT task_date)
          FROM other_eods
          WHERE emp_id = ? 
            AND task_date BETWEEN ? AND ?
            AND status = 1          -- only approved EOD entries
            AND hours_spent > 0     -- only days with actual hours logged
```

- **0 EOD submissions = Full lag** (e.g., lagDays = 22 for March 2026)
- **EOD = End of Day report** submitted by employee in Doodle 360
- Exempt teams always get `lagDays = 0` regardless of EOD count

**Exempt teams** (not tracked): Delivery, HR, Account Manager, Digital Marketing, Operations, Tech Arch, RGT, Network, Business Analyst, Business Development, Business Strategy, Head of Engineering, Tech Head, Accountant

**Verify formula with SQL:**
```sql
-- Replace 1665 with any empId
SELECT emp_id,
       COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 1665
  AND task_date BETWEEN '2026-03-01' AND '2026-03-31'
  AND status = 1
  AND hours_spent > 0;

-- lagDays = 22 - days_logged
-- (22 = working days in March 2026)
```

### 2B. Leave Days (EL Taken / SL Taken)

```
Leave sources: `leave` table
  WHERE empId = ?
    AND status IN (1, 5)       -- 1=Manual Approved, 5=Auto-Approved
    AND from_date <= rangeEnd
    AND to_date >= rangeStart

Leave types: 
  leave_type=1  → Sick Leave (SL)
  leave_type=2  → Earned Leave (EL)
  leave_type=3,4,5 → Other

leavePeriod:
  'full_day'  → counts as 1 working day
  'half_day'  → counts as 0.5 working day

Multi-day leave: EXCLUSIVE end date for multi-day spans
  → Mar 2 to Mar 3 (full_day) = 1 working day (Mar 2 only)
  → Mar 5 to Mar 6 (full_day) = 1 working day (Mar 5 only)
  → Mar 4 to Mar 4 (full_day) = 1 working day (same-day = inclusive)
```

**Verify with SQL:**
```sql
-- Replace 675 with any empId
SELECT leave_type, from_date, to_date, leavePeriod, status
FROM `leave`
WHERE empId = 675
  AND status IN (1, 5)
  AND from_date <= '2026-03-31'
  AND to_date >= '2026-03-01';
```

### 2C. Leave Deficit (EL Deficit / SL Deficit)

```
Source: employee_leave_lag table
  WHERE empId = ?
    AND status = 1    -- IMPORTANT: only status=1 rows count
    AND year-month falls within selected date range

leavetype=2 → EL deficit
leavetype=1 → SL deficit

deficit = SUM(insufficientLeaves)
```

**Verify with SQL:**
```sql
-- March 2026 deficit for any employee
SELECT empId, year, month, leavetype, insufficientLeaves, status
FROM employee_leave_lag
WHERE empId = 675            -- replace with any empId
  AND status = 1
  AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN '2026-03' AND '2026-03';
```

### 2D. Final Total

```
Final Total = (EL Taken - EL Deficit) + (SL Taken - SL Deficit) + Other Leaves

Negative Final Total means the employee took MORE leave than they have entitlement.
```

---

## 3. VERIFIED EMPLOYEES — DEMO WALK-THROUGH

### Employee 1: Kartheek Denkena (DB0811, empId=675) — EL Deficit

**Demo: Go to Employee List → Filter "Negative Balance" → Find Kartheek**

| Field | Value | Source |
|-------|-------|--------|
| empId | 675 | employees.empId |
| Doodle ID | DB0811 | employees.doodle_id |
| EL Taken | 2 days | 2 leave records in `leave` table |
| EL Deficit | **4** | employee_leave_lag, leavetype=2, status=1, Mar 2026 |
| SL Taken | 0 | No SL in `leave` for Mar 2026 |
| SL Deficit | 0 | No SL row in employee_leave_lag for Mar 2026 |
| Other Leaves | 1 day | leave_type=5 row (Mar 4 optional holiday — still counted as working day) |
| **Final Total** | **(2−4) + (0−0) + 1 = −1** | Formula |
| Lag Days | 22 | 0 EOD entries in other_eods for Mar 2026 |

**DB Verification Queries:**
```sql
-- Step 1: Check leaves
SELECT leave_type, from_date, to_date, leavePeriod, status
FROM `leave`
WHERE empId = 675
  AND status IN (1, 5)
  AND from_date <= '2026-03-31'
  AND to_date >= '2026-03-01';

-- Expected: 3 rows
-- Row 1: leave_type=2, 2026-03-02 to 2026-03-03, full_day, status=5
-- Row 2: leave_type=2, 2026-03-05 to 2026-03-06, full_day, status=5
-- Row 3: leave_type=5, 2026-03-04 to 2026-03-04, full_day, status=5

-- Step 2: Check deficit
SELECT empId, year, month, leavetype, insufficientLeaves, status
FROM employee_leave_lag
WHERE empId = 675 AND year = 2026 AND month = 3;

-- Expected: 1 row: leavetype=2, insufficientLeaves=4, status=1

-- Step 3: Check EOD (for lag)
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 675
  AND task_date BETWEEN '2026-03-01' AND '2026-03-31'
  AND status = 1 AND hours_spent > 0;

-- Expected: 0 → lagDays = 22
```

---

### Employee 2: Harikrishnan T (DB1493, empId=1376) — SL Deficit

**Demo: Negative Balance filter → Find Harikrishnan T**

| Field | Value | Source |
|-------|-------|--------|
| SL Taken | 1 day | 1 SL record Mar 2, 2026 |
| SL Deficit | **1** | employee_leave_lag, leavetype=1 |
| Final Total | (0−0) + (1−1) + 0 = **0** | Formula |

**Verify:**
```sql
SELECT leave_type, from_date, to_date, leavePeriod FROM `leave`
WHERE empId = 1376 AND status IN (1,5)
  AND from_date <= '2026-03-31' AND to_date >= '2026-03-01';
-- Expected: 1 row, leave_type=1, Mar 2 to Mar 2, full_day

SELECT leavetype, insufficientLeaves FROM employee_leave_lag
WHERE empId = 1376 AND year=2026 AND month=3 AND status=1;
-- Expected: leavetype=1, insufficientLeaves=1
```

---

### Employee 3: Kimmi Anna J P (empId=1627) — SL Deficit

Similar to Harikrishnan — SL Deficit = 1 in March 2026.

```sql
SELECT leavetype, insufficientLeaves FROM employee_leave_lag
WHERE empId = 1627 AND year=2026 AND month=3 AND status=1;
-- Expected: leavetype=1, insufficientLeaves=1
```

---

### Employee 4: Abdul Ajiz SS (DB1760, empId=1665) — High Lag (No EOD)

**Demo: Employee List → Open Abdul Ajiz SS report → March 2026**

| Field | Value | Source |
|-------|-------|--------|
| Lag Days | **22** | 0 EOD in other_eods for Mar 2026 |
| EL/SL | 0 | No approved leave in `leave` table |
| Category | Fixed Fee (QA team) | approved_resource_requests + projects |
| Exempt? | **No** — QA is not in exempt team list | categoryUtils.ts |

**Verify:**
```sql
-- EOD check
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 1665
  AND task_date BETWEEN '2026-03-01' AND '2026-03-31'
  AND status = 1 AND hours_spent > 0;
-- Expected: 0

-- Leave check
SELECT * FROM `leave`
WHERE empId = 1665 AND status IN (1,5)
  AND from_date <= '2026-03-31' AND to_date >= '2026-03-01';
-- Expected: 0 rows
```

> **Client concern:** "Why 22 lag days?"  
> **Answer:** This employee submitted 0 EOD reports in March 2026. The formula counts distinct dates with EOD logged in `other_eods`. Zero submissions = full lag of 22 working days.

---

### Employee 5: Saurab Ishwar Dhake (DB1448, empId=1336) — High Lag Feb 2026

**Demo: Go to Employee List → Search "Saurab" → Click employee → Change date to Feb 2026**

| Field | Value | Source |
|-------|-------|--------|
| Lag Days (Feb 2026) | **20** | 0 EOD entries for Feb 2026 |
| EL/SL | 0 | No leave in Feb 2026 |
| PM Comment | "4 hours is non billable hours" | tasks.pmComments, dated 2024-07-05 |

**Verify:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 1336
  AND task_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND status = 1 AND hours_spent > 0;
-- Expected: 0
```

---

## 4. PM COMMENTS — HOW THEY WORK

**Source:** `tasks.pmComments` in Doodle 360 database

```sql
-- All PM comments for an employee (replace empId)
SELECT t.pmComments, DATE_FORMAT(t.createdAt, '%Y-%m-%d') AS date, t.taskId
FROM tasks t
WHERE t.empId = 1336          -- replace with any empId
  AND t.pmComments IS NOT NULL AND t.pmComments != ''
  AND t.status = 1
ORDER BY t.createdAt DESC;
```

**What the UI shows:**
- **Employee List (table):** Latest PM comment text + badge showing total count (e.g., "+2 more"). Click the comment to expand and see last 3 with dates.
- **Individual Report:** Full history of ALL PM comments (no limit), ordered newest first.
- **Comments are READ-ONLY** — they come from the D360 task system, not added in the HR dashboard.

**Example — HARI SUDAN N (empId=796, DB0931) has 12 PM comments:**
```sql
SELECT t.pmComments, DATE_FORMAT(t.createdAt, '%Y-%m-%d') AS date
FROM tasks t
WHERE t.empId = 796 AND t.pmComments IS NOT NULL AND t.pmComments != '' AND t.status = 1
ORDER BY t.createdAt DESC LIMIT 5;
-- Returns up to 5 most recent PM comments
```

---

## 5. WEEKLY PRODUCTIVITY TREND — HOW IT WORKS

**Last Week view:**
- Shows daily data points for each day
- X-axis: "Mon 23 Mar", "Tue 24 Mar", etc.
- Y-axis: Productivity % = (total hours submitted / employees × 8h) × 100

**Monthly view (AFTER FIX):**
- Shows weekly aggregated data (~4–5 points per month)
- Each point = one ISO week's aggregated hours
- X-axis: "02 Mar – 06 Mar", "09 Mar – 13 Mar", etc.
- Formula: same — (sum of all hours in that week) / (unique employees × 8h) × 100

**Verify the raw data:**
```sql
-- Daily EOD submissions for current week
SELECT
  DATE_FORMAT(oe.task_date, '%a %d %b') AS day,
  COALESCE(SUM(oe.hours_spent), 0) AS total_hours,
  COUNT(DISTINCT oe.emp_id) AS emp_count,
  ROUND(SUM(oe.hours_spent) / (COUNT(DISTINCT oe.emp_id) * 8) * 100, 1) AS productivity_pct
FROM other_eods oe
INNER JOIN employees e ON e.empId = oe.emp_id
WHERE oe.task_date BETWEEN '2026-03-16' AND '2026-03-20'
  AND oe.status = 1 AND e.status = 1
GROUP BY oe.task_date
ORDER BY oe.task_date;

-- Weekly aggregation (for Monthly view)
SELECT
  YEARWEEK(oe.task_date, 1) AS week,
  DATE_FORMAT(MIN(oe.task_date), '%d %b') AS week_start,
  DATE_FORMAT(MAX(oe.task_date), '%d %b') AS week_end,
  COALESCE(SUM(oe.hours_spent), 0) AS total_hours,
  COUNT(DISTINCT oe.emp_id) AS emp_count,
  ROUND(SUM(oe.hours_spent) / (COUNT(DISTINCT oe.emp_id) * 8) * 100, 1) AS productivity_pct
FROM other_eods oe
INNER JOIN employees e ON e.empId = oe.emp_id
WHERE oe.task_date BETWEEN '2026-03-01' AND '2026-03-31'
  AND oe.status = 1 AND e.status = 1
GROUP BY YEARWEEK(oe.task_date, 1)
ORDER BY week;
```

---

## 6. DASHBOARD DATE FILTER

**BEFORE FIX:** Used plain date text input fields — hard to click in some browsers.  
**AFTER FIX:** Uses the same calendar popup picker (click date → calendar opens → select → auto-applies).

The date filter on the Dashboard is SHARED with the Employee List. Changing date in one page changes it on all pages.

---

## 7. INDIVIDUAL EMPLOYEE REPORT — FULL VERIFICATION TEMPLATE

To verify any employee's numbers, run these 4 queries (replace `{EMPID}`, `{FROM}`, `{TO}`):

```sql
-- ── Q1: Employee info
SELECT empId, firstName, lastName, doodle_id,
       t.name AS team
FROM employees e
LEFT JOIN teams t ON t.teamId = e.team AND t.status = 1
WHERE empId = {EMPID};

-- ── Q2: Leaves in range
SELECT leave_type, from_date, to_date, leavePeriod, status
FROM `leave`
WHERE empId = {EMPID}
  AND status IN (1, 5)
  AND from_date <= '{TO}'
  AND to_date >= '{FROM}';

-- ── Q3: EOD (Productivity Lag)
SELECT task_date, SUM(hours_spent) AS hours
FROM other_eods
WHERE emp_id = {EMPID}
  AND task_date BETWEEN '{FROM}' AND '{TO}'
  AND status = 1 AND hours_spent > 0
GROUP BY task_date
ORDER BY task_date;

-- ── Q4: Leave Deficit
SELECT leavetype, SUM(insufficientLeaves) AS deficit, status
FROM employee_leave_lag
WHERE empId = {EMPID}
  AND status = 1
  AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN DATE_FORMAT('{FROM}', '%Y-%m') AND DATE_FORMAT('{TO}', '%Y-%m')
GROUP BY leavetype;

-- ── Q5: PM Comments (all time)
SELECT pmComments, DATE_FORMAT(createdAt, '%Y-%m-%d') AS date
FROM tasks
WHERE empId = {EMPID}
  AND pmComments IS NOT NULL AND pmComments != ''
  AND status = 1
ORDER BY createdAt DESC;
```

---

## 8. STEP-BY-STEP DEMO SCRIPT

### Step 1: Dashboard Overview
1. Open dashboard — show **Total Employees, FT, DTN** counts
2. Click **Monthly** button on "Weekly Productivity Trend"
3. Show 4–5 weekly bars (not 28+ daily dots)
4. Click date range — **calendar opens** (new fix)
5. Set March 1–31, 2026 — click Apply — numbers update

### Step 2: Resource Counts by Category
- Show Retainer/Fixed Fee/Managed Service breakdown
- Verify a count: click the table to confirm vs DB

### Step 3: Employee List — Lag View
1. Go to **Employee List**
2. Set date: **March 1–31, 2026**
3. Click **"Lagging"** filter — shows employees with lag > 0
4. Notice most employees show lag because they have 0 EOD submissions
5. Show that QA/Dev employees (non-exempt) have lag tracked; Delivery/HR don't appear
6. Click **"Negative Balance"** — shows **2 employees** (Kartheek and Kimmi only — both have Final Total = −1)

### Step 4: Negative Balance Deep Dive
1. With "Negative Balance" filter active:
   - Show **Kartheek**: EL=2, EL Deficit=4, Final Total=**−1**
   - Show **Kimmi**: Leaves=0, SL Deficit=1, Final Total=**−1** (exempt team → Lag=0)
   > Note: Harikrishnan T (DB1493) has SL Deficit=1 but Final Total=0 — he does NOT appear because the filter shows only strictly negative totals (< 0).
2. Open employee report for Kartheek — verify all numbers

### Step 5: PM Comments
1. In employee list, search **"Hari Sudan"** — HARI SUDAN N (DB0931, empId=796) has **12 PM comments**
2. Show the "+11 more" badge — click to expand → see last 3 comments with dates (popup closes on outside click)
3. Open their individual report — show full PM comment history (all 12 visible, no limit)

### Step 6: Individual Employee Report — Productivity Lag
1. Open Abdul Ajiz SS (DB1760) — March 2026
2. Show: **22 lag days / 22 working**
3. Run Q3 above — client sees 0 rows → confirms no EOD submissions
4. Explain: "Zero EOD submissions for March = full lag of 22 working days"
5. Note: This is the EOD tracking system (other_eods table), not task completion

---

## 9. COMMON CLIENT QUESTIONS

**Q: Why does an employee show 22/22 lag but they were clearly working?**  
A: The system tracks **EOD report submissions**, not task work. If an employee works but doesn't submit their end-of-day report in Doodle 360, the system records no submission → full lag. Run Query Q3 — if 0 rows, employee never submitted EOD for that period.

**Q: Why are March holidays not deducted from 22 working days?**  
A: Holi (Mar 4), Telugu New Year (Mar 20), and Ramzan (Mar 20) are all `optional_status = 1` in the holidays table. The system only deducts mandatory holidays. Optional holidays are not deducted.
```sql
SELECT holidays_date, title, optional_status FROM holidays
WHERE holidays_date BETWEEN '2026-03-01' AND '2026-03-31';
-- All 3 rows show optional_status = 1
```

**Q: Why does the leave deficit show even though the employee has balance?**  
A: The `employee_leave_lag` table records deficits — it's Doodle's own leave balance tracking system. It reflects the leave policy rules (annual accrual limits, carry-forward restrictions). The dashboard reads this directly from the source of truth.

**Q: Is the PM comment accurate/current?**  
A: Yes. PM comments come directly from `tasks.pmComments` in the Doodle 360 database, read-only. The dashboard does not modify or cache them.

**Q: What is the difference between EL Deficit and negative Final Total?**  
A: EL Deficit = surplus leaves taken over entitlement (from employee_leave_lag). Final Total is the net balance: (EL Taken - EL Deficit) + (SL Taken - SL Deficit) + Other Leaves. A negative Final Total means the employee's overall leave is in deficit.

---

## 10. TECHNICAL ARCHITECTURE (for technical client)

```
Doodle 360 MySQL (read-only) ──→ API Server (Node.js/Express, port 8080)
                                        ├── /api/employees          ← list with leave + lag + deficit
                                        ├── /api/employees/:id/report  ← individual report
                                        ├── /api/dashboard/summary
                                        ├── /api/dashboard/productivity-trend
                                        └── /api/dashboard/lagging-resources
                                                              ↓
                                        HR Dashboard (React/Vite, port 80/nginx)
```

**Key tables used:**
| Table | Purpose |
|-------|---------|
| `employees` | Employee master |
| `teams` | Team names |
| `emp_profile` | Grade info |
| `leave` | Leave applications (status 1=approved, 5=auto-approved) |
| `employee_leave_lag` | Leave deficit/balance records |
| `other_eods` | EOD submissions (hours logged per day) |
| `tasks` | Task entries (for PM comments) |
| `holidays` | Holiday calendar (optional_status=0 = mandatory) |
| `approved_resource_requests` + `projects` | Project category mapping |
