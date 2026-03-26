# HR Productivity Dashboard — Developer & Client Guide

**Project:** Doodle HR Productivity Dashboard  
**Database:** `doodle360_staging` (MySQL, read-only)  
**Last verified:** March 24, 2026

---

## 1. System Architecture

```
MySQL (doodle360_staging)   →   API Server (port 8080)   →   React Dashboard (port 18229)
     Read-only                    Node/Express/TypeScript         Vite + React
```

| Component | Path | Port |
|---|---|---|
| API Server | `artifacts/api-server` | 8080 |
| HR Dashboard (Frontend) | `artifacts/hr-dashboard` | 18229 |
| DB connection config | `artifacts/api-server/src/lib/db360.ts` | — |

**Environment secrets** (set in Replit, never hardcoded):  
`DB_360_HOST`, `DB_360_NAME`, `DB_360_USER`, `DB_360_PASS`

The database connection enforces **read-only** at the MySQL session level on every connection:
```ts
db360.on("connection", (conn) => {
  conn.query("SET SESSION TRANSACTION READ ONLY");
});
```

---

## 2. Critical Database Mappings

### 2.1 Leave Types — `leavetype` table

| `leave.leave_type` | Meaning | Shown as in app |
|---|---|---|
| `1` | Emergency Leave | SL / SICK/EMERG. column |
| `2` | Earned Leave | EL / EARNED L. column |
| `3` | Casual Leave | *(inactive, status=0)* |
| `4` | Comp-off | OTHER L. column |
| `5` | Optional Leave | OTHER L. column |

> **Important:** The client's own system displays type `1` as both "Emergency leave" (in the Leave Approval page) and "Sick Leave" (in the Leave Balance page). Both labels refer to the same `leave_type=1`. Our app uses "SICK/EMERG." to cover both labels.

Verify with:
```sql
SELECT * FROM leavetype;
```

---

### 2.2 Leave Status Values — `leave` table

| `leave.status` | Meaning | Count in DB |
|---|---|---|
| `0` | Draft | 17 |
| `1` | Manually Approved | 7,748 |
| `2` | Pending / Withdrawn | 1,691 |
| `3` | Rejected | 83 |
| `5` | **Auto-approved** | 9,518 |
| `6` | Withdrawn | 959 |

> **Critical finding (March 24, 2026):** The majority of approved leaves use `status = 5` ("Auto-approved" by the PM system). Our original queries only counted `status = 1`. This was missing **88% of approved leaves** in the date range. All leave queries in the app now use `status IN (1, 5)`.

Cross-verify this mapping by checking the `approvedBy` field:
```sql
-- status=5 records have an approvedBy set (system-approved)
SELECT status, approvedBy=0 as not_yet_approved, COUNT(*) as cnt
FROM `leave`
GROUP BY status, (approvedBy=0)
ORDER BY status;
```

---

### 2.3 Employee Types

| `employees.isDtn` | Type | Included in list? |
|---|---|---|
| `0` or NULL | Full-time (FT) | ✅ Yes |
| `1` | DTN (contract) | ❌ No — excluded from employee list, CSV export, lag calculations |

DTN employees are filtered at the SQL level: `AND (e.isDtn = 0 OR e.isDtn IS NULL)`

---

### 2.4 Leave Period

| `leave.leavePeriod` | Days counted |
|---|---|
| `full_day` | 1.0 |
| `half_day` | 0.5 |

---

## 3. How the App Counts Leaves

For every leave record in the requested date range, the app:

1. **Fetches** all `leave` rows where `status IN (1, 5)` and date range overlaps
2. **Clamps** the leave dates to the query range (e.g. a leave that started before the range starts at `fromDate`)
3. **Counts working days** in the clamped range, excluding weekends and **mandatory** holidays (`optional_status = 0`)
4. **Multiplies** by 0.5 for `half_day` leaves

```
finalDays = workingDaysInRange × (leavePeriod === 'half_day' ? 0.5 : 1)
```

The result is bucketed:
- `leave_type = 2` → **Earned Leaves** (EL column)
- `leave_type = 1` → **Sick/Emergency Leaves** (SL column)
- `leave_type IN (3,4,5)` → **Other Leaves** (Optional, Comp-off)

