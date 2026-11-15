import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import {
  mapCompanySettingsForPdf,
  mapRctiToPdfData,
  renderPdfToBuffer,
  rctiPdfInclude,
} from "@/lib/rcti-pdf";
import {
  buildRctiStatement,
  getMelbourneTodayIso,
  isStatementEligibleStatus,
} from "@/lib/rcti-statement";
import type { CompanySettingsForEmail } from "@/lib/types";
import { RctiStatementPdfDocument } from "@/components/rcti/rcti-statement-pdf-template";

/**
 * Loads a driver's selected RCTIs and everything needed to build their
 * statement. Throws an ApiError when an RCTI is missing, belongs to another
 * driver or is still a draft, or when company settings are not configured.
 */
export async function loadRctiStatement({
  driverId,
  rctiIds,
}: {
  driverId: number;
  rctiIds: number[];
}) {
  const uniqueIds = Array.from(new Set(rctiIds));

  const rctis = await prisma.rcti.findMany({
    where: { id: { in: uniqueIds }, driverId },
    include: rctiPdfInclude,
    orderBy: [{ weekEnding: "asc" }, { invoiceNumber: "asc" }],
  });

  if (rctis.length !== uniqueIds.length) {
    throw new ApiError({
      status: 404,
      message: "One or more selected RCTIs were not found for this driver",
    });
  }

  const drafts = rctis.filter(
    ({ status }) => !isStatementEligibleStatus({ status }),
  );
  if (drafts.length > 0) {
    throw new ApiError({
      status: 400,
      message: `Only finalised or paid RCTIs can be included. Remove: ${drafts
        .map(({ invoiceNumber }) => invoiceNumber)
        .join(", ")}`,
    });
  }

  const settings =
    (await prisma.companySettings.findFirst()) as CompanySettingsForEmail | null;
  if (!settings) {
    throw new ApiError({
      status: 400,
      message:
        "Company settings not configured. Please configure company details in Settings first.",
    });
  }

  const { logoDataUrl, logoPublicUrl } = await buildCompanyLogoAssets({
    companyLogo: settings.companyLogo,
  });

  const rctiData = rctis.map((rcti) => mapRctiToPdfData({ rcti }));
  const statement = buildRctiStatement({ rctis: rctiData });
  const latest = rctis[rctis.length - 1];

  return {
    rctis,
    rctiData,
    statement,
    statementDate: getMelbourneTodayIso(),
    driver: {
      driverName: latest.driverName,
      businessName: latest.businessName,
      driverAbn: latest.driverAbn,
      driverAddress: latest.driverAddress,
    },
    driverEmail: latest.driver?.email ?? null,
    settings,
    settingsData: mapCompanySettingsForPdf({ settings, logoDataUrl }),
    logoPublicUrl,
  };
}

export type LoadedRctiStatement = Awaited<ReturnType<typeof loadRctiStatement>>;

/** Renders the statement summary and/or each full RCTI as one PDF */
export async function renderRctiStatementPdf({
  data,
  includeStatement,
  includeRctis,
}: {
  data: LoadedRctiStatement;
  includeStatement: boolean;
  includeRctis: boolean;
}): Promise<Buffer> {
  const document = createElement(RctiStatementPdfDocument, {
    statement: data.statement,
    driver: data.driver,
    settings: data.settingsData,
    statementDate: data.statementDate,
    includeStatement,
    rctis: includeRctis ? data.rctiData : [],
  }) as ReactElement<DocumentProps>;

  return renderPdfToBuffer({ document });
}
