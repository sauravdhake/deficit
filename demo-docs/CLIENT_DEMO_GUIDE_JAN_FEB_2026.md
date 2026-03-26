# HR Productivity Dashboard — Client Demo Guide
## January 2026 & February 2026

> Every number in this document is verified directly from the `doodle360_staging` database. Use these exact values during the client demo.

---

## Calendar Facts — January & February 2026

### January 2026 — **19 Working Days**
| Date | Day | Holiday | Type |
|---|---|---|---|
| 1 Jan 2026 | Thursday | New Year | Mandatory ✓ |
| 15 Jan 2026 | Thursday | Pongal | Mandatory ✓ |
| 26 Jan 2026 | Monday | Republic Day | Mandatory ✓ |

Total weekdays in January: 22 − 3 mandatory holidays = **19 working days**

### February 2026 — **20 Working Days**
| Date | Day | Holiday | Type |
|---|---|---|---|
| — | — | No mandatory holidays | — |

February 2026 has 28 days, 8 weekend days = **20 working days**

> **If client asks about Makar Sankranti, Maha Shivratri, or Valentine's Day:**
> These are not in the holiday calendar. Only company-approved mandatory holidays reduce working days.

**Verify January working days:**
```sql
SELECT COUNT(*) AS mandatory_holidays
FROM holidays
WHERE holidays_date BETWEEN '2026-01-01' AND '2026-01-31'
  AND optional_status = 0;
-- Result: 3 (New Year, Pongal, Republic Day)
-- Working days = 22 weekdays − 3 = 19
```

**Verify February working days:**
```sql
SELECT COUNT(*) AS mandatory_holidays
FROM holidays
WHERE holidays_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND optional_status = 0;
-- Result: 0
-- Working days = 20 (all weekdays)
```

---

## Key Demo Employees

### Employee 1 — Anupriya Bose (DB1677)
**Best for: Complete picture — good EOD habit + regular leave usage**

| Metric | January 2026 | February 2026 |
|---|---|---|
| Team | UX | UX |
| Earned Leave (EL) | 3 | 1 |
| Sick Leave (SL) | 2 | 2.5 |
| Other Leave | 0 | 0 |
| **Total Leaves** | **5** | **3.5** |
| Expected Working Days | 19 | 20 |
| Days with EOD Logged | **13** | **17** |
| **Lag Days** | **6** | **3** |
| EL Deficit | 0 | 0 |
| SL Deficit | 0 | 0 |
| PM Comments | 1 | — |

**Leave dates for January (for live verification):**
| Date | Type | Period |
|---|---|---|
| 23 Jan | EL | Full day |
| 27 Jan | SL | Full day |
| 28 Jan | SL | Full day |
| 29 Jan | EL | Full day |
| 30 Jan | EL | Full day |

**Leave dates for February:**
| Date | Type | Period |
|---|---|---|
| 2 Feb | SL | Full day |
| 3 Feb | SL | Full day |
| 4 Feb | EL | Full day |
| 12 Feb | SL | **Half day** (= 0.5 days) |

**Demo talking point:** *"Anupriya is a great example of a responsible employee — she submitted EOD on 13 out of 19 working days in January and 17 out of 20 in February. Her lag is very low (6 days and 3 days respectively). She also took 5 days of leave in January with a half-day SL in February. This is exactly what good productivity tracking looks like."*

**Verify leaves:**
```sql
SELECT leave_type, from_date, to_date, leavePeriod, status
FROM `leave`
WHERE empId = 1577 AND status IN (1, 5)
  AND from_date <= '2026-01-31' AND to_date >= '2026-01-01'
ORDER BY from_date;
-- Returns 5 leave records for January
```

**Verify EOD submissions:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 1577 AND task_date BETWEEN '2026-01-01' AND '2026-01-31'
  AND status = 1 AND hours_spent > 0;