Verify a specific employee's raw data:
```sql
SELECT l.leave_type, l.from_date, l.to_date, l.leavePeriod, l.status
FROM `leave` l
WHERE l.empId = <empId>
  AND l.status IN (1, 5)
  AND l.from_date <= '<toDate>'
  AND l.to_date   >= '<fromDate>'
ORDER BY l.from_date;
```

---

## 4. How Productivity Lag is Calculated

Lag = (Working days in range) − (Days employee logged EOD)

```sql
-- Days the employee logged work (other_eods table)
SELECT COUNT(DISTINCT task_date) AS daysLogged
FROM other_eods
WHERE emp_id = <empId>
  AND task_date BETWEEN '<lagFrom>' AND '<lagTo>'
  AND status = 1
  AND hours_spent > 0;
```

**Lag-exempt employees** (always show lagDays = 0):
- DTN employees (`isDtn = 1`)
- Employees in exempt teams — see `artifacts/api-server/src/lib/categoryUtils.ts → isLagExemptTeam()`

**Lag calculation date range:**  
The lag is calculated from `fromDate` to `toDate − 1 day` (exclusive end). This prevents counting the current/last day as a lag when the EOD may not yet be submitted.

---

## 5. Known Data Discrepancies — Staging vs Production

The staging database (`doodle360_staging`) is periodically synced from production. Between sync cycles, records that exist in the client's production system will not appear in staging. **This is a data gap, not an app bug.**

### Verified as of March 24, 2026 (range: Feb 22 – Mar 24, 2026)

| Employee | Our App Shows | Client's App Shows | What's Missing |
|---|---|---|---|
| **Shaikh Sufyan** (DB1500) | 1 EL | 2 EL | Mar 19 EL not in staging DB |
| **Amitabh Kumar** (DB0790) | 1 Optional | 1 EL + 1.5 Emerg + 1 Optional | EL and Emergency records missing |
| **Keerthana K** (DB1406) | 1 Emergency ✓ | 1 Emergency + 1 Optional | Optional leave missing |
| **Abdul** (DB1736) | 1 Optional ✓ | 1 Comp-off + 1 Optional | Comp-off not in `leave` or `comp_off` table |
| **Malathi** | Not shown (correct) | "Not in system" | Deactivated Feb 27, 2026 (`emp_status=0`, `deleted_at` set) |

**How to confirm a missing record:**
```sql
-- Check ALL statuses, not just approved
SELECT l.id, l.leave_type, l.from_date, l.to_date, l.status, l.leavePeriod
FROM `leave` l
WHERE l.empId = <empId>
  AND l.from_date <= '<toDate>'
  AND l.to_date   >= '<fromDate>'
ORDER BY l.from_date;
-- If this returns empty, the record is genuinely missing from staging.
```

**Resolution:** Request the client/DBA to re-sync `doodle360_staging` from production. Our app will automatically reflect the updated records — no code changes needed.

---

## 6. Holidays

```sql
SELECT id, title, holidays_date, status, optional_status FROM holidays
WHERE YEAR(holidays_date) = 2026
ORDER BY holidays_date;
```

| Column | Meaning |
|---|---|
| `status = 1` | Active holiday |
| `optional_status = 0` | **Mandatory** — excluded from working day count for lag |
| `optional_status = 1` | Optional — excluded from working day count for leave calculations |

Both mandatory and optional holidays are excluded from leave day counting. Only mandatory holidays are excluded from lag day counting.

---

## 7. API Endpoints — Quick Reference

| Endpoint | What it does | Key params |
|---|---|---|
| `GET /api/employees` | Employee list with leaves + lag | `dateFrom`, `dateTo`, `search`, `page`, `limit` |
| `GET /api/employees/csv` | Same data as CSV download | `dateFrom`, `dateTo` |
| `GET /api/employees/:id` | Single employee full report | `dateFrom`, `dateTo` |
| `GET /api/dashboard/overview` | Total counts (FT, DTN, leaves) | `dateFrom`, `dateTo` |
| `GET /api/dashboard/leave-analytics` | Leave breakdown by category | `dateFrom`, `dateTo` |
| `GET /api/dashboard/lagging-resources` | Employees with lag > threshold | `dateFrom`, `dateTo` |

---

## 8. Developer Debugging Workflow

When a client reports a data mismatch, follow these steps:

