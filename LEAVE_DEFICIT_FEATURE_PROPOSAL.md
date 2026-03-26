# Leave Deficit Feature — Client Approval Document

**Prepared by:** HR Dashboard Development Team  
**Date:** March 26, 2026  
**Status:** Ready for Implementation (All questions answered from DB)

---

## Background

Employees can apply for Earned Leaves (EL) or Sick/Emergency Leaves (SL) even when their
available balance is zero or insufficient. When this happens, the Doodle360 system already
records the deficit in a table called `employee_leave_lag` under the column `insufficientLeaves`.

Currently the HR Dashboard **does not read this deficit data** — it only shows how many
leaves were taken, with no indication that some were taken without balance.

This proposal adds visibility into that deficit so HR can monitor and act on it.

---

## Leave Policy (as provided by client)

| Leave Type | Accrual Rate | Annual Total |
|---|---|---|
| Earned Leave (EL) | 1 day per month | 12 days/year |
| Sick / Emergency Leave (SL) | 2 days per quarter | 8 days/year |
| Other (Comp-off, Optional Holiday, etc.) | No fixed balance | Not tracked for deficit |

> Deficit tracking applies **only to EL and SL** since only these two have a defined balance policy.

---

## 4 Questions — Answered from Database Analysis

---

### Q1. Is `employee_leave_lag` the right source?

**Answer: YES — it is the only source.**

There is no other balance, quota, or entitlement table in the database.
`employee_leave_lag` is the single table that records leave deficits.

Database evidence:
```
Total deficit records (status=1): 49 rows
Unique employees ever in deficit:  42 employees
Date range covered:                July 2023 → March 2026
Total deficit days recorded:       27.5 days
```

---

### Q2. Which status values to include?

**Answer: Only `status = 1`**

| Status | Records | Total Deficit Days | Meaning |
|---|---|---|---|
| 0 | 7 | **0.0** | All have insufficientLeaves = 0 — draft/pending, no actual deficit |
| 1 | 49 | **27.5** | Active deficit records — these are the real ones |

`status = 0` records have zero deficit value and are not meaningful.
We will filter `WHERE status = 1` only.

---

### Q3. Should deficit carry over across months or only show within selected range?

**Answer: NO carry-over — show deficit only within selected range.**

The data confirms:
- **No employee has deficit records across multiple months** — each deficit record is isolated to the month it was created
- **One record per employee per month per leave type** — confirmed, no duplicates
- Each month's deficit is independent — the system records fresh for each month

```
Example confirmed from DB:
  empId=675, March 2026, EL → deficit=4 (all in March 2026 only)
  empId=1363, March 2025, SL → deficit=2 (all in March 2025 only)
  No employee has deficit in Jan + Feb + March combined
```

**Implementation:** Show deficit only for months that overlap with the user's selected date range.
If the user selects March 10–20 and no leave was taken in that window → no deficit shown.

---

### Q4. Should Final Total replace or sit alongside existing Total?

**Answer: Keep both — show side by side.**

Since HR needs to **verify** the numbers, we will keep:
- **Total Leaves** = raw leaves taken (existing, unchanged)
- **Final Total** = Total Leaves minus deficit (new column)

This way HR can see:
- How many days were actually taken
- How many days were taken beyond balance
- What the net position is after accounting for deficit

---

## What the Feature Shows

For any selected date range:

| Column | Description | Example |
|---|---|---|
| **EL Taken** | Raw earned leaves taken | 4 |
| **EL Deficit** | Days taken beyond EL balance (red, negative) | -3 |
| **SL Taken** | Raw sick/emergency leaves taken | 2 |
| **SL Deficit** | Days taken beyond SL balance (red, negative) | 0 |
| **Other Leaves** | Unchanged — no deficit applies | 1 |
| **Total Leaves** | Raw total taken (existing column, unchanged) | 7 |
| **Final Total** | Total minus all deficits (new column) | 4 |

### Example Table Row

| Employee | EL Taken | EL Deficit | SL Taken | SL Deficit | Other | Total | Final Total |
|---|---|---|---|---|---|---|---|
| Riyaz Ahmed | 4 | **-3** 🔴 | 1 | 0 | 2 | 7 | 4 |
| Priya S | 2 | 0 | 2 | **-2** 🔴 | 0 | 4 | 2 |
| Akash M | 0 | 0 | 1 | 0 | 1 | 2 | 2 |
| Normal Emp | 2 | 0 | 1 | 0 | 0 | 3 | 3 |