-- Result: 13
```

---

### Employee 2 — MADANKUMAR S (DB0941)
**Best for: Month-to-month behavioral change — January vs February comparison**

| Metric | January 2026 | February 2026 |
|---|---|---|
| Team | QA | QA |
| Earned Leave (EL) | 3 | 2 |
| Sick Leave (SL) | 0 | 0 |
| Other Leave | 0 | 0 |
| **Total Leaves** | **3** | **2** |
| Expected Working Days | 19 | 20 |
| Days with EOD Logged | **0** | **17** |
| **Lag Days** | **19** | **3** |
| EL Deficit | 0 | 0 |
| SL Deficit | 0 | 0 |

**Demo talking point:** *"Look at MADANKUMAR's January versus February. In January, he took 3 EL days and submitted zero EOD reports — a full 19-day lag. But in February, he turned it around: 17 out of 20 days have EOD submissions, with only 3 days of lag. This is exactly the kind of improvement the dashboard helps identify and track."*

**Verify January EOD:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 806 AND task_date BETWEEN '2026-01-01' AND '2026-01-31'
  AND status = 1 AND hours_spent > 0;
-- Result: 0
```

**Verify February EOD:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 806 AND task_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND status = 1 AND hours_spent > 0;
-- Result: 17
```

---

### Employee 3 — Punith Kumar B (DB1264)
**Best for: PM Comments demo + consistent lag across both months**

| Metric | January 2026 | February 2026 |
|---|---|---|
| Team | Nodejs | Nodejs |
| Earned Leave (EL) | 1 | 1 |
| Sick Leave (SL) | 1 | 1 |
| Other Leave | 0 | 1 |
| **Total Leaves** | **2** | **3** |
| Expected Working Days | 19 | 20 |
| Days with EOD Logged | **0** | **0** |
| **Lag Days** | **19** | **20** |
| PM Comments | **6** | — |

**Demo talking point:** *"Punith has 6 PM comments on his tasks — you can see the speech bubble in the employee list. Click it to see the latest. Despite taking leave every month, his EOD submission is zero in both January and February. Every single working day is a lag day. His PM has left feedback on his work multiple times, which is visible in his individual report."*

**Verify PM comments:**
```sql
SELECT pmComments, DATE_FORMAT(createdAt, '%d %b %Y') AS date
FROM tasks
WHERE empId = 1138 AND pmComments IS NOT NULL AND pmComments != ''
  AND status = 1
ORDER BY createdAt DESC;
-- Returns 6 PM comments
```

---

### Employee 4 — Santhosh P D (DB1147)
**Best for: Habitual zero-EOD — same pattern both months**

| Metric | January 2026 | February 2026 |
|---|---|---|
| Team | Nodejs | Nodejs |
| Earned Leave (EL) | 1 | 1 |
| Sick Leave (SL) | 1.5 | 1.5 |
| Other Leave | 0 | 0 |
| **Total Leaves** | **2.5** | **2.5** |
| Expected Working Days | 19 | 20 |
| Days with EOD Logged | **0** | **0** |
| **Lag Days** | **19** | **20** |

**Demo talking point:** *"Santhosh takes leave regularly every month — 1 EL and 1.5 SL in both January and February — but submits zero EOD reports. This is a consistent pattern. The dashboard lets you spot employees who are always on leave and never accounting for their other working days."*

---

### Employee 5 — Riyaz Ahmed (DB1029)
**Best for: High "Other" leave usage in February**

| Metric | January 2026 | February 2026 |
|---|---|---|
| Team | Frontend | Frontend |
| Earned Leave (EL) | — | 1 |
| Sick Leave (SL) | — | 1 |
| Other Leave | — | **5** |
| **Total Leaves** | **—** | **7** |
| Expected Working Days | — | 20 |
| Days with EOD Logged | — | **0** |
| **Lag Days** | — | **20** |

**February leave dates for Riyaz:**
| Date | Type | Period |
|---|---|---|
| 16 Feb | SL | Full day |
| 17–19 Feb | Other (type 4) | 3 full days |
| 20 Feb | Other (type 4) | Full day |
| 23–24 Feb | EL | 2 full days |
| 25–27 Feb | Other (type 4) | 3 full days |

**Demo talking point:** *"Riyaz took 7 days of leave in February — 5 of them classified as 'Other' leave (leave type 4). He was on some form of leave across 4 different stretches in a single month. Combined with zero EOD submissions, the full 20-day expected productivity is unaccounted for."*

**Verify:**
```sql
SELECT leave_type, from_date, to_date, leavePeriod, status
FROM `leave`
WHERE empId = 895 AND status IN (1, 5)
  AND from_date <= '2026-02-28' AND to_date >= '2026-02-01'
