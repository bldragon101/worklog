import { hasPermission, type UserRole } from "@/lib/permissions";

/**
 * Job fields only admins may write. Hiding a deduction changes what drivers
 * see on their RCTIs and jobs reports.
 */
export const ADMIN_ONLY_JOB_FIELDS = ["hideDeduction"] as const;

/**
 * Job fields the given role may not write. They are dropped from the request
 * rather than rejected, so a non-admin saving a job leaves them unchanged.
 */
export function getRestrictedJobFields({
  userRole,
}: {
  userRole: UserRole;
}): readonly string[] {
  return hasPermission(userRole, "hide_job_deductions")
    ? []
    : ADMIN_ONLY_JOB_FIELDS;
}
