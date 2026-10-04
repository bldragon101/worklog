import { hasPermission, type UserRole } from "@/lib/permissions";
import { toNumber } from "@/lib/utils/rcti-calculations";

export const DRIVER_BANK_DETAIL_FIELDS = [
  "bankAccountName",
  "bankAccountNumber",
  "bankBsb",
] as const;

type DriverBankDetailField = (typeof DRIVER_BANK_DETAIL_FIELDS)[number];

// Prisma Decimal, or its string form once a record has been through JSON
type DriverNumericValue = number | string | { toNumber: () => number } | null;

interface SerialisableDriver {
  tray: DriverNumericValue;
  crane: DriverNumericValue;
  semi: DriverNumericValue;
  semiCrane: DriverNumericValue;
  fuelLevy: DriverNumericValue;
  isArchived?: boolean | null;
}

function toNullableNumber({ value }: { value: DriverNumericValue }) {
  if (!value) return null;
  return typeof value === "string" ? Number(value) : toNumber(value);
}

/**
 * Whether a role may see and change drivers' bank account details.
 */
export function canManageDriverBankDetails({
  userRole,
}: {
  userRole: UserRole | null;
}) {
  return (
    userRole !== null && hasPermission(userRole, "manage_driver_bank_details")
  );
}

/**
 * Remove bank account details from a driver record.
 */
export function omitDriverBankDetails<T extends object>({
  driver,
}: {
  driver: T;
}) {
  const bankFields: readonly string[] = DRIVER_BANK_DETAIL_FIELDS;
  return Object.fromEntries(
    Object.entries(driver).filter(([key]) => !bankFields.includes(key)),
  ) as Omit<T, DriverBankDetailField>;
}

/**
 * Prepare a driver for a JSON response: convert Decimal rates to numbers and
 * leave out bank account details unless the caller may see them.
 */
export function serialiseDriver<T extends SerialisableDriver>({
  driver,
  includeBankDetails,
}: {
  driver: T;
  includeBankDetails: boolean;
}) {
  const serialised = {
    ...driver,
    tray: toNullableNumber({ value: driver.tray }),
    crane: toNullableNumber({ value: driver.crane }),
    semi: toNullableNumber({ value: driver.semi }),
    semiCrane: toNullableNumber({ value: driver.semiCrane }),
    fuelLevy: toNullableNumber({ value: driver.fuelLevy }),
    isArchived: driver.isArchived ?? false,
  };

  return includeBankDetails
    ? serialised
    : omitDriverBankDetails({ driver: serialised });
}