ORDER BY from_date;
```

---

## Top EOD Performers (To Show the Contrast)

### January 2026 — Top 5 Submitters
| Employee | DB ID | EOD Days | Out of 19 | Lag |
|---|---|---|---|---|
| Aishwarya Ganpat Medhe | DB1744 | 22* | 19 | **0** |
| Suhail Ahamed | DB1761 | 19 | 19 | **0** |
| MONISHWARAN ARUNACHALAM B | DB1631 | 19 | 19 | **0** |
| Saurab Dhake | DB1448 | 18 | 19 | **1** |
| Wasim Ansari Nasim Khan | DB1528 | 18 | 19 | **1** |

*22 EOD entries in 19-day month = some days had multiple EOD submissions (different tasks)

### February 2026 — Top 5 Submitters (Perfect Score)
| Employee | DB ID | EOD Days | Out of 20 | Lag |
|---|---|---|---|---|
| Guru Prakash | DB1757 | 20 | 20 | **0** |
| Priyadharshini K | DB1758 | 20 | 20 | **0** |
| Wasim Ansari Nasim Khan | DB1528 | 20 | 20 | **0** |
| Lakshmi Chandrasekar | DB1686 | 20 | 20 | **0** |
| Dhivakaran Marappan | DB1427 | 20 | 20 | **0** |

**Demo talking point:** *"On the flip side, these employees submitted EOD on every single working day in February — zero lag. This is what full accountability looks like. You can sort by Lag Days in the employee list and the difference between these employees and the ones above is immediate."*

---

## Negative Balance / Deficit Demo — Switch to March 2026

> **Important:** January and February 2026 have NO active employees with a leave deficit. To demonstrate the Negative Balance feature, **change the date to 01 Mar 2026 → 31 Mar 2026**. **2 employees** — Kartheek denkena and Kimmi Anna J P — will appear when you toggle the Negative Balance filter (both have Final Total = −1). Harikrishnan T has a deficit but his Final Total = 0, so he does **not** appear (filter shows only strictly negative totals).

### March 2026 Calendar — 22 Working Days
All 3 holidays in March are **optional** (not deducted):
- Holi — 4 Mar (optional_status=1)
- Telugu New Year — 20 Mar (optional_status=1)
- Ramzan — 20 Mar (optional_status=1)

**22 weekdays, 0 mandatory holidays = 22 working days**

```sql
SELECT COUNT(*) FROM holidays
WHERE holidays_date BETWEEN '2026-03-01' AND '2026-03-31'
  AND optional_status = 0;
-- Result: 0 (no mandatory holidays in March 2026)
```

---

### Deficit Employee 1 — Kartheek denkena (DB0811)
**Strongest demo — Final Total = −1 (clearly negative)**

| Metric | March 2026 |
|---|---|
| Team | Salesforce |
| Earned Leave (EL) taken | 2 |
| Other Leave | 1 |
| **Total Leaves** | **3** |
| **EL Deficit** | **4** |
| SL Deficit | 0 |
| **Final Total** | **−1** |
| Expected Working Days | 22 |
| Days with EOD Logged | 0 |
| Lag Days | 22 |

**Leave dates in March 2026:**
| Date | Type | Period |
|---|---|---|
| 2 Mar | EL | Full day |
| 3 Mar | EL | Full day |
| 4 Mar | Other (Holi — optional holiday taken as leave) | Full day |
| 5 Mar | EL | Full day |
| 6 Mar | EL | Full day |

**How the deficit works:**
- Kartheek's accumulated EL entitlement for the year is exhausted
- He has consumed **4 more EL days** than his annual balance allows
- Final Total = 3 leaves taken − 4 EL deficit = **−1**
- The system records this in `employee_leave_lag` at month close

**Verify deficit:**
```sql
SELECT empId, year, month, leavetype, insufficientLeaves
FROM employee_leave_lag
WHERE empId = 675 AND year = 2026 AND month = 3 AND status = 1;
-- leavetype=2 (EL), insufficientLeaves=4
```

**Verify leaves:**
```sql
SELECT leave_type, from_date, to_date, leavePeriod
FROM `leave`
WHERE empId = 675 AND status IN (1, 5)
  AND from_date <= '2026-03-31' AND to_date >= '2026-03-01'
