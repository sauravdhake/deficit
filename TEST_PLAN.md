# HR Productivity Dashboard — Complete Test Plan

**Base URL (AWS):** `http://13.232.220.60`  
**API Base:** `http://13.232.220.60/api`  
**Swagger UI:** `http://13.232.220.60/api/docs`

---

## Legend
- ✅ Pass — behavior matches expected
- ❌ Fail — bug / mismatch found
- ⚠️ Warning — works but needs attention

---

## MODULE 1 — Dashboard Page (`/`)

### TC-D01 · Page Load & Stat Cards

**Steps:**
1. Open `http://13.232.220.60`
2. Default date range should be last Mon–Fri (e.g. 16 Mar → 20 Mar 2026)
3. Check the three stat cards at the top

**Expected:**
- Total Employees > 0
- Full Time (FT) = Total Employees − DTN Resources
- DTN Resources > 0
- No spinner stuck; all 3 cards load within 3 seconds

**DB Verify:**
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN isDtn = 0 OR isDtn IS NULL THEN 1 ELSE 0 END) AS ft,
       SUM(CASE WHEN isDtn = 1 THEN 1 ELSE 0 END) AS dtn
FROM doodle360_staging.employees
WHERE status = 1 AND deleted_at IS NULL;
```

---

### TC-D02 · Resource Count by Project Type Table

**Steps:**
1. On dashboard, scroll to "Resource Count by Project Type" table
2. Note the rows (Retainer, Fixed Fee, T&M, etc.)
3. Check that FT + DTN = Total for each row

**Expected:**
- Each row: FT + DTN = Total
- Row totals add up to roughly Total Employees
- No "No data available" when employees exist

---

### TC-D03 · Employee Leave Analytics Table

**Steps:**
1. Check the "Employee Leave Analytics" card
2. Rows should include: Earned Leave (EL), Sick/Emergency (SL), Other

**Expected:**
- Categories shown: Earned Leave, Sick/Emergency, Other (only rows with at least 1 leave)
- FT Leaves + DTN Leaves = Total Leaves per row
- If no leaves in date range → table shows "No data available"

**DB Verify (for active date range):**
```sql
SELECT l.leave_type, COUNT(*) AS cnt
FROM doodle360_staging.`leave` l
JOIN doodle360_staging.employees e ON e.empId = l.empId
WHERE e.status = 1
  AND l.status IN (1, 5)
  AND l.from_date <= '2026-03-20'
  AND l.to_date >= '2026-03-16'
GROUP BY l.leave_type;
```
- leave_type 2 → Earned Leave
- leave_type 1 → Sick/Emergency
- leave_type 3, 4, 5 → Other

---

### TC-D04 · Resource Productivity Donut

**Steps:**
1. Check the donut chart with productivity percentage

**Expected:**
- Percentage shown inside donut (e.g. 87%)
- Blue arc = achieved, grey arc = gap
- Blue + grey = 100% visually
- If 100% → full blue circle, 0% gap

**DB Verify:**
```sql
SELECT 
  COUNT(DISTINCT oe.emp_id) AS activeEmployees,
  COUNT(DISTINCT oe.task_date) AS daysLogged
FROM doodle360_staging.other_eods oe
WHERE oe.task_date BETWEEN '2026-03-16' AND '2026-03-20'
  AND oe.status = 1 AND oe.hours_spent > 0;
```

---

### TC-D05 · Weekly Productivity Trend Chart

**Steps:**
1. Observe the line chart ("Weekly Productivity Trend")
2. Click "Last Week" preset — chart should update
3. Click "Monthly" preset — chart should update with more data points

**Expected:**
- Last Week: 5 data points (Mon–Fri)
- Monthly: data points for each week or day in the current month
- Line chart tooltip shows productivity % on hover
- No blank chart when data exists

---

### TC-D06 · Date Range Picker — Custom Range

**Steps:**
1. Click the "From" date button → select a date (e.g. 02 Mar 2026)
2. "To" picker should auto-open
3. Select To date (e.g. 14 Mar 2026)
4. Click "Apply"
5. All dashboard cards should reload with new data

**Expected:**
- Selecting From auto-opens To
- Selecting To closes picker
- Today's date is NOT double-highlighted (no extra ring)
- Apply triggers all API calls with new dateFrom/dateTo
- Stat cards, tables, charts all refresh

---

### TC-D07 · Productivity Lags Section

**Steps:**
1. Scroll to "Productivity Lags" section at bottom of dashboard
2. Cards should show categories (Retainer, Fixed Fee, etc.) with lagging count
3. Click the "X Lagging →" button on any card

**Expected:**
- Dialog opens showing a table of lagging employees for that category
- Table columns: Employee, ID, Team, Lag (Days)
- Lag Days badge: red if ≥5, yellow/orange if ≥2, green if <2
- "No lagging resources found" if count = 0

---

## MODULE 2 — Employee List Page (`/employees`)

### TC-E01 · Page Load & Default Display

**Steps:**
1. Click "Employee List" button in top-right
2. Page loads with same date range as dashboard

**Expected:**
- Table shows employees with columns: Employee, Emp ID, Team, Grade, Earned L., Sick/Emerg., Other L., Total L., Lag Days, HR Comment, PM Comment
- Showing "X of Y employees" count visible
- No `.trim()` text visible in any name

---

### TC-E02 · Search by Name

**Steps:**
1. Type a partial name in the search box (e.g. "Riyaz")
2. Table should filter in real-time

**Expected:**
- Only matching employees shown
- "Showing 1 of 1 employees" (or correct count)
- Clear search → full list returns

---

### TC-E03 · Search by Doodle ID

**Steps:**
1. Type a Doodle ID in search box (e.g. "DB1029")

**Expected:**
- Exactly 1 employee row shown
- Leave and lag data matches DB for that employee

---

### TC-E04 · Lag Filter — Lagging

**Steps:**
1. Click "Lagging" segment button next to search
2. List filters to only employees with lag > 0

**Expected:**
- All shown employees have Lag Days > 0 (orange/red badge)
- "On Track" employees hidden
- Count updates accordingly

---

### TC-E05 · Lag Filter — On Track

**Steps:**
1. Click "On Track" segment button

**Expected:**
- All shown employees have Lag Days = 0
- Lagging employees hidden
- DTN employees and exempt teams (e.g. HR) appear as 0 lag here

---

### TC-E06 · Lag Filter — All

**Steps:**
1. Click "All" to reset

**Expected:**
- Full employee list returned
- Both lagging and on-track employees visible

---

### TC-E07 · Leave Counts Accuracy

**Steps:**
1. Search for a known employee (e.g. DB1029 — Riyaz Ahmed)
2. Note Earned L., Sick/Emerg., Other L., Total L. values

**Expected (for Riyaz, range 22 Feb → 24 Mar 2026):**
- Earned L. = 1
- Sick/Emerg. = 0
- Other L. = 3
- Total L. = 4

**DB Verify:**
```sql
SELECT l.leave_type, l.from_date, l.to_date, l.leavePeriod, l.status
FROM doodle360_staging.`leave` l
WHERE l.empId = 895
  AND l.from_date <= '2026-03-24'
  AND l.to_date >= '2026-02-22'
  AND l.status IN (1, 5);
