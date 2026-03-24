import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

interface JobsReportPdfTemplateProps {
  report: {
    id: number;
    reportNumber: string;
    driverName: string;
    weekEnding: string;
    status: string;
    notes: string | null;
    lines: Array<{
      id: number;
      jobDate: string;
      customer: string;
      truckType: string;

      startTime: string | null;
      finishTime: string | null;
      chargedHours: number | null;
      driverCharge: number | null;
    }>;
  };
  settings: {
    companyName: string;
    companyAbn: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyLogo: string;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 55,
    paddingBottom: 45,
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  header: {
    position: "absolute",
    top: 12,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1pt solid #2563eb",
    paddingBottom: 5,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  logo: {
    width: 90,
    height: 28,
    objectFit: "contain",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e3a5f",
    marginBottom: 1,
  },
  companyDetails: {
    fontSize: 6.5,
    color: "#6b7280",
    marginBottom: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1e3a5f",
    marginBottom: 8,
    marginTop: 2,
    textAlign: "center",
  },
  section: {
    marginBottom: 7,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 3,
    borderBottom: "0.5pt solid #d1d5db",
    paddingBottom: 2,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailItem: {
    width: "25%",
    marginBottom: 3,
  },
  label: {
    fontSize: 6.5,
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 1,
  },
  value: {
    fontSize: 7.5,
    color: "#1f2937",
  },
  table: {
    marginTop: 4,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontWeight: "bold",
  },
  tableHeaderText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 7,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottom: "0.5pt solid #e5e7eb",
    minHeight: 14,
  },
  tableRowAlt: {
    backgroundColor: "#f3f4f6",
  },
  // Column widths for landscape A4 (approx 800pt usable width)
  colDate: { width: "9%" },
  colCustomer: { width: "26%" },
  colVehicle: { width: "14%" },
  colStart: { width: "10%", textAlign: "right" },
  colFinish: { width: "10%", textAlign: "right" },
  colHours: { width: "10%", textAlign: "right" },
  colTravel: { width: "11%", textAlign: "right" },
  colTotal: { width: "10%", textAlign: "right" },
  cellText: {
    fontSize: 7,
    color: "#1f2937",
  },
  cellTextMuted: {
    fontSize: 7,
    color: "#9ca3af",
  },
  cellTextTravel: {
    fontSize: 7,
    color: "#d97706",
    fontWeight: "bold",
  },
  cellTextTotal: {
    fontSize: 7,
    color: "#1e3a5f",
    fontWeight: "bold",
  },
  totalsSection: {
    marginTop: 4,
    borderTop: "1.5pt solid #374151",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginLeft: 20,
  },
  totalLabel: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 1,
  },
  totalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e3a5f",
  },
  totalValueTravel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#d97706",
  },
  totalValueGrand: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#059669",
  },
  notes: {
    marginTop: 8,
    padding: 5,
    backgroundColor: "#fef3c7",
    borderRadius: 2,
    border: "0.5pt solid #fbbf24",
  },
  notesTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 7,
    color: "#78350f",
    lineHeight: 1.4,
  },
  emptyState: {
    padding: 16,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 8,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 20,
    right: 20,
    borderTop: "0.5pt solid #e5e7eb",
    paddingTop: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 6,
    color: "#9ca3af",
  },
  statusPill: {
    fontSize: 7,
    color: "#374151",
    fontWeight: "bold",
  },
});

const MONTH_NAMES: string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate({ isoString }: { isoString: string }): string {
  const day = isoString.substring(8, 10);
  const month = isoString.substring(5, 7);
  const year = isoString.substring(0, 4);
  return `${day}/${month}/${year}`;
}

function formatWeekEndingLong({ isoString }: { isoString: string }): string {
  const year = isoString.substring(0, 4);
  const monthIndex = parseInt(isoString.substring(5, 7), 10) - 1;
  const day = String(parseInt(isoString.substring(8, 10), 10));
  const monthName = MONTH_NAMES[monthIndex] ?? "";
  return `${day} ${monthName} ${year}`;
}

function formatHours({ value }: { value: number }): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

function formatDisplayTime({
  isoString,
}: {
  isoString: string | null;
}): string {
  if (!isoString) return "—";
  if (isoString.length >= 16 && isoString.includes("T")) {
    return isoString.substring(11, 16);
  }
  return isoString;
}

function capitaliseFirst({ value }: { value: string }): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function deriveLineHours({
  chargedHours,
  driverCharge,
}: {
  chargedHours: number | null;
  driverCharge: number | null;
}): {
  hours: number | null;
  travelling: number;
} {
  if (chargedHours == null && driverCharge == null) {
    return { hours: null, travelling: 0 };
  }

  if (chargedHours == null) {
    return { hours: driverCharge, travelling: 0 };
  }

  if (driverCharge == null) {
    return { hours: chargedHours, travelling: 0 };
  }

  if (driverCharge < chargedHours) {
    return { hours: driverCharge, travelling: 0 };
  }

  const travelling = driverCharge - chargedHours;
  return { hours: chargedHours, travelling: travelling > 0 ? travelling : 0 };
}