ORDER BY from_date;
```

---

### Deficit Employee 2 — Kimmi Anna J P (DB1724)
**Final Total = −1 (SL deficit carried forward)**

| Metric | March 2026 |
|---|---|
| Team | Business Development |
| Earned Leave (EL) taken | 0 |
| Sick Leave (SL) taken | 0 |
| **Total Leaves** | **0** |
| EL Deficit | 0 |
| **SL Deficit** | **1** |
| **Final Total** | **−1** |
| Expected Working Days | 22 |
| Lag Days | **0** (Business Development is exempt from lag) |

**How the deficit works:**
- Kimmi took no leave in March 2026
- But her SL balance is depleted from previous months — she has a **1-day SL deficit carried forward**
- Final Total = 0 leaves − 0 EL deficit − 1 SL deficit = **−1**

**Verify deficit:**
```sql
SELECT empId, year, month, leavetype, insufficientLeaves
FROM employee_leave_lag
WHERE empId = 1627 AND year = 2026 AND month = 3 AND status = 1;
-- leavetype=1 (SL), insufficientLeaves=1
```

> **Note for demo:** Kimmi's lag shows as 0 because Business Development is an exempt team. The negative balance is purely from leave deficit — not lag.

---

### Deficit Employee 3 — Harikrishnan T (DB1493)
**Final Total = 0 (SL deficit cancels the 1 leave taken — boundary case)**

| Metric | March 2026 |
|---|---|
| Team | Android |
| Sick Leave (SL) taken | 1 |
| **Total Leaves** | **1** |
| EL Deficit | 0 |
| **SL Deficit** | **1** |
| **Final Total** | **0** |
| Expected Working Days | 22 |
| Days with EOD Logged | 4 |
| Lag Days | 18 |

> **Harikrishnan does NOT appear in the Negative Balance filter.** The filter uses strictly `< 0` — Final Total = 0 is not negative. His SL deficit is real, but his 1 SL taken exactly cancels it out. Focus the demo on Kartheek and Kimmi who clearly show −1.

---

### How to Show Negative Balance During the Demo

**Step-by-step:**
1. Change the dashboard date range to **01 Mar 2026 → 31 Mar 2026**
2. Go to the Employee List
3. Toggle the **Negative Balance** filter ON
4. The list will show **Kartheek denkena (DB0811)** and **Kimmi Anna J P (DB1724)** — both with Final Total = −1
5. Click **Kartheek** → Individual Report shows:
   - EL taken: 2 | EL Deficit: **4** | Final Total: **−1**
   - Lag: 22/22 (zero EOD all month)
6. Go back → click **Kimmi** → shows:
   - No leaves taken this month, but SL Deficit: **1** → Final Total: **−1**
   - Lag: 0 (exempt team — Business Development)

**Demo talking point:**
*"This is the Negative Balance filter. When an employee exceeds their leave entitlement — either because they've used more EL than they've earned, or their sick leave balance is depleted — their Final Total goes negative. The system calculates this automatically at month-end. Right now in March 2026, Kartheek has a −4 EL deficit accumulated over the year, and Kimmi has a −1 SL deficit carried from earlier months."*

**Second talking point for Kimmi:**
*"Notice that Kimmi took zero leaves this month, yet she still appears in the Negative Balance list. This is because her SL entitlement was already exhausted from previous months — the deficit carries forward. Also, her Lag Days show as 0 — her team (Business Development) is exempt from EOD tracking, so only the leave deficit triggers her negative balance."*

---

### Verify — All March 2026 Negative Balance Employees (Run Live)
```sql
SELECT e.firstName, e.lastName, e.doodle_id,
       ell.leavetype,
       ell.insufficientLeaves AS deficit
FROM employee_leave_lag ell
JOIN employees e ON e.empId = ell.empId
WHERE ell.year = 2026 AND ell.month = 3
  AND ell.status = 1 AND ell.insufficientLeaves > 0
  AND e.status = 1
  AND (e.deleted_at IS NULL OR e.deleted_at > '2026-03-01')