```

---

### TC-E08 · Export CSV

**Steps:**
1. Click "Export CSV" button (top right of employee list)
2. File downloads

**Expected:**
- Filename format: `employees_YYYY-MM-DD_YYYY-MM-DD.csv`
- Columns: Name, Employee ID, Type, Team, Grade, Earned Leaves, Sick Leaves, Total Leaves, Lag Days, HR Comment, PM Comment
- Name column: no `.trim()` text — just clean name (e.g. `"Riyaz Ahmed"`)
- Numbers are numeric (not strings)
- Each row corresponds to one employee

---

## MODULE 3 — Employee Report Page

### TC-R01 · Navigate to Report

**Steps:**
1. On Employee List, click any employee row
2. Report page opens

**Expected:**
- URL changes to `/employees/:empId/report`
- Employee name, Doodle ID, Team, Grade shown in header
- Same date range applies

---

### TC-R02 · Leave Breakdown Table

**Steps:**
1. On report page, check the leave breakdown section

**Expected:**
- Individual leave records shown: date, type (EL/SL/Other), days, period (Full Day / Half Day), status
- Totals match what was shown in Employee List

---

### TC-R03 · Productivity Trend on Report

**Steps:**
1. Check the productivity/EOD trend chart on report page

**Expected:**
- Day-by-day bars or line showing EOD logged vs expected
- Highlights days where EOD was not submitted

---

### TC-R04 · Manager's Notes (PM Comments)

**Steps:**
1. Scroll to the HR Comments card
2. Check the amber "Manager's Notes" block above the textarea

**Expected:**
- Block always visible (not hidden behind date range)
- Shows latest PM comments (up to 5)
- Each note shows commenter name + date + text
- If no PM notes → block shows "No manager notes available"

---

### TC-R05 · HR Comment Save

**Steps:**
1. Type a comment in the textarea
2. Click "Save Comment"

**Expected:**
- Success toast/message appears
- Comment persists on page reload
- Comment appears in Employee List table under "HR Comment" column

---

## MODULE 4 — API Endpoints (via Swagger or curl)

### TC-A01 · Health Check
```bash
curl http://13.232.220.60/api/healthz
```
**Expected:** `200 OK`

---

### TC-A02 · Employees List with Filters
```bash
curl "http://13.232.220.60/api/employees?dateFrom=2026-03-16&dateTo=2026-03-20&lagFilter=has_lag&page=1&limit=10"
```
**Expected:** JSON with `total`, `page`, `limit`, `employees[]` — all employees have `lagDays > 0`

---

### TC-A03 · Employee Export (CSV name check)
```bash
curl -o test.csv "http://13.232.220.60/api/employees/export?dateFrom=2026-03-16&dateTo=2026-03-20"
head -5 test.csv
```
**Expected:** First column (Name) has clean names — no `.trim()` suffix

---

### TC-A04 · Employee Report
```bash
curl "http://13.232.220.60/api/employees/895/report?dateFrom=2026-02-22&dateTo=2026-03-24"
```
**Expected:** JSON with `earnedLeaves: 1`, `otherLeaves: 3`, `totalLeaves: 4`

---

### TC-A05 · Swagger UI
Open: `http://13.232.220.60/api/docs`

**Expected:**
- Swagger UI loads with all endpoints listed
- "Try it out" works on at least `/api/employees` and `/api/dashboard/summary`

---

## MODULE 5 — Edge Cases

### TC-X01 · Date range with no leaves
**Steps:** Set date range to a future week (e.g. 01 Jun → 05 Jun 2026)

**Expected:**
- Leave Analytics table: "No data available"
- All employee leave columns show 0
- Productivity % may be 0 or show no data

---

### TC-X02 · Single day range
**Steps:** Set From and To to the same date (e.g. 17 Mar 2026)

**Expected:**
- Dashboard loads without error
- Productivity shows 1 working day as max

---

### TC-X03 · Search with no results
**Steps:** Type a random string that matches no employee (e.g. "ZZZZZZ")

**Expected:**
- "Showing 0 of 0 employees"
- No error, no crash

---

*Last updated: March 2026*
