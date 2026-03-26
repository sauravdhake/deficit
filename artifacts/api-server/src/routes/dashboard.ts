import { Router, type IRouter } from "express";
import { query360, query360Raw } from "../lib/db360";
import { extractDateRange, workingDaysSimple, workingDaysWithHolidays, getHolidaysInRange, calcWorkingDaysSync } from "../lib/dateUtils";
import { getProjectCategory, CATEGORY_ORDER, isLagExemptTeam } from "../lib/categoryUtils";

const router: IRouter = Router();

// CTE to get each active employee's primary project category from approved allocations
// Falls back to 'Other' if no allocation exists
const EMP_CATEGORY_CTE = `
WITH emp_category AS (
  SELECT
    arr.resourceId AS empId,
    CASE COALESCE(p.project_type, 'other')
      WHEN 'retainer' THEN 'Retainer'
      WHEN 'fixed_fee' THEN 'Fixed Fee'
      WHEN 'manage_service' THEN 'Managed Service'
      WHEN 'internal' THEN 'Internal'
      WHEN 'FF' THEN 'Fixed Fee'
      WHEN 'TM' THEN 'Managed Service'
      ELSE 'Other'
    END AS category,
    ROW_NUMBER() OVER (PARTITION BY arr.resourceId ORDER BY arr.toDate DESC) AS rn
  FROM approved_resource_requests arr
  JOIN projects p ON p.projectId = arr.projectId
  WHERE arr.approvalStatus = 2 AND p.status = 1
)`;

