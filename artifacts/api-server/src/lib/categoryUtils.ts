/**
 * Teams that are exempt from productivity lag tracking.
 * Employees in these teams always show lagDays = 0.
 * Matching is case-insensitive and uses startsWith / includes logic.
 */
export const LAG_EXEMPT_TEAM_PATTERNS = [
  "account manager",
  "accountant",
  "business analyst",
  "business development",
  "business strategy",
  "delivery",       // covers "Delivery" and "Delivery Head"
  "digital marketing",
  "head of engineering",
  "tech head",
  "hr",
  "network",
  "operation",     // covers "Operation" and "Operations"
  "tech arch",     // covers "Tech Arch" and "Tech Architect"
  "rgt",
];

export function isLagExemptTeam(teamName: string | null | undefined): boolean {
  if (!teamName) return false;
  const lower = teamName.trim().toLowerCase();
  return LAG_EXEMPT_TEAM_PATTERNS.some((pattern) => lower === pattern || lower.startsWith(pattern + " ") || lower.includes(pattern));
}

export const PROJECT_CATEGORY_MAP: Record<string, string> = {
  retainer: "Retainer",
  fixed_fee: "Fixed Fee",
  manage_service: "Managed Service",
  internal: "Internal",
  FF: "Fixed Fee",
  TM: "Managed Service",
  SS: "Other",
  Others: "Other",
};

export function getProjectCategory(projectType: string | null | undefined): string {
  if (!projectType) return "Other";
  return PROJECT_CATEGORY_MAP[projectType] ?? "Other";
}

export const CATEGORY_ORDER = [
  "Retainer",
  "Fixed Fee",
  "Managed Service",
  "Internal",
  "Other",
];

export const CATEGORY_SQL_CASE = `CASE COALESCE(p.project_type, 'other')
  WHEN 'retainer' THEN 'Retainer'
  WHEN 'fixed_fee' THEN 'Fixed Fee'
  WHEN 'manage_service' THEN 'Managed Service'
  WHEN 'internal' THEN 'Internal'
  WHEN 'FF' THEN 'Fixed Fee'
  WHEN 'TM' THEN 'Managed Service'
  ELSE 'Other'
END`;