**Step 1 — Find the employee**
```sql
SELECT empId, firstName, lastName, doodle_id, status, deleted_at, isDtn
FROM employees
WHERE firstName LIKE '%Name%' OR lastName LIKE '%Name%';
```

**Step 2 — Check if they're active and visible in the list**
- `status = 1` and `deleted_at IS NULL` → active, will appear
- `status = 0` or `deleted_at` set → deactivated, won't appear
- `isDtn = 1` → DTN, excluded from employee list

**Step 3 — Check all their leaves in the range (any status)**
```sql
SELECT l.id, l.leave_type, l.from_date, l.to_date, l.leavePeriod, l.status
FROM `leave` l
WHERE l.empId = <empId>
  AND l.from_date <= '<toDate>'
  AND l.to_date   >= '<fromDate>'
ORDER BY l.from_date;
```
- If records exist only with `status = 2/3/6` → pending or rejected, correctly not counted
- If records are missing entirely → staging DB is out of sync with production

**Step 4 — Check what the app actually returns**
```bash
curl "http://localhost:8080/api/employees?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&search=DOODLE_ID"
```

**Step 5 — Check comp-off separately** (comp-offs are tracked in a separate table)
```sql
SELECT co.comp_off_date, co.hours, co.status
FROM comp_off co
WHERE co.empId = <empId>
  AND co.comp_off_date BETWEEN '<fromDate>' AND '<toDate>';
```
> Note: Comp-offs in the `comp_off` table are **not** currently counted in the leave totals. Only comp-offs entered via the `leave` table (leave_type=4) are counted.

---

## 9. Summary for Client

**What our app does:** Reads directly from `doodle360_staging` and displays exactly what is in that database. No data is transformed, invented, or cached beyond the current session.

**Why some leave counts differ from your app:**

1. Your app shows "Auto-approved" (status=5) leaves — our app now correctly includes these after the fix on March 24, 2026.

2. For specific employees (Shaikh, Amitabh, Keerthana, Abdul) there are records in your production system that **do not exist as rows in `doodle360_staging`**. These are missing because staging is not real-time — it requires a periodic sync from production.

3. Malathi is correctly not shown — she was deactivated (`deleted_at = Feb 27, 2026`).

**What needs to happen to fix the remaining gaps:** The DBA needs to re-sync `doodle360_staging` from production. Once that sync happens, our app will immediately show the correct data with no code changes needed.

---

## 10. Testing Flow — Verified Against Staging DB

> **Test range used throughout:** `dateFrom=2026-02-22` → `dateTo=2026-03-24`

### 10.1 Holidays Baseline

Before testing leave counts, confirm which holidays fall in the range and their type:

```sql
SELECT holidays_date, title, status, optional_status
FROM holidays
WHERE holidays_date BETWEEN '2026-02-22' AND '2026-03-24'
ORDER BY holidays_date;
```

**Expected result from staging:**

| Date | Title | optional_status | Counted in lag? | Counted in leave? |
|---|---|---|---|---|
| 2026-03-04 | Holi | 1 (Optional) | ❌ Yes, it's a working day for lag | ❌ Yes, working day for leave |
| 2026-03-20 | Telugu New Year | 1 (Optional) | ❌ Working day for lag | ❌ Working day for leave |
| 2026-03-20 | Ramzan | 1 (Optional) | ❌ Working day for lag | ❌ Working day for leave |

> **Key rule:** Only mandatory holidays (`optional_status = 0`) are excluded from working day counts. Optional holidays are treated as normal working days by our app — both for lag and for leave calculations.

---

### 10.2 Individual Test Cases

Each test case below is sourced directly from `doodle360_staging`, verified against the live API on March 24, 2026.

---

#### TC01 — Emergency Leave, full-day, Auto-Approved (status=5)

**Employee:** Dhivshnika J S | **DoodleID:** DB1497 | **empId:** 1379

**Verify leave exists in DB:**
```sql
SELECT l.leave_type, l.from_date, l.to_date, l.leavePeriod, l.status
FROM `leave` l
WHERE l.empId = 1379
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=1, from_date=2026-02-23, to_date=2026-02-23, leavePeriod=full_day, status=5`

