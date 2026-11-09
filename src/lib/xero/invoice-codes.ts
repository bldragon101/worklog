import type {
  CustomerInvoiceLine,
  CustomerInvoiceWarning,
  TruckClass,
  XeroContactRef,
} from "@/lib/customer-invoices/types";
import { normaliseName } from "@/lib/customer-invoices/grouping";
import { normaliseRegistration } from "@/lib/tolls/toll-matching";
import { formatDriverFullName } from "@/lib/utils/driver-name";
import { getFuelLevyItemCode } from "@/lib/xero/item-matching";
import type { XeroSettingsView } from "@/lib/xero/types";

export const DEFAULT_XERO_SETTINGS: XeroSettingsView = {
  salesAccountCode: "200",
  taxType: "OUTPUT",
  breakItemCode: "Break",
  eastlinkItemCode: "EL",
  citylinkItemCode: "CL",
  fuelLevyItemCode: "Fuel Levy",
};

const TRUCK_CLASS_LABELS: Record<TruckClass, string> = {
  tray: "Tray",
  crane: "Crane",
  semi: "Semi",
  semiCrane: "Semi Crane",
};

export interface XeroDriverInfo {
  type: string;
  companyName: string;
}

/**
 * What an invoice needs to find its Xero item codes and contact. Built once
 * per request by `loadXeroInvoiceContext`.
 */
export interface XeroInvoiceContext {
  settings: XeroSettingsView;
  /** Codes of the items synced from Xero; empty before the first sync */
  itemCodes: Set<string>;
  /** Normalised registration → item code */
  vehicleItems: Map<string, string>;
  /** `companyKey|truckClass` → item code */
  companyItems: Map<string, string>;
  /** Normalised bill to → contact */
  contacts: Map<string, XeroContactRef>;
  /** Normalised driver name (as on jobs) → driver type and company */
  drivers: Map<string, XeroDriverInfo>;
}

export function companyItemKey({
  companyKey,
  truckClass,
}: {
  companyKey: string;
  truckClass: TruckClass;
}): string {
  return `${companyKey}|${truckClass}`;
}

/**
 * The company a contractor or subcontractor is invoiced as: the business
 * name, or without one the truck field for subcontractors (which holds the
 * company's abbreviation) and the full name for contractors.
 */
export function getXeroCompanyName({
  type,
  businessName,
  truck,
  driver,
  lastName,
}: {
  type: string;
  businessName: string | null;
  truck: string;
  driver: string;
  lastName: string | null;
}): string {
  const business = businessName?.trim();
  if (business) return business;
  if (type === "Subcontractor" && truck.trim()) return truck.trim();
  return formatDriverFullName({ driver, lastName });
}

/** Employees are invoiced by truck; contractors and subcontractors by company */
export function isInvoicedByCompany({ type }: { type: string }): boolean {
  return type === "Contractor" || type === "Subcontractor";
}

function resolveJobItemCode({
  line,
  context,
}: {
  line: CustomerInvoiceLine;
  context: XeroInvoiceContext;
}): { itemCode: string | null; problem: string | null } {
  if (!line.truckClass) return { itemCode: null, problem: null };

  const driver = context.drivers.get(normaliseName({ value: line.driver }));
  if (driver && isInvoicedByCompany({ type: driver.type })) {
    const itemCode =
      context.companyItems.get(
        companyItemKey({
          companyKey: normaliseName({ value: driver.companyName }),
          truckClass: line.truckClass,
        }),
      ) ?? null;
    return {
      itemCode,
      problem: itemCode
        ? null
        : `No Xero ${TRUCK_CLASS_LABELS[line.truckClass]} item is mapped for ${driver.companyName}`,
    };
  }

  const registration = line.registration ?? "";
  const itemCode =
    context.vehicleItems.get(normaliseRegistration({ registration })) ?? null;
  if (itemCode) return { itemCode, problem: null };
  return {
    itemCode: null,
    problem: driver
      ? `No Xero item is mapped for truck ${registration || "(no registration)"}`
      : `No Xero item is mapped for truck ${registration || "(no registration)"}, and "${line.driver}" has no driver record`,
  };
}

function resolveOtherItemCode({
  line,
  context,
}: {
  line: CustomerInvoiceLine;
  context: XeroInvoiceContext;
}): { itemCode: string | null; problem: string | null } {
  const { settings } = context;
  if (line.kind === "break") {
    return {
      itemCode: settings.breakItemCode,
      problem: settings.breakItemCode ? null : "No Xero item is set for breaks",
    };
  }
  if (line.kind === "toll") {
    const itemCode =
      line.tollRoad === "eastlink" ? settings.eastlinkItemCode : settings.citylinkItemCode;
    return {
      itemCode,
      problem: itemCode
        ? null
        : `No Xero item is set for ${line.tollRoad === "eastlink" ? "Eastlink" : "CityLink"} tolls`,
    };
  }
  const itemCode = getFuelLevyItemCode({
    percent: line.fuelLevyPercent ?? 0,
    itemCodes: context.itemCodes,
    fallbackItemCode: settings.fuelLevyItemCode,
  });
  return { itemCode, problem: itemCode ? null : "No Xero item is set for the fuel levy" };
}

/**
 * Adds the Xero item code to each invoice line and finds the Xero contact for
 * the bill to, with a warning for anything not mapped and for mapped item
 * codes no longer in Xero.
 */
export function applyXeroCodes({
  lines,
  billTo,
  context,
}: {
  lines: CustomerInvoiceLine[];
  billTo: string;
  context: XeroInvoiceContext;
}): {
  lines: CustomerInvoiceLine[];
  contact: XeroContactRef | null;
  warnings: CustomerInvoiceWarning[];
} {
  const warnings: CustomerInvoiceWarning[] = [];
  const missingCodes = new Set<string>();

  const codedLines = lines.map((line) => {
    const { itemCode, problem } =
      line.kind === "job"
        ? resolveJobItemCode({ line, context })
        : resolveOtherItemCode({ line, context });

    if (problem) {
      warnings.push({ code: "unmapped_item", jobId: line.jobId, message: problem });
    } else if (
      itemCode &&
      context.itemCodes.size > 0 &&
      !context.itemCodes.has(itemCode) &&
      !missingCodes.has(itemCode)
    ) {
      missingCodes.add(itemCode);
      warnings.push({
        code: "unmapped_item",
        jobId: line.kind === "job" ? line.jobId : null,
        message: `Item code "${itemCode}" is not in Xero. Sync from Xero or change the mapping.`,
      });
    }
    return { ...line, itemCode };
  });

  const contact = context.contacts.get(normaliseName({ value: billTo })) ?? null;
  if (!contact) {
    warnings.push({
      code: "unmapped_contact",
      jobId: null,
      message: `Bill to "${billTo || "(none)"}" is not linked to a Xero contact`,
    });
  }

  return { lines: codedLines, contact, warnings };
}