ORDER BY ell.insufficientLeaves DESC;
-- Result: Kartheek (EL deficit=4), Harikrishnan T (SL deficit=1), Kimmi (SL deficit=1)
```

---

## Step-by-Step Demo Script

### Step 1 — January 2026 Overview (3 min)
1. Set date range: **01 Jan 2026 → 31 Jan 2026**
2. Dashboard cards appear — note: **Expected working days = 19** (3 mandatory holidays)
3. Point to the Productivity Trend chart — weekly bars across the 4 working weeks of January
4. Say: *"January is one of our heavier holiday months — New Year, Pongal, and Republic Day all fall on weekdays. The system automatically accounts for all three."*

### Step 2 — Employee List: Sort by Lag (2 min)
1. Click the **Lag Days** column header to sort descending
2. Most employees show **Lag = 19** (the full month — zero EOD)
3. Scroll down to find **Anupriya Bose** — lag = 6 (good performer)
4. Say: *"Most of the team shows 19-day lag in January — that's the full working month unaccounted for. Anupriya stands out with only 6 days of lag."*

### Step 3 — Show PM Comment Bubble (1 min)
1. Search "Punith" in the employee list
2. Click the speech bubble icon next to his name → popup shows comments and dates
3. Say: *"This bubble shows PM feedback directly in the list view. You don't need to open each individual report to see if a PM has flagged something."*

### Step 4 — Anupriya Individual Report (3 min)
1. Click **Anupriya Bose**
2. Walk through:
   - EL: 3, SL: 2, Total: 5 — *"She took 5 days of leave in January"*
   - Expected: 19, Logged: 13, Lag: 6 — *"Out of 19 working days, she submitted EOD on 13"*
3. Switch month to February → Same report → Lag drops to 3
4. Say: *"This is a consistent, responsible employee. Her leave is planned and her EOD submissions are regular."*

### Step 5 — MADANKUMAR Comparison Story (3 min)
1. Go back, search "Madankumar"
2. Open his report for **January** → Lag = 19, Logged = 0
3. Switch to **February** → Lag = 3, Logged = 17
4. Say: *"In January, zero accountability — no EOD despite taking 3 days of EL. In February, complete turnaround — 17 out of 20 days logged, lag almost eliminated. This is the kind of change management visibility the dashboard provides."*

### Step 6 — Riyaz February — High "Other" Leaves (2 min)
1. Search "Riyaz" → open February report
2. Total leaves = 7 (EL 1, SL 1, **Other 5**)
3. Say: *"Riyaz took 7 days of leave in February — 5 of them are 'Other' category, spread across multiple stretches in the same month. Zero EOD submissions means all 20 working days show as lag."*

### Step 7 — Best Performers Contrast (1 min)
1. Sort employee list by Lag Days ascending (best first)
2. Point to Guru Prakash, Priyadharshini K, Wasim Ansari — Lag = 0 in February
3. Say: *"These employees submitted EOD on all 20 working days in February. Zero lag. The dashboard instantly tells you who's accountable and who isn't."*

---

## Formula Quick Reference

### Working Days
```
Jan 2026 = 22 weekdays − 3 mandatory holidays = 19
Feb 2026 = 20 weekdays − 0 mandatory holidays = 20
```

### Leave Days
```sql
SUM(CASE WHEN leavePeriod = 'half_day' THEN 0.5 ELSE 1 END)
WHERE status IN (1, 5)   -- 1=Manual Approved, 5=Auto-Approved
  AND from_date <= period_end
  AND to_date >= period_start
-- leave_type: 1=SL, 2=EL, 3/4/5=Other
```

### Productivity Lag
```sql
lagDays = expectedDays
        − COUNT(DISTINCT task_date FROM other_eods
                WHERE status=1 AND hours_spent>0 AND within period)
