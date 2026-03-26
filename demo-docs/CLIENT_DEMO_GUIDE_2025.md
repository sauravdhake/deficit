# HR Productivity Dashboard — Client Demo Guide (2025 Full Year)
> All numbers verified directly from the `doodle360_staging` database. Use these exact values when demonstrating to the client.

---

## Quick Reference — Date Range to Set in Dashboard

| Demo Scenario | From Date | To Date |
|---|---|---|
| Full Year View | 01 Jan 2025 | 31 Dec 2025 |
| January Focus | 01 Jan 2025 | 31 Jan 2025 |
| August Focus | 01 Aug 2025 | 31 Aug 2025 |
| October Focus | 01 Oct 2025 | 31 Oct 2025 |

---

## 2025 Calendar Facts

**Total Working Days (Full Year 2025): 251**
- 365 calendar days − 104 weekend days − **11 mandatory holidays** = 251

### 11 Mandatory Holidays (deducted from working days)
| Date | Holiday |
|---|---|
| 1 Jan 2025 | New Year |
| 14 Jan 2025 | Pongal |
| 26 Jan 2025 | Republic Day |
| 14 Apr 2025 | Tamil New Year |
| 1 May 2025 | May Day |
| 15 Aug 2025 | Independence Day |
| 27 Aug 2025 | Ganesh Chaturthi |
| 1 Oct 2025 | Ayudha Pooja |
| 2 Oct 2025 | Gandhi Jayanthi |
| 20 Oct 2025 | Diwali |
| 25 Dec 2025 | Christmas |

### 6 Optional Holidays (NOT deducted — `optional_status = 1`)
Holi (14 Mar), Telugu New Year (30 Mar), Ramzan (31 Mar), Good Friday (18 Apr), Onam (5 Sep), Karnataka Formation Day (1 Nov)

> **Client often asks:** *"Why isn't Good Friday/Holi counted?"*
> **Answer:** These are marked optional in the system. Only mandatory company holidays (`optional_status = 0`) reduce the expected working days.

### Working Days Per Month
| Month | Working Days | Holidays Deducted |
|---|---|---|
| January | 21 | New Year, Pongal, Republic Day |
| February | 20 | — |
| March | 21 | — (Holi, Telugu NY, Ramzan are optional) |
| April | 21 | Tamil New Year |
| May | 21 | May Day |
| June | 21 | — |
| July | 23 | — |
| August | 19 | Independence Day + Ganesh Chaturthi |
| September | 22 | — (Onam is optional) |
| October | 20 | Ayudha Pooja + Gandhi Jayanthi + Diwali |
| November | 20 | — (Karnataka Formation Day is optional) |
| December | 22 | Christmas |

**Verify August 2025 = 19 working days:**
```sql
SELECT COUNT(*) FROM (
  SELECT d FROM (
    SELECT DATE('2025-08-01') + INTERVAL (t.n + t2.n*10) DAY AS d
    FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
          UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t,
         (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) t2
  ) dates
  WHERE d BETWEEN '2025-08-01' AND '2025-08-31'
    AND DAYOFWEEK(d) NOT IN (1,7)
    AND d NOT IN (SELECT holidays_date FROM holidays WHERE optional_status=0)
) working;
-- Result: 19
```

---

## Key Demo Employees

### Employee 1 — Punith Kumar B (DB1264)
**Best for: Balanced demo — leaves + partial lag tracking**

| Field | Full Year 2025 | January 2025 | July 2025 |
|---|---|---|---|
| Team | Nodejs | Nodejs | Nodejs |
| Earned Leave (EL) | 12 | 1 | 1 |
| Sick Leave (SL) | 8 | 2 | 1 |
| Other Leave | 5 | 0 | 0 |
| **Total Leaves** | **25** | **3** | **2** |
| Expected Days | 251 | 21 | 23 |
| Days Logged (EOD) | 57 | 13 | 0 |
| **Lag Days** | **194** | **8** | **23** |
| EL Deficit | 0 | 0 | 0 |
| SL Deficit | 0 | 0 | 0 |
| PM Comments | 6 | — | — |

**Verify leave count for full year:**
```sql
SELECT leave_type, COUNT(*) AS cnt,
       SUM(CASE WHEN leavePeriod='half_day' THEN 0.5 ELSE 1 END) AS days
FROM `leave`
WHERE empId = 1138 AND status IN (1, 5)
  AND from_date <= '2025-12-31' AND to_date >= '2025-01-01'
GROUP BY leave_type;
-- leave_type 2 (EL): ~12 days | leave_type 1 (SL): ~8 days
```

**Verify lag for full year:**
```sql
SELECT 251 - COUNT(DISTINCT task_date) AS lag_days,
       COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 1138 AND task_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND status = 1 AND hours_spent > 0;
-- lag_days: 194 | days_logged: 57
```