export function JobsReportPdfTemplate({
  report,
  settings,
}: JobsReportPdfTemplateProps) {
  const lines = Array.isArray(report.lines) ? report.lines : [];

  const displayLines = lines.map((line) => ({
    line,
    derived: deriveLineHours({
      chargedHours: line.chargedHours,
      driverCharge: line.driverCharge,
    }),
  }));

  const totalHours = displayLines.reduce(
    (sum, { derived }) => sum + (derived.hours ?? 0),
    0,
  );

  const totalTravel = displayLines.reduce((sum, { derived }) => {
    return sum + derived.travelling;
  }, 0);

  const grandTotal = totalHours + totalTravel;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ── Fixed Header ─────────────────────────────────────────────────── */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {settings.companyLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={settings.companyLogo} style={styles.logo} />
            ) : (
              settings.companyName && (
                <Text style={styles.companyName}>{settings.companyName}</Text>
              )
            )}
            {settings.companyAbn && (
              <Text style={styles.companyDetails}>
                ABN: {settings.companyAbn}
              </Text>
            )}
            {settings.companyAddress && (
              <Text style={styles.companyDetails}>
                {settings.companyAddress}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {settings.companyPhone && (
              <Text style={styles.companyDetails}>
                Ph: {settings.companyPhone}
              </Text>
            )}
            {settings.companyEmail && (
              <Text style={styles.companyDetails}>{settings.companyEmail}</Text>
            )}
          </View>
        </View>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <Text style={styles.title}>Jobs Report</Text>

        {/* ── Report Details ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.label}>Report Number</Text>
              <Text style={styles.value}>{report.reportNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.label}>Driver</Text>
              <Text style={styles.value}>{report.driverName}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.label}>Week Ending</Text>
              <Text style={styles.value}>
                {formatWeekEndingLong({ isoString: report.weekEnding })}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, styles.statusPill]}>
                {capitaliseFirst({ value: report.status })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Jobs Table ───────────────────────────────────────────────────── */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>
            Jobs ({lines.length} job{lines.length !== 1 ? "s" : ""})
          </Text>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colDate, styles.tableHeaderText]}>Date</Text>
            <Text style={[styles.colCustomer, styles.tableHeaderText]}>
              Customer
            </Text>
            <Text style={[styles.colVehicle, styles.tableHeaderText]}>
              Vehicle Type
            </Text>

            <Text style={[styles.colStart, styles.tableHeaderText]}>Start</Text>
            <Text style={[styles.colFinish, styles.tableHeaderText]}>
              Finish
            </Text>
            <Text style={[styles.colHours, styles.tableHeaderText]}>Hours</Text>
            <Text style={[styles.colTravel, styles.tableHeaderText]}>
              Travelling
            </Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>Total</Text>
          </View>

          {/* Table rows */}
          {lines.length === 0 ? (
            <View style={styles.emptyState}>
              <Text>No jobs found for this report.</Text>
            </View>
          ) : (
            displayLines.map(({ line, derived }, index) => {
              const hasTravel = derived.travelling > 0.001;

              return (
                <View
                  key={line.id}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                >
                  <Text style={[styles.colDate, styles.cellText]}>
                    {formatDate({ isoString: line.jobDate })}
                  </Text>
                  <Text style={[styles.colCustomer, styles.cellText]}>
                    {line.customer}
                  </Text>
                  <Text style={[styles.colVehicle, styles.cellText]}>
                    {line.truckType}
                  </Text>

                  <Text style={[styles.colStart, styles.cellText]}>
                    {formatDisplayTime({ isoString: line.startTime })}
                  </Text>
                  <Text style={[styles.colFinish, styles.cellText]}>
                    {formatDisplayTime({ isoString: line.finishTime })}
                  </Text>
                  <Text style={[styles.colHours, styles.cellText]}>
                    {derived.hours != null
                      ? formatHours({ value: derived.hours })
                      : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.colTravel,
                      hasTravel ? styles.cellTextTravel : styles.cellTextMuted,
                    ]}
                  >
                    {hasTravel
                      ? `+${formatHours({ value: derived.travelling })}`
                      : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.colTotal,
                      (derived.hours ?? 0) + derived.travelling > 0
                        ? styles.cellTextTotal
                        : styles.cellTextMuted,
                    ]}
                  >
                    {(derived.hours ?? 0) + derived.travelling > 0
                      ? formatHours({
                          value: (derived.hours ?? 0) + derived.travelling,
                        })
                      : "—"}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Totals ───────────────────────────────────────────────────────── */}
        {lines.length > 0 && (
          <View style={styles.totalsSection}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Total Hours</Text>
              <Text style={styles.totalValue}>
                {formatHours({ value: totalHours })}
              </Text>
            </View>
            {totalTravel > 0.001 && (
              <View style={styles.totalBlock}>
                <Text style={styles.totalLabel}>Total Travelling</Text>
                <Text style={styles.totalValueTravel}>
                  +{formatHours({ value: totalTravel })}
                </Text>
              </View>
            )}
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValueGrand}>
                {formatHours({ value: grandTotal })}
              </Text>
            </View>
          </View>
        )}

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        {report.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{report.notes}</Text>
          </View>
        ) : null}

        {/* ── Fixed Footer ─────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{settings.companyName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
