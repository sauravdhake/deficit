import { Router } from "express";

const router = Router();

const spec = {
  openapi: "3.0.3",
  info: {
    title: "HR Productivity Dashboard API",
    description: "Read-only API for employee leave and productivity data from Doodle360 staging DB.",
    version: "1.0.0",
  },
  servers: [{ url: "/api", description: "API base" }],
  tags: [
    { name: "Health", description: "Service health check" },
    { name: "Dashboard", description: "Overview metrics and charts" },
    { name: "Employees", description: "Employee list, reports, and comments" },
  ],
  paths: {
    "/healthz": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: { "200": { description: "Service is healthy" } },
      },
    },
    "/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "Headcount summary",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: {
          "200": {
            description: "Summary counts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalEmployees: { type: "integer" },
                    dtnEmployees: { type: "integer" },
                    ftEmployees: { type: "integer" },
                    laggingCount: { type: "integer" },
                    onLeaveCount: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/dashboard/resource-counts": {
      get: {
        tags: ["Dashboard"],
        summary: "Resource count by project type",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: { "200": { description: "Resource counts grouped by category" } },
      },
    },
    "/dashboard/leave-analytics": {
      get: {
        tags: ["Dashboard"],
        summary: "Leave analytics by type and category",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: { "200": { description: "Leave breakdown" } },
      },
    },
    "/dashboard/productivity": {
      get: {
        tags: ["Dashboard"],
        summary: "Productivity summary (EOD days logged)",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: { "200": { description: "Productivity overview" } },
      },
    },
    "/dashboard/productivity-trend": {
      get: {
        tags: ["Dashboard"],
        summary: "Daily productivity trend over selected period",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: { "200": { description: "Per-day trend data" } },
      },
    },
    "/dashboard/lagging-resources": {
      get: {
        tags: ["Dashboard"],
        summary: "Top lagging employees",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: { "200": { description: "List of employees with highest lag days" } },
      },
    },
    "/employees": {
      get: {
        tags: ["Employees"],
        summary: "Paginated employee list with leave and lag data",
        parameters: [
          { $ref: "#/components/parameters/dateFrom" },
          { $ref: "#/components/parameters/dateTo" },
          {
            name: "search",
            in: "query",
            description: "Filter by name or employee ID",
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 200 },
          },
          {
            name: "lagFilter",
            in: "query",
            description: "Filter by lag status",
            schema: { type: "string", enum: ["all", "has_lag", "on_track"] },
          },
          {
            name: "leaveFilter",
            in: "query",
            description: "Filter by leave taken",
            schema: { type: "string", enum: ["all", "took_leave", "took_earned", "took_sick", "took_other"] },
          },
        ],
        responses: {
          "200": {
            description: "Paginated employee list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    employees: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Employee" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/employees/export": {
      get: {
        tags: ["Employees"],
        summary: "Export full employee list as CSV (no pagination)",
        parameters: [{ $ref: "#/components/parameters/dateFrom" }, { $ref: "#/components/parameters/dateTo" }],
        responses: {
          "200": {
            description: "CSV file download",
            content: { "text/csv": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/employees/{empId}/report": {
      get: {
        tags: ["Employees"],
        summary: "Full employee report with leave breakdown, productivity trend and PM comments",
        parameters: [
          { name: "empId", in: "path", required: true, schema: { type: "integer" } },
          { $ref: "#/components/parameters/dateFrom" },
          { $ref: "#/components/parameters/dateTo" },
        ],
        responses: {
          "200": { description: "Employee report" },
          "404": { description: "Employee not found" },
        },
      },
    },
    "/employees/{empId}/comment": {
      put: {
        tags: ["Employees"],
        summary: "Save or update HR comment for an employee",
        parameters: [
          { name: "empId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { comment: { type: "string" } },
                required: ["comment"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Comment saved" },
          "400": { description: "Invalid request" },
        },
      },
    },
  },
  components: {
    parameters: {
      dateFrom: {
        name: "dateFrom",
        in: "query",
        description: "Start date (YYYY-MM-DD). Defaults to last Monday.",
        schema: { type: "string", format: "date", example: "2026-03-16" },
      },
      dateTo: {
        name: "dateTo",
        in: "query",
        description: "End date (YYYY-MM-DD). Defaults to last Friday.",
        schema: { type: "string", format: "date", example: "2026-03-20" },
      },
    },
    schemas: {
      Employee: {
        type: "object",
        properties: {
          empId: { type: "integer" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          doodleId: { type: "string", example: "DB1448" },
          team: { type: "string" },
          grade: { type: "string" },
          earnedLeaves: { type: "number" },
          sickLeaves: { type: "number" },
          otherLeaves: { type: "number" },
          totalLeaves: { type: "number" },
          lagDays: { type: "integer" },
          hrComment: { type: "string", nullable: true },
          pmComment: { type: "string", nullable: true },
          isDtn: { type: "boolean" },
        },
      },
    },
  },
};

// Serve OpenAPI JSON spec
router.get("/docs/openapi.json", (_req, res) => {
  res.json(spec);
});

// Serve Swagger UI (CDN-based, no extra packages needed)
router.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HR Dashboard API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f1117; }
    .swagger-ui .topbar { background: #1a1d2e; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/docs/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`);
});

export default router;