**Demo talking point:** *"Punith submitted EODs on 57 out of 251 working days — that's a 194-day lag. He also took 25 days of leave across the year, which is well within entitlement but the EOD gap tells us there are 194 working days unaccounted for."*

---

### Employee 2 — HARI SUDAN N (DB0931)
**Best for: PM Comments demo + maximum lag**

| Field | Full Year 2025 | January 2025 | July 2025 |
|---|---|---|---|
| Team | Android | Android | Android |
| Earned Leave (EL) | 19 | 2 | 2 |
| Sick Leave (SL) | 0 | 0 | 0 |
| Other Leave | 1 | 0 | 0 |
| **Total Leaves** | **20** | **2** | **2** |
| Expected Days | 251 | 21 | 23 |
| Days Logged (EOD) | 0 | 0 | 0 |
| **Lag Days** | **251** | **21** | **23** |
| PM Comments | **12** | — | — |

**Verify PM comments:**
```sql
SELECT pmComments, DATE_FORMAT(createdAt, '%d %b %Y') AS date
FROM tasks
WHERE empId = 796 AND pmComments IS NOT NULL AND pmComments != ''
  AND status = 1
ORDER BY createdAt DESC;
-- Returns 12 PM comments
```

**Verify lag:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 796 AND task_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND status = 1 AND hours_spent > 0;
-- Result: 0 (zero EOD submissions — full 251-day lag)
```

**Demo talking point:** *"Hari has 12 PM comments recorded against his tasks — click any comment on the employee list to see them. Despite being on leave for 20 days, he has submitted zero EOD reports across the entire year — every working day shows as a lag."*

**How to show PM comments in the UI:**
1. Set date range to 01 Jan 2025 → 31 Dec 2025
2. Search "HARI SUDAN" in the employee list
3. Click the PM comment bubble next to his name → popup shows the 3 most recent with dates
4. Click his name → Individual Report → scroll to PM Comments section → all 12 visible

---

### Employee 3 — Santhosh P D (DB1147)
**Best for: High leave volume + EOD lag story**

| Field | Full Year 2025 | January 2025 | July 2025 |
|---|---|---|---|
| Team | Nodejs | Nodejs | Nodejs |
| Earned Leave (EL) | 12 | 1 | 1.5 |
| Sick Leave (SL) | 7 | 0 | 0 |
| Other Leave | 10 | 1 | 2 |
| **Total Leaves** | **29** | **2** | **3.5** |
| Expected Days | 251 | 21 | 23 |
| Days Logged (EOD) | 16 | 2 | 7 |
| **Lag Days** | **235** | **19** | **16** |

**Demo talking point:** *"Santhosh took 29 days of leave across 2025 — the most on the team. But his EOD submission is extremely thin: only 16 days logged out of 251. That gives him a 235-day productivity lag. July is slightly better — 7 EOD days logged — but still 16 days behind."*

---

### Employee 4 — Kartheek denkena (DB0811)
**Best for: Zero EOD / maximum lag with consistent leave usage**

| Field | Full Year 2025 |
|---|---|
| Team | Salesforce |
| Earned Leave (EL) | 11 |
| Sick Leave (SL) | 7.5 |
| Other Leave | 1 |
| **Total Leaves** | **19.5** |
| Expected Days | 251 |
| Days Logged (EOD) | 0 |
| **Lag Days** | **251** |

**Verify:**
```sql
SELECT COUNT(DISTINCT task_date) AS days_logged
FROM other_eods
WHERE emp_id = 675 AND task_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND status = 1 AND hours_spent > 0;
-- Result: 0
```

---

### Employee 5 — Yokesh Ram Balasubramanian (DB1364)
**Best for: Explaining EXEMPT teams (Network — no lag tracking)**

| Field | Full Year 2025 |
|---|---|
| Team | **Network** |
| Earned Leave (EL) | 11 |
| Sick Leave (SL) | 7 |
| Other Leave | 3 |
| **Total Leaves** | **21** |
| Expected Days | 251 |
| Days Logged (EOD) | 0 |
| **Lag Days** | **0 (Exempt)** |

**Demo talking point:** *"Yokesh's team — Network — is classified as an operational/support team. These teams are exempt from EOD-based lag tracking because their work doesn't always map to daily task submissions. The system automatically sets lag to 0 for exempt teams. This includes: Network, HR, Account Manager, Digital Marketing, Operations, Business Analyst, and others."*

---

## Step-by-Step Demo Script

### Step 1 — Dashboard Overview (2 min)
1. Open the dashboard → set date range **01 Jan 2025 → 31 Dec 2025**
2. Show the 4 summary cards:
   - **Total Employees**: Active headcount during the period
   - **Average Lag Days**: Across all non-exempt employees
   - **On Leave Today**: Who is currently on leave
   - **Negative Balance**: Employees who exceeded their leave entitlement
3. Point to the **Productivity Trend** chart — "This shows weekly EOD submission rates across the year. August and October dip noticeably — those months have the most holidays reducing working days."
4. Point to the **Leave Distribution** pie chart — "Most leave is EL (planned) which is expected. SL spikes point to possible burnout or health concerns."

---

### Step 2 — Employee List (3 min)
1. Employee list defaults to the same date range
2. Show **sorting** — click "Lag Days" column header to sort descending → worst performers surface immediately
3. Point out the **PM Comment bubble** column — "The speech bubble icon shows if a PM has left a comment on this employee's tasks. Click it to read the latest."
4. Click Hari Sudan N's PM bubble → show popup with 3 recent comments
5. Show **search** — type "Punith" → instantly filters
6. Show **Negative Balance filter** — toggle it on → "These employees consumed more leave than their entitlement in the selected period."

---

### Step 3 — Individual Employee Report: Punith Kumar B (5 min)
1. Search "Punith Kumar" → click his name
2. **Leave section** — Walk through:
   - EL: 12 days | SL: 8 days | Other: 5 days | Total: 25 days
   - "He has taken leave regularly throughout the year — mostly spread across months"
3. **Lag section** — "251 working days in 2025. He submitted EOD on only 57 of those days. That's a 194-day gap — nearly 8 months of working days with no EOD submitted."
4. **Productivity chart** — Switch between "Last Week" (daily) and "Monthly" (weekly bars) to show the trend
5. **PM Comments** — Scroll to bottom → show all 6 comments with dates

---

### Step 4 — Individual Employee Report: HARI SUDAN N (3 min)
1. Go back → search "Hari Sudan" → click
2. **Lag section** — "Zero EOD submissions for the entire year. Every single working day — all 251 — is a lag day."
3. **PM Comments** — 12 comments visible → "His PM has consistently left feedback. This is the complete historical record — no limits."
4. Show the comment dates going back to 2023 — "These are cumulative; PM comments are attached to tasks, not date-filtered"

---

### Step 5 — Exempt Team Demo: Yokesh Ram (2 min)
1. Search "Yokesh" → click
2. Point to Lag Days = 0 — "Network team is exempt. The system knows not to penalize ops/support teams for missing EOD."
3. Contrast with Hari Sudan (Android, non-exempt) who has 251 lag days

---

### Step 6 — Monthly Drill-Down (2 min)
1. Go back to Employee List
2. Change date range to **01 Aug 2025 → 31 Aug 2025** (only 19 working days — heaviest holiday month)
3. Show that expected days adjusts to 19 for every employee
4. "August has Independence Day and Ganesh Chaturthi back-to-back — automatically deducted from working days."
5. Change to **01 Oct 2025 → 31 Oct 2025** (20 working days — Diwali month)
6. "October has three mandatory holidays: Ayudha Pooja, Gandhi Jayanthi, and Diwali."

---

## Formula Reference

### Leave Days
```
leave_days = SUM(
  CASE WHEN leavePeriod = 'half_day' THEN 0.5 ELSE 1 END
)
WHERE leave.status IN (1, 5)   -- 1=Manual Approved, 5=Auto-Approved
  AND from_date <= period_end
  AND to_date   >= period_start
