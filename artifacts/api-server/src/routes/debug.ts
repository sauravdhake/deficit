import { Router, type IRouter } from "express";
import { query360Raw } from "../lib/db360";

const router: IRouter = Router();

router.get("/debug/teams", async (_req, res) => {
  try {
    const rows = await query360Raw<{ teamId: number; name: string; status: number }>(
      `SELECT teamId, name, status FROM teams ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/schema", async (_req, res) => {
  try {
    const [
      engagement,
      leaveTypes,
      approvalStatuses,
      eodSample,
      approvedHoursCols,
    ] = await Promise.all([
      query360Raw<{ engagementType: string; cnt: number }>(
        `SELECT engagementType, COUNT(*) AS cnt FROM emp_profile GROUP BY engagementType ORDER BY cnt DESC LIMIT 20`
      ),
      query360Raw<{ leave_type: string; cnt: number }>(
        `SELECT leave_type, COUNT(*) AS cnt FROM \`leave\` GROUP BY leave_type ORDER BY cnt DESC LIMIT 20`
      ),
      query360Raw<{ approvalStatus: number; cnt: number }>(
        `SELECT approvalStatus, COUNT(*) AS cnt FROM approved_resource_requests GROUP BY approvalStatus LIMIT 10`
      ),
      query360Raw<{ cnt: number; maxDate: string; minDate: string }>(
        `SELECT COUNT(*) AS cnt, MAX(task_date) AS maxDate, MIN(task_date) AS minDate FROM other_eods WHERE status = 1`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approved_resource_requests' ORDER BY ORDINAL_POSITION LIMIT 30`
      ),
    ]);

    res.json({
      engagementTypes: engagement,
      leaveTypes,
      approvalStatuses,
      otherEods: eodSample[0],
      approvedResourceRequestColumns: approvedHoursCols,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/full-schema", async (_req, res) => {
  try {
    const [
      allTables,
      empProfileCols,
      leaveColsFull,
      eodCols,
      employeeCols,
      teamsCols,
      teamsData,
    ] = await Promise.all([
      query360Raw<{ TABLE_NAME: string; TABLE_ROWS: number }>(
        `SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_ROWS DESC`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emp_profile' ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave' ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'other_eods' ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<Record<string, unknown>>(
        `SELECT * FROM teams LIMIT 10`
      ),
    ]);

    res.json({
      allTables,
      empProfileCols,
      leaveColsFull,
      eodCols,
      employeeCols,
      teamsCols,
      teamsData,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/pm-sprint-tables", async (_req, res) => {
  try {
    const allTables = await query360Raw<{ TABLE_NAME: string; TABLE_ROWS: number }>(
      `SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME ASC`
    );

    const pmRelated = allTables.filter(t => {
      const n = (t.TABLE_NAME as string).toLowerCase();
      return n.includes("pm") || n.includes("comment") || n.includes("sprint") ||
        n.includes("timesheet") || n.includes("task") || n.includes("log") ||
        n.includes("project") || n.includes("resource") || n.includes("request") ||
        n.includes("allocation") || n.includes("eod") || n.includes("report") ||
        n.includes("activity") || n.includes("note") || n.includes("remark");
    });

    const results: Record<string, unknown> = {
      allTableNames: allTables.map(t => `${t.TABLE_NAME}(~${t.TABLE_ROWS})`),
      pmRelatedTables: pmRelated,
    };

    for (const t of pmRelated.slice(0, 10)) {
      try {
        const cols = await query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
          `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          [t.TABLE_NAME]
        );
        results[`cols_${t.TABLE_NAME}`] = cols;
      } catch {
        results[`cols_${t.TABLE_NAME}`] = "error";
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/leave-balance", async (_req, res) => {
  try {
    const [leaveBalance, employeeLeaveFields, engTypeSample] = await Promise.all([
      query360Raw<Record<string, unknown>>(
        `SELECT e.empId, e.firstName, e.earnedLeave, e.sickLeave, e.isDtn
        FROM employees e WHERE e.status = 1 AND e.deleted_at IS NULL
        ORDER BY e.earnedLeave ASC LIMIT 10`
      ),
      query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees'
        AND COLUMN_NAME LIKE '%leave%' OR COLUMN_NAME LIKE '%balance%'
        ORDER BY ORDINAL_POSITION`
      ),
      query360Raw<Record<string, unknown>>(
        `SELECT e.empId, e.firstName, ep.engagementType, e.isDtn
        FROM employees e
        LEFT JOIN emp_profile ep ON ep.empId = e.empId
        WHERE e.status = 1
        ORDER BY ep.engagementType ASC LIMIT 30`
      ),
    ]);
    res.json({ leaveBalance, employeeLeaveFields, engTypeSample });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/project-analysis", async (_req, res) => {
  try {
    const [
      projectTypeEnum,
      projectTypeDist,
      empProjectType,
      tasksPmComments,
      holidaysAll,
      taPmStatus,
      eodVsNonEod,
    ] = await Promise.all([
      query360Raw<{ COLUMN_TYPE: string }>(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'project_type'`
      ),
      query360Raw<{ project_type: string; cnt: number }>(
        `SELECT project_type, COUNT(*) AS cnt FROM projects WHERE status = 1 GROUP BY project_type ORDER BY cnt DESC`
      ),
      query360Raw<{ project_type: string; empCount: number }>(
        `SELECT p.project_type, COUNT(DISTINCT tm.empId) AS empCount
        FROM task_mapping tm
        JOIN projects p ON p.projectId = tm.projectId
        WHERE p.status = 1
        GROUP BY p.project_type
        ORDER BY empCount DESC`
      ),
      query360Raw<{ empId: number; pmComments: string; createdAt: string }>(
        `SELECT t.empId, t.pmComments, t.createdAt
        FROM tasks t
        WHERE t.pmComments IS NOT NULL AND t.pmComments != ''
        ORDER BY t.createdAt DESC LIMIT 5`
      ),
      query360Raw<{ id: number; title: string; holidays_date: string; status: number; optional_status: number }>(
        `SELECT id, title, holidays_date, status, optional_status FROM holidays WHERE YEAR(holidays_date) >= 2025 ORDER BY holidays_date ASC`
      ),
      query360Raw<{ status: number; cnt: number }>(
        `SELECT status, COUNT(*) AS cnt FROM ta_pm_eod GROUP BY status`
      ),
      query360Raw<{ has_eod: number; emp_count: number }>(
        `SELECT 
          CASE WHEN oe.emp_id IS NOT NULL THEN 1 ELSE 0 END AS has_eod,
          COUNT(DISTINCT e.empId) AS emp_count
        FROM employees e
        LEFT JOIN other_eods oe ON oe.emp_id = e.empId 
          AND oe.task_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND oe.status = 1
        WHERE e.status = 1 AND e.deleted_at IS NULL
        GROUP BY has_eod`
      ),
    ]);

    res.json({
      projectTypeEnum: projectTypeEnum[0],
      projectTypeDist,
      empProjectType,
      tasksPmComments,
      holidaysAll,
      taPmStatus,
      eodVsNonEod,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/debug/key-tables", async (_req, res) => {
  try {
    const tables = [
      "ta_pm_eod", "sprints", "tasks", "task_mapping",
      "employee_leave_lag", "holidays", "tod_eod", "leavetype",
      "projects", "accounts", "tech_and_qa", "cu_allocation",
      "project_resource_allocations", "comp_off",
    ];
    const result: Record<string, unknown> = {};
    for (const t of tables) {
      const cols = await query360Raw<{ COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [t]
      );
      result[`cols_${t}`] = cols;
    }
    // sample data from key tables
    const [lagSample, holidaysSample, leavetypeSample, taPmSample, projectsSample, accountsSample] = await Promise.all([
      query360Raw(`SELECT * FROM employee_leave_lag LIMIT 5`),
      query360Raw(`SELECT * FROM holidays LIMIT 5`),
      query360Raw(`SELECT * FROM leavetype LIMIT 10`),
      query360Raw(`SELECT * FROM ta_pm_eod LIMIT 3`),
      query360Raw(`SELECT * FROM projects LIMIT 3`),
      query360Raw(`SELECT * FROM accounts LIMIT 3`),
    ]);
    result.lagSample = lagSample;
    result.holidaysSample = holidaysSample;
    result.leavetypeSample = leavetypeSample;
    result.taPmSample = taPmSample;
    result.projectsSample = projectsSample;
    result.accountsSample = accountsSample;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