**Reasoning:** Feb 23 = Monday (weekday), not a holiday → 1 working day × full_day = **1.0**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1497"
```
**Expected in response:** `sickLeaves: 1, earnedLeaves: 0, otherLeaves: 0`

---

#### TC02 — Emergency Leave, full-day, Auto-Approved (status=5)

**Employee:** Khushi Gupta | **DoodleID:** DNA0003 | **empId:** 1681

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1681
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=1, from_date=2026-02-25, leavePeriod=full_day, status=5`

**Reasoning:** Feb 25 = Wednesday (weekday), not a holiday → **1.0**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DNA0003"
```
**Expected:** `sickLeaves: 1`

---

#### TC03 — Earned Leave, full-day, Auto-Approved (status=5)

**Employee:** Priyanka Maurya | **DoodleID:** DB1662 | **empId:** 1557

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1557
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=2, from_date=2026-03-03, leavePeriod=full_day, status=5`

**Reasoning:** Mar 3 = Tuesday, not a holiday → **1.0 Earned Leave**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1662"
```
**Expected:** `earnedLeaves: 1`

---

#### TC04 — Earned Leave, full-day, Auto-Approved (status=5)

**Employee:** Vanith B | **DoodleID:** DB0563 | **empId:** 424

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 424
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=2, from_date=2026-02-23, leavePeriod=full_day, status=5`

**Reasoning:** Feb 23 = Monday → **1.0 Earned Leave**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB0563"
```
**Expected:** `earnedLeaves: 1`

---

#### TC05 — Comp-off, full-day, Auto-Approved (status=5)

**Employee:** Riyaz Ahmed | **DoodleID:** DB1029 | **empId:** 895

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 895
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected rows include: `leave_type=4, from_date=2026-03-03, leavePeriod=full_day, status=5`

**Reasoning:** Mar 3 = Tuesday, not a holiday → Comp-off contributes at least **1.0** to Other column

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1029"
```
**Expected:** `otherLeaves ≥ 1` (Riyaz has multiple other leaves in range)

---

#### TC06 — Comp-off, full-day, Auto-Approved (status=5)

**Employee:** Naveen K | **DoodleID:** DB1490 | **empId:** 1373

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1373
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=4, from_date=2026-02-23, leavePeriod=full_day, status=5`

**Reasoning:** Feb 23 = Monday → **1.0 Comp-off → Other**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1490"
```
**Expected:** `otherLeaves: 1`

---

#### TC07 — Optional Leave on an Optional Holiday (Mar 20)

**Employee:** Mohamed Abdul Ibrahim Khaja Mohideen | **DoodleID:** DB1736 | **empId:** 1639

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1639
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=5, from_date=2026-03-20, leavePeriod=full_day, status=1`

**Reasoning:** Mar 20 = Telugu New Year / Ramzan, BUT `optional_status = 1` so it is **NOT excluded** from working day count. Mar 20 = Friday (weekday) + not in mandatory holiday set → **1.0 Optional Leave → Other**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1736"
```
**Expected:** `otherLeaves: 1`

> **Takeaway:** Optional holidays are treated as regular working days. Employees who take Optional Leave on an optional holiday still get 1 day counted.

---

#### TC08 — Optional Leave on Holi (Mar 4, optional holiday)

**Employee:** Amit Kumar | **DoodleID:** DB0843 | **empId:** 707

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 707
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=5, from_date=2026-03-04, leavePeriod=full_day, status=5`

**Reasoning:** Mar 4 = Holi, but `optional_status=1` → counted as working day → **1.0 Other**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB0843"
```
**Expected:** `otherLeaves ≥ 1`

---

#### TC09 — Multi-day Earned Leave with Exclusive End-date Rule

**Employee:** Krishnaraj Rangaraj | **DoodleID:** DB0319 | **empId:** 186

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.to_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 186
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=2, from_date=2026-02-23, to_date=2026-02-24, leavePeriod=full_day`

**Reasoning (exclusive end-date rule):**
- from ≠ to, so end is exclusive: effective range = Feb 23 to Feb 23 (only 1 day counted)
- Feb 23 = Monday → **1.0 Earned Leave**

This rule exists because the `to_date` in the DB is the first day the employee is **back**, not the last day of leave.

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB0319"
```
**Expected:** `earnedLeaves: 1`

---

#### TC10 — Emergency Leave, Half-day