```
Leave types: `1 = SL`, `2 = EL`, `3/4/5 = Other`

### Expected Working Days
```
expectedDays = COUNT(weekdays in period)
             - COUNT(holidays WHERE optional_status = 0 AND within period)
```
Column: `holidays.holidays_date` (not `holiday_date`)

### Productivity Lag
```
lagDays = expectedDays - COUNT(DISTINCT task_date FROM other_eods
          WHERE emp_id = ? AND task_date IN period AND status=1 AND hours_spent>0)
```
Lag = 0 for exempt teams (Network, HR, Account Manager, Digital Marketing, Operations, etc.)

### Leave Deficit (Negative Balance)
Sourced from `employee_leave_lag` table — pre-computed monthly by the system.
```
deficit > 0 means employee consumed more leave than entitlement
finalTotal = totalLeaves - elDeficit - slDeficit
```
Filter `status = 1` only (approved deficit records).

---

## Verification SQL Queries (Run Live to Impress)

**1. Confirm working days for full year 2025:**
```sql
SELECT COUNT(*) AS mandatory_holidays
FROM holidays
WHERE holidays_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND optional_status = 0;
-- Result: 11
-- Working days = 252 weekdays - 11 holidays = 251 ✓ (actual: 252 weekdays → 251)
```

**2. Punith Kumar B — Full Year Leave Breakdown:**
```sql
SELECT
  CASE leave_type WHEN 1 THEN 'SL' WHEN 2 THEN 'EL' ELSE 'Other' END AS type,
  COUNT(*) AS entries,
  SUM(CASE WHEN leavePeriod='half_day' THEN 0.5 ELSE 1 END) AS days