> 🔴 Red = employee took leave beyond their entitled balance for that period.
> Employees with no deficit → EL Deficit and SL Deficit show as `—` (dash).

---

## How Date Range Selection Works

The `employee_leave_lag` table stores deficit per **month and year**.
For any custom date range the user picks:

```
User selects: March 10 – March 20, 2026

Step 1: Find leaves actually taken within March 10–20 (from leave table)
Step 2: Extract months covered by range → [March 2026]
Step 3: Fetch deficit for those months from employee_leave_lag
Step 4: Show deficit only if leaves were taken in that window

Result:
  No leave in March 10–20   →  no deficit shown ✅
  2 EL taken in March 10–20 →  March 2026 deficit shown ✅

User selects: Jan 1 – Mar 31, 2026
  Months covered: Jan, Feb, Mar 2026
  Deficit summed across all 3 months for each employee ✅
```

---

## Impact — What Changes in the App

### 1. Employee List Page

**Before:**
```
Earned Leaves | Sick Leaves | Other Leaves | Total Leaves
      4               2              1              7
```

**After:**
```
EL Taken | EL Deficit | SL Taken | SL Deficit | Other | Total | Final Total
    4         -3           2          0           1       7         4
```

Color coding:
- Deficit columns → Red text with negative sign when deficit > 0
- Deficit = 0 → shown as `—` for cleanliness
- Final Total → Red when it goes negative

---

### 2. Employee Report Page (Individual)

New deficit cards added in the leave breakdown:

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ EL Taken   │  │ EL Deficit │  │ SL Taken   │  │ SL Deficit │
│  4 days    │  │  -3 days🔴 │  │  2 days    │  │  0 days    │
└────────────┘  └────────────┘  └────────────┘  └────────────┘

┌────────────┐  ┌────────────┐
│ Total      │  │ Final Total│
│  7 days    │  │  4 days    │
└────────────┘  └────────────┘
```

---

### 3. CSV Export

New columns added to the downloaded file:

```
Name | ... | EL Taken | EL Deficit | SL Taken | SL Deficit | Other | Total | Final Total | Lag Days | ...
```

---

## What Does NOT Change

| Area | Status |
|---|---|
| Other Leaves (comp-off, optional holiday) | No change — no balance policy |
| Lag Days calculation | No change |
| Dashboard summary widgets | No change |
| Departed employee logic | No change |
| All existing filters | No change |
| Leave approval statuses (1 and 5) | No change |

---

## Files That Need Code Changes

| File | Change |
|---|---|
| `artifacts/api-server/src/routes/employees.ts` | Add deficit query from `employee_leave_lag` (status=1 only); attach `elDeficit`, `slDeficit` per employee; update CSV export |
| `artifacts/hr-dashboard/src/pages/EmployeeList.tsx` | Add EL Deficit, SL Deficit, Final Total columns; red color for negatives |
| `artifacts/hr-dashboard/src/pages/EmployeeReport.tsx` | Add deficit cards; Final Total card |
| `replit.md` | Update business logic documentation |

**Total files to change: 4**

---

## Current Deficit Data in DB (as of March 26, 2026)

| Month | Employees with EL Deficit | Employees with SL Deficit |
|---|---|---|
| March 2026 | 1 (empId 675, deficit=4) | 2 (empId 1376, 1627 — deficit=1 each) |
| March 2025 | 0 | 1 (empId 1363, deficit=2) |
| Feb 2025 | 1 (empId 1315, deficit=1) | 0 |
| Jan 2025 | 1 (empId 1274, deficit=1) | 0 |
| Sep 2024 | 0 | 1 (empId 1061, deficit=2) |
| Apr 2024 | 0 | 1 (empId 747, deficit=1) |
| Feb 2024 | 0 | 1 (empId 922, deficit=1) |
| Jan 2024 | 0 | 1 (empId 607, deficit=1.5) |

**Total: 42 unique employees have ever had a deficit since July 2023.**

---

*All 4 questions answered from database analysis. Ready to implement.*
