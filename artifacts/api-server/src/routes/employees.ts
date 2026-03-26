import { Router, type IRouter } from "express";
import { query360Raw } from "../lib/db360";
import { extractDateRange, workingDaysSimple, workingDaysWithHolidays, getHolidaysInRange, calcWorkingDaysSync } from "../lib/dateUtils";
import { getProjectCategory, isLagExemptTeam } from "../lib/categoryUtils";
import {
  GetEmployeeReportParams,
  SaveEmployeeCommentParams,
  SaveEmployeeCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const hrComments = new Map<number, { comment: string; updated_at: Date }>();

function getHrComment(empId: number): string | null {
  return hrComments.get(empId)?.comment ?? null;
}

function getHrCommentsBatch(empIds: number[]): Record<number, string | null> {
  const map: Record<number, string | null> = {};
  for (const empId of empIds) {
    const entry = hrComments.get(empId);
    if (entry) map[empId] = entry.comment;
  }
  return map;
}

async function getPmCommentsBatch(
  empIds: number[]
): Promise<Record<number, { latest: string | null; count: number; recent: Array<{ comment: string; date: string }> }>> {
  if (empIds.length === 0) return {};
  try {
    const rows = await query360Raw<{ empId: number; pmComments: string; createdAt: string }>(
      `SELECT t.empId, t.pmComments, DATE_FORMAT(t.createdAt, '%Y-%m-%d') AS createdAt
      FROM tasks t
      WHERE t.empId IN (${empIds.map(() => "?").join(",")})
        AND t.pmComments IS NOT NULL AND t.pmComments != ''
        AND t.status = 1
      ORDER BY t.createdAt DESC`,
      empIds
    );
    const map: Record<number, { latest: string | null; count: number; recent: Array<{ comment: string; date: string }> }> = {};
    for (const row of rows) {
      if (!map[row.empId]) {
        map[row.empId] = { latest: null, count: 0, recent: [] };
      }
      const entry = map[row.empId]!;
      const trimmed = row.pmComments?.trim() || null;
      if (!entry.latest) entry.latest = trimmed;
      entry.count += 1;
      if (entry.recent.length < 3) {
        entry.recent.push({ comment: trimmed ?? "", date: row.createdAt });
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function getEmpProjectCategory(empId: number): Promise<string> {
  try {
    const rows = await query360Raw<{ project_type: string }>(
      `SELECT p.project_type
      FROM approved_resource_requests arr
      JOIN projects p ON p.projectId = arr.projectId
      WHERE arr.resourceId = ? AND arr.approvalStatus = 2 AND p.status = 1
      ORDER BY arr.toDate DESC LIMIT 1`,
      [empId]
    );
    return getProjectCategory(rows[0]?.project_type ?? null);
  } catch {
    return "Other";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /employees
// ─────────────────────────────────────────────────────────────────────────────
router.get("/employees", async (req, res) => {
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  const rawSearch = req.query["search"];
  const search = typeof rawSearch === "string" && rawSearch.trim() ? rawSearch.trim() : undefined;
  const page = Math.max(1, Number(req.query["page"] ?? 1));
  const limit = Math.min(200, Math.max(1, Number(req.query["limit"] ?? 50)));
  const offset = (page - 1) * limit;
  const lagFilter = typeof req.query["lagFilter"] === "string" ? req.query["lagFilter"] : undefined;
  const leaveFilter = typeof req.query["leaveFilter"] === "string" ? req.query["leaveFilter"] : undefined;

  const days = await workingDaysWithHolidays(fromDate, toDate);

  const searchClause = search
    ? `AND (e.firstName LIKE ? OR e.lastName LIKE ? OR e.doodle_id LIKE ?)`
    : "";
  const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  // Leave filters: push all into SQL so count + pagination are correct
  let leaveFilterClause = "";
  let leaveFilterParams: unknown[] = [];

  if (leaveFilter === "negative_balance") {
    leaveFilterClause = `AND e.empId IN (
        SELECT DISTINCT empId FROM employee_leave_lag
        WHERE status = 1
          AND insufficientLeaves > 0
          AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')
      )`;
    leaveFilterParams = [fromDate, toDate];
  } else if (leaveFilter === "took_leave") {
    leaveFilterClause = `AND e.empId IN (
        SELECT DISTINCT empId FROM \`leave\`
        WHERE status IN (1, 5) AND from_date <= ? AND to_date >= ?
      )`;
    leaveFilterParams = [toDate, fromDate];
  } else if (leaveFilter === "took_earned") {
    leaveFilterClause = `AND e.empId IN (
        SELECT DISTINCT empId FROM \`leave\`
        WHERE status IN (1, 5) AND leave_type = 2 AND from_date <= ? AND to_date >= ?
      )`;
    leaveFilterParams = [toDate, fromDate];
  } else if (leaveFilter === "took_sick") {
    leaveFilterClause = `AND e.empId IN (
        SELECT DISTINCT empId FROM \`leave\`
        WHERE status IN (1, 5) AND leave_type = 1 AND from_date <= ? AND to_date >= ?
      )`;
    leaveFilterParams = [toDate, fromDate];
  }

  // For lag filter, compute the sub-range
  let lagFromDate = fromDate;
  let lagToDate = toDate;
  if (lagFilter === "last_week") {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    lagFromDate = weekAgo.toISOString().split("T")[0]!;
    lagToDate = today.toISOString().split("T")[0]!;
  } else if (lagFilter === "last_month") {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    lagFromDate = monthAgo.toISOString().split("T")[0]!;
    lagToDate = today.toISOString().split("T")[0]!;
  }

  const lagDays = await workingDaysWithHolidays(lagFromDate, lagToDate);

  try {
    const countRows = await query360Raw<{ total: number }>(
      `SELECT COUNT(DISTINCT e.empId) AS total
      FROM employees e
      WHERE e.status = 1 AND (e.deleted_at IS NULL OR e.deleted_at >= ?) AND (e.isDtn = 0 OR e.isDtn IS NULL)
      ${searchClause}
      ${leaveFilterClause}`,
      [fromDate, ...searchParams, ...leaveFilterParams]
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query360Raw<{
      empId: number;
      firstName: string;
      lastName: string;
      doodleId: string;
      teamId: number;
      teamName: string;
      grade: string;
      isDtn: number;
      deletedAt: string | null;
    }>(
      `SELECT
        e.empId,
        e.firstName,
        e.lastName,
        e.doodle_id AS doodleId,
        e.team AS teamId,
        COALESCE(t.name, CAST(e.team AS CHAR)) AS teamName,
        COALESCE(ep.grade, '') AS grade,
        COALESCE(e.isDtn, 0) AS isDtn,
        e.deleted_at AS deletedAt
      FROM employees e
      LEFT JOIN teams t ON t.teamId = e.team AND t.status = 1
      LEFT JOIN emp_profile ep ON ep.empId = e.empId
      WHERE e.status = 1 AND (e.deleted_at IS NULL OR e.deleted_at >= ?) AND (e.isDtn = 0 OR e.isDtn IS NULL)
      ${searchClause}
      ${leaveFilterClause}
      ORDER BY e.firstName ASC
      LIMIT ${limit} OFFSET ${offset}`,
      [fromDate, ...searchParams, ...leaveFilterParams]
    );

    const empIds = rows.map((r) => r.empId);

    // Batch: leave
    let leaveMap: Record<number, { earned: number; sick: number; other: number; total: number }> = {};
    if (empIds.length > 0) {
      try {
        const rawLeaves = await query360Raw<{
          empId: number;
          leave_type: number;
          from_date: Date | string;
          to_date: Date | string;
          leavePeriod: string;
        }>(
          `SELECT l.empId, l.leave_type, l.from_date, l.to_date, l.leavePeriod
           FROM \`leave\` l
           WHERE l.empId IN (${empIds.map(() => "?").join(",")})
             AND l.status IN (1, 5)
             AND l.from_date <= ?
             AND l.to_date >= ?`,
          [...empIds, toDate, fromDate]
        );

        const holidays = await getHolidaysInRange(fromDate, toDate);
        const filterFromTime = new Date(fromDate).getTime();
        const filterToTime = new Date(toDate).getTime();

        for (const r of rawLeaves) {
          const actFromStr = r.from_date instanceof Date ? r.from_date.toISOString() : new Date(r.from_date).toISOString();
          const actToStr = r.to_date instanceof Date ? r.to_date.toISOString() : new Date(r.to_date).toISOString();
          
          const actFromTime = new Date(actFromStr.split('T')[0]).getTime();
          const actToTime = new Date(actToStr.split('T')[0]).getTime();

          const clampedFromStr = new Date(Math.max(actFromTime, filterFromTime)).toISOString().split('T')[0];
          const clampedToStr = new Date(Math.min(actToTime, filterToTime)).toISOString().split('T')[0];

          // Make sure start is not accidentally after end if the leave spans outside entirely (handled safely by max/min but just in case)
          const wDays = calcWorkingDaysSync(clampedFromStr, clampedToStr, holidays);
          if (wDays > 0) {
            const finalDays = wDays * (r.leavePeriod === 'half_day' ? 0.5 : 1);
            if (!leaveMap[r.empId]) leaveMap[r.empId] = { earned: 0, sick: 0, other: 0, total: 0 };
            
            const lType = Number(r.leave_type);
            if (lType === 2) leaveMap[r.empId].earned += finalDays;
            else if (lType === 1) leaveMap[r.empId].sick += finalDays;
            else if ([3, 4, 5].includes(lType)) leaveMap[r.empId].other += finalDays;
            
            leaveMap[r.empId].total += finalDays;
          }
        }
      } catch (e) {
        console.error("Leave batch error:", e);
      }
    }

    // Batch: productivity lag in DAYS
    let lagDaysMap: Record<number, number> = {};
    if (empIds.length > 0) {
      try {
        const lagRows = await query360Raw<{ empId: number; daysLogged: number }>(
          `SELECT
            oe.emp_id AS empId,
            COUNT(DISTINCT oe.task_date) AS daysLogged
          FROM other_eods oe
          WHERE oe.emp_id IN (${empIds.map(() => "?").join(",")})
            AND oe.task_date BETWEEN ? AND ?
            AND oe.status = 1
            AND oe.hours_spent > 0
          GROUP BY oe.emp_id`,
          [...empIds, lagFromDate, lagToDate]
        );
        for (const r of lagRows) {
          const daysLogged = Number(r.daysLogged) || 0;
          lagDaysMap[r.empId] = Math.max(0, lagDays - daysLogged);
        }
        // employees with NO eod entries → full lag
        for (const empId of empIds) {
          if (lagDaysMap[empId] === undefined) lagDaysMap[empId] = lagDays;
        }
      } catch (e) {
        console.error("Lag days batch error:", e);
      }
    }

    // Apply lag filter
    let filteredRows = rows;
    if (lagFilter === "has_lag") {
      filteredRows = rows.filter((r) => {
        const lag = (lagDaysMap[r.empId] ?? 0);
        const isExempt = isLagExemptTeam(r.teamName);
        return !isExempt && lag > 0;
      });
    } else if (lagFilter === "on_track") {
      filteredRows = rows.filter((r) => {
        const lag = (lagDaysMap[r.empId] ?? 0);
        const isExempt = isLagExemptTeam(r.teamName);
        return isExempt || lag === 0;
      });
    }

    // Batch: leave deficits from employee_leave_lag
    let deficitMap: Record<number, { el: number; sl: number }> = {};
    if (empIds.length > 0) {
      try {
        const deficitRows = await query360Raw<{ empId: number; leavetype: number; deficit: number }>(
          `SELECT empId, leavetype, SUM(insufficientLeaves) AS deficit
           FROM employee_leave_lag
           WHERE empId IN (${empIds.map(() => "?").join(",")})
             AND status = 1
             AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')
           GROUP BY empId, leavetype`,
          [...empIds, fromDate, toDate]
        );
        for (const r of deficitRows) {
          if (!deficitMap[r.empId]) deficitMap[r.empId] = { el: 0, sl: 0 };
          const deficit = Number(r.deficit) || 0;
          if (Number(r.leavetype) === 2) deficitMap[r.empId].el = deficit;
          else if (Number(r.leavetype) === 1) deficitMap[r.empId].sl = deficit;
        }
      } catch (e) {
        console.error("Deficit batch error:", e);
      }
    }

    const hrCommentMap = getHrCommentsBatch(empIds);
    const pmCommentMap = await getPmCommentsBatch(empIds);

    let employees = filteredRows.map((r) => {
      const earnedLeaves = leaveMap[r.empId]?.earned ?? 0;
      const sickLeaves = leaveMap[r.empId]?.sick ?? 0;
      const otherLeaves = leaveMap[r.empId]?.other ?? 0;
      const totalLeaves = leaveMap[r.empId]?.total ?? 0;
      const elDeficit = deficitMap[r.empId]?.el ?? 0;
      const slDeficit = deficitMap[r.empId]?.sl ?? 0;
      const finalTotal = (earnedLeaves - elDeficit) + (sickLeaves - slDeficit) + otherLeaves;
      const pmEntry = pmCommentMap[r.empId];
      return {
        empId: r.empId,
        firstName: r.firstName,
        lastName: r.lastName,
        doodleId: r.doodleId || `EMP${r.empId}`,
        team: r.teamName,
        grade: r.grade || "",
        earnedLeaves,
        sickLeaves,
        otherLeaves,
        totalLeaves,
        elDeficit,
        slDeficit,
        finalTotal,
        lagDays: (r.isDtn === 1 || isLagExemptTeam(r.teamName)) ? 0 : (lagDaysMap[r.empId] ?? 0),
        hrComment: hrCommentMap[r.empId] ?? null,
        pmComment: pmEntry?.latest ?? null,
        pmCommentCount: pmEntry?.count ?? 0,
        pmCommentRecent: pmEntry?.recent ?? [],
        isDtn: r.isDtn === 1,
        leftOn: r.deletedAt ? (r.deletedAt instanceof Date ? r.deletedAt.toISOString().split('T')[0] : String(r.deletedAt).split('T')[0]) : null,
      };
    });

    // For negative_balance: SQL pre-filters by insufficientLeaves > 0 (superset);
    // in-memory narrows to strictly finalTotal < 0. All other leave filters are exact in SQL.
    if (leaveFilter === "negative_balance") {
      employees = employees.filter((e) => e.finalTotal < 0);
    }

    // effectiveTotal: use in-memory length for negative_balance (SQL over-selects),
    // use SQL count for all other filters (SQL is exact).
    const effectiveTotal = leaveFilter === "negative_balance" ? employees.length : total;
    res.json({ total: effectiveTotal, page, limit, employees });
  } catch (err) {
    console.error("employees list error:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /employees/export  — CSV export (no pagination)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/employees/export", async (req, res) => {
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  const days = await workingDaysWithHolidays(fromDate, toDate);

  try {
    const rows = await query360Raw<{
      empId: number;
      firstName: string;
      lastName: string;
      doodleId: string;
      teamName: string;
      grade: string;
      isDtn: number;
      deletedAt: string | null;
    }>(
      `SELECT
        e.empId, e.firstName, e.lastName, e.doodle_id AS doodleId,
        COALESCE(t.name, CAST(e.team AS CHAR)) AS teamName,
        COALESCE(ep.grade, '') AS grade,
        COALESCE(e.isDtn, 0) AS isDtn,
        e.deleted_at AS deletedAt
      FROM employees e
      LEFT JOIN teams t ON t.teamId = e.team AND t.status = 1
      LEFT JOIN emp_profile ep ON ep.empId = e.empId
      WHERE e.status = 1 AND (e.deleted_at IS NULL OR e.deleted_at >= ?) AND (e.isDtn = 0 OR e.isDtn IS NULL)
      ORDER BY e.firstName ASC
      LIMIT 500`,
      [fromDate]
    );

    const empIds = rows.map((r) => r.empId);

    const rawLeavesE = await query360Raw<{ empId: number; leave_type: number; from_date: Date|string; to_date: Date|string; leavePeriod: string }>(
      `SELECT l.empId, l.leave_type, l.from_date, l.to_date, l.leavePeriod
       FROM \`leave\` l
       WHERE l.empId IN (${empIds.map(() => "?").join(",")})
         AND l.status IN (1, 5) AND l.from_date <= ? AND l.to_date >= ?`,
      [...empIds, toDate, fromDate]
    );

    const holidaysE = await getHolidaysInRange(fromDate, toDate);
    const filterFromTimeE = new Date(fromDate).getTime();
    const filterToTimeE = new Date(toDate).getTime();
    const leaveMap: Record<number, { earned: number; sick: number; total: number }> = {};
    
    for (const r of rawLeavesE) {
      const actFromStr = r.from_date instanceof Date ? r.from_date.toISOString() : new Date(r.from_date).toISOString();
      const actToStr = r.to_date instanceof Date ? r.to_date.toISOString() : new Date(r.to_date).toISOString();
      
      const clampedFromStr = new Date(Math.max(new Date(actFromStr.split('T')[0]).getTime(), filterFromTimeE)).toISOString().split('T')[0];
      const clampedToStr = new Date(Math.min(new Date(actToStr.split('T')[0]).getTime(), filterToTimeE)).toISOString().split('T')[0];

      const wDays = calcWorkingDaysSync(clampedFromStr, clampedToStr, holidaysE);
      if (wDays > 0) {
        const finalDays = wDays * (r.leavePeriod === 'half_day' ? 0.5 : 1);
        if (!leaveMap[r.empId]) leaveMap[r.empId] = { earned: 0, sick: 0, total: 0 };
        const lType = Number(r.leave_type);
        if (lType === 2) leaveMap[r.empId].earned += finalDays;
        else if (lType === 1) leaveMap[r.empId].sick += finalDays;
        leaveMap[r.empId].total += finalDays;
      }
    }

    // Batch lag days
    const lagRows = await query360Raw<{ empId: number; daysLogged: number }>(
      `SELECT oe.emp_id AS empId, COUNT(DISTINCT oe.task_date) AS daysLogged
      FROM other_eods oe
      WHERE oe.emp_id IN (${empIds.map(() => "?").join(",")})
        AND oe.task_date BETWEEN ? AND ?
        AND oe.status = 1 AND oe.hours_spent > 0
      GROUP BY oe.emp_id`,
      [...empIds, fromDate, toDate]
    );
    const lagMap: Record<number, number> = {};
    for (const r of lagRows) lagMap[r.empId] = Math.max(0, days - Number(r.daysLogged));
    for (const id of empIds) if (lagMap[id] === undefined) lagMap[id] = days;

    // Deficit query for export
    let exportDeficitMap: Record<number, { el: number; sl: number }> = {};
    if (empIds.length > 0) {
      try {
        const defRows = await query360Raw<{ empId: number; leavetype: number; deficit: number }>(
          `SELECT empId, leavetype, SUM(insufficientLeaves) AS deficit
           FROM employee_leave_lag
           WHERE empId IN (${empIds.map(() => "?").join(",")})
             AND status = 1
             AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')
           GROUP BY empId, leavetype`,
          [...empIds, fromDate, toDate]
        );
        for (const r of defRows) {
          if (!exportDeficitMap[r.empId]) exportDeficitMap[r.empId] = { el: 0, sl: 0 };
          const deficit = Number(r.deficit) || 0;
          if (Number(r.leavetype) === 2) exportDeficitMap[r.empId].el = deficit;
          else if (Number(r.leavetype) === 1) exportDeficitMap[r.empId].sl = deficit;
        }
      } catch (e) {
        console.error("Export deficit error:", e);
      }
    }

    const hrCommentMap = getHrCommentsBatch(empIds);
    const pmCommentMap = await getPmCommentsBatch(empIds);

    const csvHeader = "Name,Employee ID,Type,Team,Grade,EL Taken,EL Deficit,SL Taken,SL Deficit,Other Leaves,Total Leaves,Final Total,Lag Days,Status,Left On,HR Comment,PM Comment\n";
    const csvRows = rows.map((r) => {
      const leftOn = r.deletedAt ? (r.deletedAt instanceof Date ? (r.deletedAt as Date).toISOString().split('T')[0] : String(r.deletedAt).split('T')[0]) : null;
      const elTaken = leaveMap[r.empId]?.earned ?? 0;
      const slTaken = leaveMap[r.empId]?.sick ?? 0;
      const otherLeaves = (leaveMap[r.empId]?.total ?? 0) - elTaken - slTaken;
      const totalLeaves = leaveMap[r.empId]?.total ?? 0;
      const elDeficit = exportDeficitMap[r.empId]?.el ?? 0;
      const slDeficit = exportDeficitMap[r.empId]?.sl ?? 0;
      const finalTotal = (elTaken - elDeficit) + (slTaken - slDeficit) + otherLeaves;
      const cells = [
        `"${r.firstName.trim()} ${r.lastName.trim()}"`,
        r.doodleId,
        r.isDtn ? "DTN" : "FT",
        `"${r.teamName}"`,
        r.grade,
        elTaken,
        elDeficit > 0 ? -elDeficit : 0,
        slTaken,
        slDeficit > 0 ? -slDeficit : 0,
        otherLeaves,
        totalLeaves,
        finalTotal,
        (r.isDtn === 1 || isLagExemptTeam(r.teamName)) ? 0 : (lagMap[r.empId] ?? 0),
        leftOn ? "Left" : "Active",
        leftOn ?? "",
        `"${(hrCommentMap[r.empId] ?? "").replace(/"/g, '""')}"`,
        `"${(pmCommentMap[r.empId] ?? "").replace(/"/g, '""')}"`,
      ];
      return cells.join(",");
    });
    const csv = csvHeader + csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="employees_${fromDate}_${toDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("employees export error:", err);
    res.status(500).json({ error: "Failed to export employees" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /employees/:empId/report
// ─────────────────────────────────────────────────────────────────────────────
router.get("/employees/:empId/report", async (req, res) => {
  const parsedParams = GetEmployeeReportParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }
  const empId = parsedParams.data.empId;
  const { fromDate, toDate } = extractDateRange(req.query as Record<string, unknown>);
  const days = await workingDaysWithHolidays(fromDate, toDate);

  try {
    const empRows = await query360Raw<{
      empId: number;
      firstName: string;
      lastName: string;
      doodleId: string;
      teamId: number;
      teamName: string;
      grade: string;
      isDtn: number;
    }>(
      `SELECT
        e.empId, e.firstName, e.lastName, e.doodle_id AS doodleId,
        e.team AS teamId,
        COALESCE(t.name, CAST(e.team AS CHAR)) AS teamName,
        COALESCE(ep.grade, '') AS grade,
        COALESCE(e.isDtn, 0) AS isDtn
      FROM employees e
      LEFT JOIN teams t ON t.teamId = e.team AND t.status = 1
      LEFT JOIN emp_profile ep ON ep.empId = e.empId
      WHERE e.empId = ? AND e.status = 1`,
      [empId]
    );

    if (!empRows[0]) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const emp = empRows[0];

    const [leaveRows, prodRows, trendRows, pmCommentRows] = await Promise.all([
      query360Raw<{ leave_type: number; from_date: Date|string; to_date: Date|string; leavePeriod: string }>(
        `SELECT l.leave_type, l.from_date, l.to_date, l.leavePeriod
         FROM \`leave\` l
         WHERE l.empId = ? AND l.status IN (1, 5) AND l.from_date <= ? AND l.to_date >= ?`,
        [empId, toDate, fromDate]
      ).then(async (rawLeaves) => {
        const holidays = await getHolidaysInRange(fromDate, toDate);
        const filterFromTime = new Date(fromDate).getTime();
        const filterToTime = new Date(toDate).getTime();
        let earnedLeaves = 0, sickLeaves = 0, otherLeaves = 0, totalLeaves = 0;
        
        for (const r of rawLeaves) {
          const actFromStr = r.from_date instanceof Date ? r.from_date.toISOString() : new Date(r.from_date).toISOString();
          const actToStr = r.to_date instanceof Date ? r.to_date.toISOString() : new Date(r.to_date).toISOString();
          
          const clampedFromStr = new Date(Math.max(new Date(actFromStr.split('T')[0]).getTime(), filterFromTime)).toISOString().split('T')[0];
          const clampedToStr = new Date(Math.min(new Date(actToStr.split('T')[0]).getTime(), filterToTime)).toISOString().split('T')[0];

          const wDays = calcWorkingDaysSync(clampedFromStr, clampedToStr, holidays);
          if (wDays > 0) {
            const finalDays = wDays * (r.leavePeriod === 'half_day' ? 0.5 : 1);
            const lType = Number(r.leave_type);
            if (lType === 2) earnedLeaves += finalDays;
            else if (lType === 1) sickLeaves += finalDays;
            else if ([3, 4, 5].includes(lType)) otherLeaves += finalDays;
            totalLeaves += finalDays;
          }
        }
        return [{ earnedLeaves, sickLeaves, otherLeaves, totalLeaves }];
      }),
      query360Raw<{ daysLogged: number; totalHours: number }>(
        `SELECT COUNT(DISTINCT task_date) AS daysLogged, COALESCE(SUM(hours_spent), 0) AS totalHours
        FROM other_eods
        WHERE emp_id = ? AND task_date BETWEEN ? AND ? AND status = 1 AND hours_spent > 0`,
        [empId, fromDate, toDate]
      ),
      // Per-day productivity trend
      query360Raw<{ taskDate: string; hoursLogged: number }>(
        `SELECT
          DATE_FORMAT(task_date, '%Y-%m-%d') AS taskDate,
          COALESCE(SUM(hours_spent), 0) AS hoursLogged
        FROM other_eods
        WHERE emp_id = ? AND task_date BETWEEN ? AND ? AND status = 1
        GROUP BY task_date
        ORDER BY task_date ASC`,
        [empId, fromDate, toDate]
      ),
      // PM comments — no date filter, show all so HR always sees the full history
      query360Raw<{ pmComments: string; createdAt: string; projectId: number }>(
        `SELECT t.pmComments, DATE_FORMAT(t.createdAt, '%Y-%m-%d') AS createdAt, t.projectId
        FROM tasks t
        WHERE t.empId = ? AND t.pmComments IS NOT NULL AND t.pmComments != ''
          AND t.status = 1
        ORDER BY t.createdAt DESC`,
        [empId]
      ),
    ]);

    const daysLogged = Number(prodRows[0]?.daysLogged) || 0;
    const rawLagDays = Math.max(0, days - daysLogged);
    const lagDays = (emp.isDtn === 1 || isLagExemptTeam(emp.teamName)) ? 0 : rawLagDays;

    const earnedLeaves = Math.max(0, Number(leaveRows[0]?.earnedLeaves) || 0);
    const sickLeaves = Math.max(0, Number(leaveRows[0]?.sickLeaves) || 0);
    const otherLeaves = Math.max(0, Number(leaveRows[0]?.otherLeaves) || 0);
    const totalLeaves = Math.max(0, Number(leaveRows[0]?.totalLeaves) || 0);

    // Leave deficit for individual report
    let elDeficit = 0;
    let slDeficit = 0;
    try {
      const defRows = await query360Raw<{ leavetype: number; deficit: number }>(
        `SELECT leavetype, SUM(insufficientLeaves) AS deficit
         FROM employee_leave_lag
         WHERE empId = ?
           AND status = 1
           AND CONCAT(year, '-', LPAD(month, 2, '0')) BETWEEN DATE_FORMAT(?, '%Y-%m') AND DATE_FORMAT(?, '%Y-%m')
         GROUP BY leavetype`,
        [empId, fromDate, toDate]
      );
      for (const r of defRows) {
        const deficit = Number(r.deficit) || 0;
        if (Number(r.leavetype) === 2) elDeficit = deficit;
        else if (Number(r.leavetype) === 1) slDeficit = deficit;
      }
    } catch (e) {
      console.error("Report deficit error:", e);
    }
    const finalTotal = (earnedLeaves - elDeficit) + (sickLeaves - slDeficit) + otherLeaves;

    const hrComment = getHrComment(empId);
    const category = await getEmpProjectCategory(empId);

    // Build trend: fill in missing days with 0
    const trendMap: Record<string, number> = {};
    for (const r of trendRows) trendMap[r.taskDate] = Number(r.hoursLogged);

    const productivityTrend = trendRows.map((r) => ({
      date: r.taskDate,
      hoursLogged: Number(r.hoursLogged),
      isLagDay: Number(r.hoursLogged) === 0,
    }));

    let productivityLevel = "High";
    if (lagDays >= 5) productivityLevel = "Low";
    else if (lagDays >= 2) productivityLevel = "Moderate";

    res.json({
      empId: emp.empId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      doodleId: emp.doodleId || `EMP${emp.empId}`,
      team: emp.teamName,
      grade: emp.grade || "",
      isDtn: emp.isDtn === 1,
      category,
      earnedLeaves,
      sickLeaves,
      otherLeaves,
      totalLeaves,
      elDeficit,
      slDeficit,
      finalTotal,
      daysLogged,
      lagDays,
      expectedDays: days,
      productivityLevel,
      hrComment,
      pmComments: pmCommentRows.map((r) => ({
        comment: r.pmComments,
        date: r.createdAt,
      })),
      productivityTrend,
    });
  } catch (err) {
    console.error("employee report error:", err);
    res.status(500).json({ error: "Failed to fetch employee report" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /employees/:empId/comment
// ─────────────────────────────────────────────────────────────────────────────
router.put("/employees/:empId/comment", async (req, res) => {
  const parsedParams = SaveEmployeeCommentParams.safeParse(req.params);
  const parsedBody = SaveEmployeeCommentBody.safeParse(req.body);

  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const empId = parsedParams.data.empId;
  const { comment } = parsedBody.data;

  const updatedAt = new Date();
  hrComments.set(empId, { comment, updated_at: updatedAt });
  res.json({ empId, comment, updatedAt: updatedAt.toISOString() });
});

export default router;