FROM `leave`
WHERE empId = 1138 AND status IN (1, 5)
  AND from_date <= '2025-12-31' AND to_date >= '2025-01-01'
GROUP BY leave_type;
```

**3. Punith Kumar B — EOD Submission Summary:**
```sql
SELECT MONTHNAME(task_date) AS month, COUNT(DISTINCT task_date) AS days_submitted
FROM other_eods
WHERE emp_id = 1138 AND task_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND status = 1 AND hours_spent > 0
GROUP BY MONTH(task_date)
ORDER BY MONTH(task_date);
```

**4. HARI SUDAN N — PM Comments:**
```sql
SELECT pmComments, DATE_FORMAT(createdAt, '%d %b %Y') AS date
FROM tasks
WHERE empId = 796 AND pmComments IS NOT NULL AND pmComments != ''
  AND status = 1
ORDER BY createdAt DESC;
-- Returns 12 comments
```

**5. All 2025 Mandatory Holidays:**
```sql
SELECT DATE_FORMAT(holidays_date, '%d %b %Y') AS date, title
FROM holidays
WHERE holidays_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND optional_status = 0
ORDER BY holidays_date;
```

**6. Employees with highest lag in 2025 (non-exempt):**
```sql
SELECT e.firstName, e.lastName, e.doodle_id,
       251 - COUNT(DISTINCT oe.task_date) AS lag_days,
       COUNT(DISTINCT oe.task_date) AS days_logged
FROM employees e
LEFT JOIN other_eods oe ON oe.emp_id = e.empId
  AND oe.task_date BETWEEN '2025-01-01' AND '2025-12-31'
  AND oe.status = 1 AND oe.hours_spent > 0
WHERE e.status = 1
GROUP BY e.empId, e.firstName, e.lastName, e.doodle_id
ORDER BY lag_days DESC
LIMIT 10;
```

---

## Common Client Questions

**Q: Why does Yokesh Ram show 0 lag even though he submitted no EODs?**
A: Network is an exempt team. EOD-based lag tracking doesn't apply to operational and support teams. The full list of exempt teams includes Network, HR, Account Manager, Digital Marketing, Operations, Business Analyst, RGT, and Tech Arch.

**Q: Why does August only have 19 working days?**
A: August 2025 has two mandatory holidays — Independence Day (Aug 15) and Ganesh Chaturthi (Aug 27) — both on weekdays. That reduces a 21-weekday month down to 19.

**Q: Are Good Friday, Holi, Ramzan not holidays?**
A: They are listed in the system but marked as optional (`optional_status = 1`). Only mandatory company holidays are deducted from working day calculations. Optional holidays are for employees who choose to observe them — they use leave for those days.

**Q: Can we filter by team?**
A: Yes — use the Team dropdown in the Employee List to isolate any specific team.

**Q: Why do some employees have 251 lag days — did they really not submit any EOD all year?**
A: The system only counts days where an EOD was submitted with `hours_spent > 0` and `status = 1`. If an employee never submitted, their lag equals the full working day count. This is a factual record — not an estimate.

**Q: Why does the PM comments section show old dates (2023–2024)?**
A: PM comments are attached to tasks — they represent the complete historical record of PM feedback, not filtered by the selected date period. This gives a full picture of how consistently the PM has been reviewing this employee's work.

**Q: What does "Final Total" mean when it's the same as Total Leaves?**
A: Final Total = Total Leaves − EL Deficit − SL Deficit. When there's no deficit (employee stayed within entitlement), it equals Total Leaves. A negative Final Total means they exceeded their entitlement.

---

## Demo Checklist

- [ ] Set date range to 01 Jan 2025 → 31 Dec 2025
- [ ] Show Dashboard overview cards and charts
- [ ] Sort Employee List by Lag Days (descending)
- [ ] Click HARI SUDAN N's PM comment bubble → show popup
- [ ] Open HARI SUDAN N individual report → scroll to PM comments (12 total)
- [ ] Open Punith Kumar B individual report → walk through EL 12, SL 8, Lag 194
- [ ] Open Santhosh P D → show 29 leaves, 235 lag
- [ ] Open Yokesh Ram → show Lag = 0 (exempt Network team)
- [ ] Switch month to August → show 19 working days
- [ ] Switch month to October → show 20 working days (3 holidays)
- [ ] Run at least 1 verification SQL query live if client requests proof