router.get("/dashboard/summary", async (req, res) => {
  const { fromDate } = extractDateRange(req.query as Record<string, unknown>);
  try {
    const rows = await query360<{
      totalEmployees: number;
      fullTimeCount: number;
      dtnCount: number;
    }>(
      `SELECT
        COUNT(*) AS totalEmployees,
        SUM(CASE WHEN isDtn = 0 OR isDtn IS NULL THEN 1 ELSE 0 END) AS fullTimeCount,
        SUM(CASE WHEN isDtn = 1 THEN 1 ELSE 0 END) AS dtnCount
      FROM employees
      WHERE status = 1 AND (deleted_at IS NULL OR deleted_at >= ?)`,
      [fromDate]
    );
    const row = rows[0] ?? { totalEmployees: 0, fullTimeCount: 0, dtnCount: 0 };
    res.json({
      totalEmployees: Number(row.totalEmployees),
      fullTimeCount: Number(row.fullTimeCount),
      dtnCount: Number(row.dtnCount),
    });
  } catch (err) {
    console.error("dashboard/summary error:", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.get("/dashboard/resource-counts", async (req, res) => {
  const { fromDate } = extractDateRange(req.query as Record<string, unknown>);
  try {
    const rows = await query360Raw<{
      category: string;
      ftCount: number;
      dtnCount: number;
      total: number;
    }>(
      `${EMP_CATEGORY_CTE}
      SELECT
        COALESCE(ec.category, 'Other') AS category,
        SUM(CASE WHEN e.isDtn = 0 OR e.isDtn IS NULL THEN 1 ELSE 0 END) AS ftCount,
        SUM(CASE WHEN e.isDtn = 1 THEN 1 ELSE 0 END) AS dtnCount,
        COUNT(DISTINCT e.empId) AS total
      FROM employees e
      LEFT JOIN emp_category ec ON ec.empId = e.empId AND ec.rn = 1
      WHERE e.status = 1 AND (e.deleted_at IS NULL OR e.deleted_at >= ?)
      GROUP BY COALESCE(ec.category, 'Other')
      ORDER BY total DESC`,
      [fromDate]
    );

    const rowMap: Record<string, { category: string; ftCount: number; dtnCount: number; total: number }> = {};
    for (const r of rows) {
      rowMap[r.category] = {
        category: r.category,
        ftCount: Number(r.ftCount),
        dtnCount: Number(r.dtnCount),
        total: Number(r.total),
      };
    }

    const ordered = CATEGORY_ORDER
      .filter((c) => rowMap[c])
      .map((c) => rowMap[c]!);

    // include any categories not in the standard order
    for (const r of rows) {
      if (!CATEGORY_ORDER.includes(r.category)) {
        ordered.push(rowMap[r.category]!);
      }
    }

    res.json({ rows: ordered });
  } catch (err) {
    console.error("dashboard/resource-counts error:", err);
    res.status(500).json({ error: "Failed to fetch resource counts" });
  }
});

router.get("/dashboard/leave-analytics", async (req, res) => {
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  try {
    const rawLeaves = await query360Raw<{
      category: string;
      isDtn: number;
      from_date: Date | string;
      to_date: Date | string;
      leavePeriod: string;
    }>(
      `${EMP_CATEGORY_CTE}
      SELECT
        COALESCE(ec.category, 'Other') AS category,
        e.isDtn,
        l.from_date,
        l.to_date,
        l.leavePeriod
      FROM \`leave\` l
      INNER JOIN employees e ON e.empId = l.empId
      LEFT JOIN emp_category ec ON ec.empId = l.empId AND ec.rn = 1
      WHERE l.status IN (1, 5)
        AND l.from_date <= ?
        AND l.to_date >= ?
        AND l.leave_type IN (1, 2, 3, 4, 5)`,
      [toDate, fromDate]
    );

    const holidays = await getHolidaysInRange(fromDate, toDate);
    const filterFromTime = new Date(fromDate).getTime();
    const filterToTime = new Date(toDate).getTime();

    const rowMap: Record<string, { category: string; ftLeaves: number; dtnLeaves: number; totalLeaves: number }> = {};
    for (const r of rawLeaves) {
      const actFromStr = r.from_date instanceof Date ? r.from_date.toISOString() : new Date(r.from_date).toISOString();
      const actToStr = r.to_date instanceof Date ? r.to_date.toISOString() : new Date(r.to_date).toISOString();
      
      const clampedFromStr = new Date(Math.max(new Date(actFromStr.split('T')[0]).getTime(), filterFromTime)).toISOString().split('T')[0];
      const clampedToStr = new Date(Math.min(new Date(actToStr.split('T')[0]).getTime(), filterToTime)).toISOString().split('T')[0];

      const wDays = calcWorkingDaysSync(clampedFromStr, clampedToStr, holidays);
      if (wDays > 0) {
        const finalDays = wDays * (r.leavePeriod === 'half_day' ? 0.5 : 1);
        const cat = r.category || 'Other';
        if (!rowMap[cat]) {
          rowMap[cat] = { category: cat, ftLeaves: 0, dtnLeaves: 0, totalLeaves: 0 };
        }
        
        if (r.isDtn === 1) {
          rowMap[cat].dtnLeaves += finalDays;
        } else {
          rowMap[cat].ftLeaves += finalDays;
        }
        rowMap[cat].totalLeaves += finalDays;
      }
    }

    const ordered = CATEGORY_ORDER.filter((c) => rowMap[c]).map((c) => rowMap[c]!);
    for (const r of Object.values(rowMap)) {
      if (!CATEGORY_ORDER.includes(r.category)) ordered.push(r);
    }

    res.json({ rows: ordered });
  } catch (err) {
    console.error("dashboard/leave-analytics error:", err);
    res.status(500).json({ error: "Failed to fetch leave analytics" });
  }
});

router.get("/dashboard/productivity", async (req, res) => {
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  const days = workingDaysSimple(fromDate, toDate);

  try {
    const [eodRows, arrRows] = await Promise.all([
      query360<{ totalHours: number; empCount: number }>(
        `SELECT
          COALESCE(SUM(oe.hours_spent), 0) AS totalHours,
          COUNT(DISTINCT oe.emp_id) AS empCount
        FROM other_eods oe
        INNER JOIN employees e ON e.empId = oe.emp_id
        WHERE oe.task_date BETWEEN ? AND ?
          AND oe.status = 1
          AND e.status = 1`,
        [fromDate, toDate]
      ),
      query360<{ totalApprovedHours: number }>(
        `SELECT COALESCE(SUM(arr.approvedHours), 0) AS totalApprovedHours
        FROM approved_resource_requests arr
        WHERE arr.approvalStatus = 2
          AND arr.fromDate <= ?
          AND arr.toDate >= ?`,
        [toDate, fromDate]
      ),
    ]);

    const totalHours = Number(eodRows[0]?.totalHours) || 0;
    const empCount = Number(eodRows[0]?.empCount) || 0;
    const totalApprovedHours = Number(arrRows[0]?.totalApprovedHours) || 0;

    let productivityPercent = 0;
    if (totalApprovedHours > 0) {
      productivityPercent = Math.min(100, Math.round((totalHours / totalApprovedHours) * 100));
    } else if (empCount > 0) {
      const expectedHoursTotal = empCount * days * 8;
      productivityPercent = Math.min(100, Math.round((totalHours / expectedHoursTotal) * 100));
    }

    res.json({ productivityPercent });
  } catch (err) {
    console.error("dashboard/productivity error:", err);
    res.status(500).json({ error: "Failed to fetch productivity" });
  }
});

router.get("/dashboard/productivity-trend", async (req, res) => {
  const periodRaw = req.query["period"];
  const period = periodRaw === "month" ? "month" : "week";
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);

  try {
    if (period === "month") {
      // Aggregate by ISO week so monthly view shows ~4-5 weekly data points
      const rows = await query360Raw<{
        weekKey: number;
        weekStart: string;
        weekEnd: string;
        hoursSubmitted: number;
        empCount: number;
      }>(
        `SELECT
          YEARWEEK(oe.task_date, 1) AS weekKey,
          DATE_FORMAT(MIN(oe.task_date), '%d %b') AS weekStart,
          DATE_FORMAT(MAX(oe.task_date), '%d %b') AS weekEnd,
          COALESCE(SUM(oe.hours_spent), 0) AS hoursSubmitted,
          COUNT(DISTINCT oe.emp_id) AS empCount
        FROM other_eods oe
        INNER JOIN employees e ON e.empId = oe.emp_id
        WHERE oe.task_date BETWEEN ? AND ?
          AND oe.status = 1
          AND e.status = 1
        GROUP BY YEARWEEK(oe.task_date, 1)
        ORDER BY weekKey ASC`,
        [fromDate, toDate]
      );

      const dataPoints = rows.map((r) => ({
        label: `${r.weekStart} – ${r.weekEnd}`,
        productivityPercent: Math.min(
          100,
          Math.round(Number(r.empCount) > 0
            ? (Number(r.hoursSubmitted) / (Number(r.empCount) * 8)) * 100
            : 0
          )
        ),
      }));

      return res.json({ dataPoints });
    }

    // Week view — show daily points
    const rows = await query360Raw<{
      dayLabel: string;
      dateStr: string;
      hoursSubmitted: number;
      empCount: number;
    }>(
      `SELECT
        DATE_FORMAT(oe.task_date, '%a %d %b') AS dayLabel,
        DATE_FORMAT(oe.task_date, '%Y-%m-%d') AS dateStr,
        COALESCE(SUM(oe.hours_spent), 0) AS hoursSubmitted,
        COUNT(DISTINCT oe.emp_id) AS empCount
      FROM other_eods oe
      INNER JOIN employees e ON e.empId = oe.emp_id
      WHERE oe.task_date BETWEEN ? AND ?
        AND oe.status = 1
        AND e.status = 1
      GROUP BY oe.task_date
      ORDER BY oe.task_date ASC
      LIMIT 14`,
      [fromDate, toDate]
    );

    const dataPoints = rows.map((r) => ({
      label: r.dayLabel,
      productivityPercent: Math.min(
        100,
        Math.round(Number(r.empCount) > 0
          ? (Number(r.hoursSubmitted) / (Number(r.empCount) * 8)) * 100
          : 0
        )
      ),
    }));

    res.json({ dataPoints });
  } catch (err) {
    console.error("dashboard/productivity-trend error:", err);
    res.status(500).json({ error: "Failed to fetch productivity trend" });
  }
});

router.get("/dashboard/lagging-resources", async (req, res) => {
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  const days = await workingDaysWithHolidays(fromDate, toDate);

  try {
    const rows = await query360Raw<{
      empId: number;
      firstName: string;
      lastName: string;
      doodleId: string;
      teamId: number;
      teamName: string;
      projectType: string | null;
      totalHours: number;
      daysLogged: number;
      isDtn: number;
    }>(
      `SELECT
        e.empId,
        e.firstName,
        e.lastName,
        e.doodle_id AS doodleId,
        e.team AS teamId,
        COALESCE(t.name, CAST(e.team AS CHAR)) AS teamName,
        latest_proj.project_type AS projectType,
        COALESCE(SUM(oe.hours_spent), 0) AS totalHours,
        COUNT(DISTINCT oe.task_date) AS daysLogged,
        COALESCE(e.isDtn, 0) AS isDtn
      FROM employees e
      LEFT JOIN teams t ON t.teamId = e.team AND t.status = 1
      LEFT JOIN (
        SELECT arr.resourceId, ANY_VALUE(p.project_type) AS project_type
        FROM approved_resource_requests arr
        INNER JOIN projects p ON p.projectId = arr.projectId AND p.status = 1
        INNER JOIN (
          SELECT resourceId, MAX(toDate) AS maxDate
          FROM approved_resource_requests
          WHERE approvalStatus = 2
          GROUP BY resourceId
        ) lp ON lp.resourceId = arr.resourceId AND lp.maxDate = arr.toDate
        WHERE arr.approvalStatus = 2
        GROUP BY arr.resourceId
      ) latest_proj ON latest_proj.resourceId = e.empId
      LEFT JOIN other_eods oe ON oe.emp_id = e.empId
        AND oe.task_date BETWEEN ? AND ?
        AND oe.status = 1
      WHERE e.status = 1 AND (e.deleted_at IS NULL OR e.deleted_at >= ?)
      GROUP BY e.empId, e.firstName, e.lastName, e.doodle_id, e.team, t.name, latest_proj.project_type
      HAVING COUNT(DISTINCT oe.task_date) < ? * 0.8
      ORDER BY COUNT(DISTINCT oe.task_date) ASC
      LIMIT 300`,
      [fromDate, toDate, fromDate, days]
    );

    const categoryMap: Record<string, { category: string; count: number; employees: unknown[] }> = {};

    for (const r of rows) {
      // Skip DTN employees and team-exempt employees from lag tracking
      if (r.isDtn === 1 || isLagExemptTeam(r.teamName)) continue;

      const cat = getProjectCategory(r.projectType);
      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, count: 0, employees: [] };
      categoryMap[cat].count++;

      const daysLogged = Number(r.daysLogged) || 0;
      const lagDays = Math.max(0, days - daysLogged);

      categoryMap[cat].employees.push({
        empId: r.empId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        doodleId: r.doodleId || `EMP${r.empId}`,
        team: r.teamName || String(r.teamId || ""),
        lagDays,
        daysLogged,
        expectedDays: days,
      });
    }

    const categories = CATEGORY_ORDER
      .filter((c) => categoryMap[c])
      .map((c) => ({
        ...categoryMap[c],
        employees: (categoryMap[c].employees as Array<{ lagDays: number }>).sort(
          (a, b) => b.lagDays - a.lagDays
        ),
      }));

    res.json({ categories });
  } catch (err) {
    console.error("dashboard/lagging-resources error:", err);
    res.status(500).json({ error: "Failed to fetch lagging resources" });
  }
});

export default router;