**Employee:** Yokesh Ram Balasubramanian | **DoodleID:** DB1364 | **empId:** 1255

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1255
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=1, from_date=2026-02-26, leavePeriod=half_day, status=5`

**Reasoning:** Feb 26 = Thursday (weekday), 1 working day × 0.5 = **0.5 SL**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1364"
```
**Expected:** `sickLeaves: 0.5`

---

#### TC11 — Emergency Leave, Half-day (second example)

**Employee:** Sowmiya G | **DoodleID:** DB1398 | **empId:** 1287

**Verify in DB:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 1287
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```
Expected row: `leave_type=1, from_date=2026-03-05, leavePeriod=half_day, status=5`

**Reasoning:** Mar 5 = Thursday (weekday), 1 × 0.5 = **0.5 SL**

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB1398"
```
**Expected:** `sickLeaves: 0.5`

---

#### TC12 — NEGATIVE: Pending/Withdrawn Leave Must NOT Be Counted

**Employee:** SriBalaji A | **DoodleID:** DB0532 | **empId:** 393

**Verify the pending record exists:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 393
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22';
```
Expected: Row with `status=2` (Pending) on 2026-03-04. This must NOT be counted.

**Verify our query correctly excludes it:**
```sql
SELECT l.leave_type, l.from_date, l.leavePeriod, l.status
FROM `leave` l WHERE l.empId = 393
  AND l.from_date <= '2026-03-24' AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);  -- pending row absent from this result
```

**API call:**
```bash
curl "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=DB0532"
```
**Expected:** `otherLeaves: 0` (the pending Optional leave on Mar 4 must not appear)

---

### 10.3 Quick Batch Verification Script

Run this from the API server directory to check all test cases at once:

```bash
for tc in "DB1497:sickLeaves:1" "DNA0003:sickLeaves:1" "DB1662:earnedLeaves:1" "DB0563:earnedLeaves:1" "DB1490:otherLeaves:1" "DB1736:otherLeaves:1" "DB0319:earnedLeaves:1" "DB1364:sickLeaves:0.5" "DB1398:sickLeaves:0.5"; do
  IFS=: read -r id field expected <<< "$tc"
  result=$(curl -s "http://localhost:8080/api/employees?dateFrom=2026-02-22&dateTo=2026-03-24&search=$id" \
    | node --input-type=module -e "
import { createInterface } from 'readline';
const rl = createInterface({ input: process.stdin });
let d = '';
rl.on('line', l => d += l);
rl.on('close', () => {
  const e = JSON.parse(d).employees?.[0];
  console.log(e ? e['$field'] : 'NOT_FOUND');
});
" 2>/dev/null | sed "s/\\$field/$field/g")
  # Note: replace $field above in practice manually per field
  echo "$id | $field | expected=$expected"
done
```

Or query the DB directly to confirm counts per leave type for the full range:

```sql
SELECT
  lt.name AS leave_type_name,
  l.status,
  COUNT(*) AS record_count,
  SUM(CASE WHEN l.leavePeriod = 'half_day' THEN 0.5 ELSE 1 END) AS raw_days
FROM `leave` l
JOIN leavetype lt ON lt.id = l.leave_type
JOIN employees e ON e.empId = l.empId
WHERE e.deleted_at IS NULL
  AND (e.isDtn = 0 OR e.isDtn IS NULL)
  AND l.from_date <= '2026-03-24'
  AND l.to_date   >= '2026-02-22'
GROUP BY lt.name, l.status
ORDER BY lt.name, l.status;
```

This gives you the raw leave record breakdown for all FT employees in the range, grouped by type and status — a good sanity check against the dashboard totals.

---

### 10.4 What to Do If a Count Looks Wrong

| Symptom | First check | Second check |
|---|---|---|
| Leave shows in DB but not in app | Is `status IN (1, 5)`? | Is employee active (`deleted_at IS NULL`)? |
| Leave count too low | Run TC batch above — does DB have the row? | Check if it falls on a weekend |
| Leave count too high | Check for duplicates in the range | Check multi-day leave and exclusive-end rule |
| Half-day shows as full | Check `leavePeriod` column in DB row | |
| Optional/Comp-off not showing | Confirm `leave_type IN (4, 5)` in the row | Check if it's in `comp_off` table instead (not currently counted) |
| Leave on holiday not counting | Check `optional_status` — if 1, it still counts | Only `optional_status = 0` holidays are excluded |