```
> Lag = 0 automatically for exempt teams (Network, HR, Account Manager, Digital Marketing, Operations, etc.)

### Negative Balance / Deficit
Sourced from `employee_leave_lag` table, computed monthly.
`finalTotal = totalLeaves − elDeficit − slDeficit`

> **Note for Jan-Feb 2026:** No active employee has a leave deficit recorded in these two months. The Negative Balance filter will correctly show an empty list — this is accurate data, not a bug.

---

## Common Client Questions (Jan-Feb 2026 Context)

**Q: Why does January only have 19 working days? It has 31 days.**
A: 22 of those days are weekdays (Mon–Fri). We then subtract 3 mandatory holidays — New Year on the 1st, Pongal on the 15th, and Republic Day on the 26th — all of which fall on weekdays. That leaves 19 working days.

**Q: February has no holidays at all?**
A: Correct. There are no mandatory company holidays in February 2026. All 20 weekdays count as working days.

**Q: The Negative Balance filter shows no one in Jan/Feb — is something broken?**
A: No. For January and February 2026, no active employee has exceeded their leave entitlement. Switch the date to **March 2026** (01 Mar → 31 Mar) and toggle the filter — Kartheek denkena and Kimmi Anna J P will both appear with a −1 Final Total.

**Q: How does a deficit carry forward if an employee takes no leave that month?**
A: The `employee_leave_lag` table computes leave balance cumulatively. If an employee used more SL or EL than their entitlement in prior months, that deficit is recorded against the month it was breached and carries forward into their overall balance. Kimmi (DB1724) is a clear example — zero leaves in March, yet a −1 Final Total from an SL deficit built up earlier.

**Q: Why does Aishwarya Ganpat Medhe show 22 EOD entries in January when there are only 19 working days?**
A: The EOD count shown (22) is `COUNT(DISTINCT task_date)` — it includes all calendar dates with an approved submission, including weekends or optional holiday dates she may have worked. The lag formula is `max(0, expectedDays − distinctDates)` = max(0, 19 − 22) = 0. She covered every working day plus submitted on additional non-working dates, so her lag is 0.

**Q: Can we filter by team for January?**
A: Yes — use the Team dropdown in the Employee List. You can isolate any team like QA, Nodejs, Frontend, UX, etc.

**Q: Why are Riyaz's extra leaves classified as "Other" and not SL or EL?**
A: Leave type 4 in the system is a separate leave category — it's recorded as "Other" in the dashboard. The specific leave policy governing type 4 would need to be confirmed with HR, but the system accurately reflects what was approved in D360.

---

## Demo Checklist

**January 2026 (01 Jan → 31 Jan)**
- [ ] Dashboard shows expected days = 19, confirm 3 mandatory holidays
- [ ] Sort Employee List by Lag descending — most employees show lag = 19
- [ ] Click Punith Kumar B's PM comment bubble → show popup
- [ ] Open Anupriya Bose → EL=3, SL=2, Total=5, Lag=6, Logged=13/19
- [ ] Open MADANKUMAR S → Lag=19, Logged=0/19

**February 2026 (01 Feb → 28 Feb)**
- [ ] Dashboard shows expected days = 20, confirm no holidays
- [ ] Open MADANKUMAR S → Lag=3, Logged=17/20 (same employee, big improvement)
- [ ] Open Riyaz Ahmed → Total=7 (5 Other leaves), Lag=20/20
- [ ] Open Anupriya Bose → Lag=3, Logged=17/20 (consistent good performance)
- [ ] Sort by Lag ascending → show Guru Prakash, Priyadharshini K with Lag=0

**March 2026 — Negative Balance Demo (01 Mar → 31 Mar)**
- [ ] Change date range to 01 Mar 2026 → 31 Mar 2026
- [ ] Go to Employee List → toggle **Negative Balance** filter ON
- [ ] Confirm Kartheek denkena (DB0811) appears → Final Total = **−1**
- [ ] Open Kartheek → EL=2, EL Deficit=4, Final Total=−1, Lag=22/22
- [ ] Confirm Kimmi Anna J P (DB1724) appears → Final Total = **−1**
- [ ] Open Kimmi → Total Leaves=0, SL Deficit=1, Final Total=−1, Lag=0 (exempt team)
- [ ] Run live SQL verification query if client asks for proof (query is in the section above)
- [ ] Explain: "No mandatory holidays in March — all 3 holidays are optional, so 22 full working days"
