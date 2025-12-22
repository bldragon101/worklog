import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { Decimal } from "@prisma/client/runtime/client";
import { toNumber } from "@/lib/utils/rcti-calculations";

// Company settings (PDF template-specific, not part of core RCTI model)
interface RctiSettings {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
}

// PDF template view of RctiLine - excludes database metadata
interface RctiLine {
  id: number;
  jobDate: Date | string;
  customer: string;
  truckType: string;
  description: string | null;
  chargedHours: number | Decimal;
  ratePerHour: number | Decimal;
  amountExGst: number | Decimal;
  gstAmount: number | Decimal;
  amountIncGst: number | Decimal;
}

// PDF template view of Rcti - excludes database metadata and driver relation
interface RctiData {
  id: number;
  invoiceNumber: string;
  driverName: string;
  businessName: string | null;
  driverAddress: string | null;
  driverAbn: string | null;
  weekEnding: Date | string;
  gstStatus: string;
  gstMode: string;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  subtotal: number | Decimal;
  gst: number | Decimal;
  total: number | Decimal;
  status: string;
  notes: string | null;
  lines: RctiLine[];
  deductionApplications?: Array<{
    id: number;
    deductionId: number;
    amount: number | Decimal;
    appliedAt: Date | string;
    deduction: {
      id: number;
      type: string;
      description: string;
      frequency: string;
      totalAmount: number;
      amountPaid: number;
      amountRemaining: number;
    };
  }>;
}

interface RctiPdfTemplateProps {
  rcti: RctiData;
  settings: RctiSettings;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 50,
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  header: {
    position: "absolute",
    top: 15,
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
    width: 80,
    height: 25,
    objectFit: "contain",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 1,
  },
  companyDetails: {
    fontSize: 7,
    color: "#4b5563",
    marginBottom: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 8,
    marginTop: 5,
    textAlign: "center",
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
    borderBottom: "1pt solid #e5e7eb",
    paddingBottom: 2,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: 100,
    fontSize: 7,
    color: "#4b5563",
    fontWeight: "bold",
  },
  value: {
    flex: 1,
    fontSize: 7,
    color: "#1f2937",
  },
  table: {
    marginTop: 5,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 3,
    fontWeight: "bold",
    fontSize: 7,
    borderBottom: "1pt solid #d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    padding: 3,
    borderBottom: "1pt solid #e5e7eb",
    fontSize: 7,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  col1: { width: "12%" },
  col2: { width: "18%" },
  col3: { width: "15%" },
  col4: { width: "20%" },
  col5: { width: "10%", textAlign: "right" },
  col6: { width: "10%", textAlign: "right" },
  col7: { width: "15%", textAlign: "right" },
  totalsSection: {
    marginTop: 8,
    marginLeft: "60%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontSize: 8,
    color: "#4b5563",
  },
  totalValue: {
    fontSize: 8,
    color: "#1f2937",
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#dbeafe",
    padding: 4,
    marginTop: 2,
    borderRadius: 2,
  },
  grandTotalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e40af",
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e40af",
  },
  deductionsSection: {
    marginTop: 6,
    padding: 4,
    backgroundColor: "#fef2f2",
    borderRadius: 2,
    border: "1pt solid #fecaca",
  },
  deductionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  deductionLabel: {
    fontSize: 7,
    color: "#991b1b",
  },
  deductionValue: {
    fontSize: 7,
    color: "#991b1b",
    fontWeight: "bold",
  },
  reimbursementsSection: {
    marginTop: 4,
    padding: 4,
    backgroundColor: "#f0fdf4",
    borderRadius: 2,
    border: "1pt solid #bbf7d0",
  },
  reimbursementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  reimbursementLabel: {
    fontSize: 7,
    color: "#166534",
  },
  reimbursementValue: {
    fontSize: 7,
    color: "#166534",
    fontWeight: "bold",
  },
  adjustedTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    padding: 4,
    backgroundColor: "#dbeafe",
    borderRadius: 2,
  },
  adjustedTotalLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e40af",
  },
  adjustedTotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e40af",
  },
  footer: {
    position: "absolute",
    bottom: 15,
    left: 20,
    right: 20,
    borderTop: "1pt solid #e5e7eb",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: "right",
  },
  notes: {
    marginTop: 6,
    padding: 4,
    backgroundColor: "#fef3c7",
    borderRadius: 2,
    border: "1pt solid #fbbf24",
  },
  notesTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 6,
    color: "#92400e",
    lineHeight: 1.3,
  },
  emptyState: {
    padding: 20,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 9,
    fontStyle: "italic",
  },
});

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatCurrency = (amount: number | Decimal): string => {
  const numAmount = typeof amount === "number" ? amount : toNumber(amount);
  return `$${numAmount.toFixed(2)}`;
};

export const RctiPdfTemplate = ({ rcti, settings }: RctiPdfTemplateProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {settings.companyLogo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={settings.companyLogo} style={styles.logo} />
            )}
            {!settings.companyLogo && settings.companyName && (
              <Text style={styles.companyName}>{settings.companyName}</Text>
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

        {/* Title */}
        <Text style={styles.title}>RECIPIENT CREATED TAX INVOICE</Text>

        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Number:</Text>
            <Text style={styles.value}>{rcti.invoiceNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Week Ending:</Text>
            <Text style={styles.value}>{formatDate(rcti.weekEnding)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>
              {rcti.status.charAt(0).toUpperCase() + rcti.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Driver Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver/Contractor Details</Text>
          {rcti.businessName && (
            <View style={styles.row}>
              <Text style={styles.label}>Business/Trading Name:</Text>
              <Text style={styles.value}>{rcti.businessName}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Driver Name:</Text>
            <Text style={styles.value}>{rcti.driverName}</Text>
          </View>
          {rcti.driverAbn && (
            <View style={styles.row}>
              <Text style={styles.label}>ABN:</Text>
              <Text style={styles.value}>{rcti.driverAbn}</Text>
            </View>
          )}
          {rcti.driverAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{rcti.driverAddress}</Text>
            </View>
          )}
        </View>

        {/* Bank Details - Compact */}
        {(rcti.bankAccountName || rcti.bankBsb || rcti.bankAccountNumber) && (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 7, fontWeight: "bold", marginBottom: 2 }}>
              Payment Details
            </Text>
            <Text style={{ fontSize: 7, color: "#1f2937" }}>
              {rcti.bankAccountName && `${rcti.bankAccountName} | `}
              {rcti.bankBsb && `BSB: ${rcti.bankBsb} | `}
              {rcti.bankAccountNumber && `Acc: ${rcti.bankAccountNumber}`}
            </Text>
          </View>
        )}

        {/* Line Items Table */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>Line Items</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Date</Text>
            <Text style={styles.col2}>Customer</Text>
            <Text style={styles.col3}>Truck Type</Text>
            <Text style={styles.col4}>Description</Text>
            <Text style={styles.col5}>Hours</Text>
            <Text style={styles.col6}>Rate</Text>
            <Text style={styles.col7}>Amount (Ex GST)</Text>
          </View>

          {/* Table Rows */}
          {(() => {
            // Validate lines array to prevent crashes on malformed data
            const lines = Array.isArray(rcti.lines) ? rcti.lines : [];

            if (lines.length === 0) {
              return (
                <View style={styles.emptyState}>
                  <Text>No line items found for this RCTI.</Text>
                </View>
              );
            }

            return lines.map((line, index) => (
              <View
                key={line.id}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text style={styles.col1}>{formatDate(line.jobDate)}</Text>
                <Text style={styles.col2}>{line.customer}</Text>
                <Text style={styles.col3}>{line.truckType}</Text>
                <Text style={styles.col4}>{line.description || "-"}</Text>
                <Text style={styles.col5}>
                  {toNumber(line.chargedHours).toFixed(2)}
                </Text>
                <Text style={styles.col6}>
                  {formatCurrency(line.ratePerHour)}
                </Text>
                <Text style={styles.col7}>
                  {formatCurrency(line.amountExGst)}
                </Text>
              </View>
            ));
          })()}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (Ex GST):</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(rcti.subtotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              GST ({rcti.gstStatus === "registered" ? "10%" : "0%"}):
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(rcti.gst)}</Text>
          </View>
          {(() => {
            // Calculate original total before deductions
            const hasDeductions =
              rcti.deductionApplications &&
              rcti.deductionApplications.length > 0;

            if (!hasDeductions) {
              return (
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Total (Inc GST):</Text>
                  <Text style={styles.grandTotalValue}>
                    {formatCurrency(rcti.total)}
                  </Text>
                </View>
              );
            }

            // If deductions exist, rcti.total is already adjusted
            // So we need to calculate the original total
            const totalDeductions = rcti
              .deductionApplications!.filter(
                (app) => app.deduction.type === "deduction",
              )
              .reduce((sum, app) => sum + toNumber(app.amount), 0);
            const totalReimbursements = rcti
              .deductionApplications!.filter(
                (app) => app.deduction.type === "reimbursement",
              )
              .reduce((sum, app) => sum + toNumber(app.amount), 0);
            const netAdjustment = totalReimbursements - totalDeductions;
            const originalTotal = toNumber(rcti.total) - netAdjustment;

            return (
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Total (Inc GST):</Text>
                <Text style={styles.grandTotalValue}>
                  {formatCurrency(originalTotal)}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Deductions & Reimbursements */}
        {rcti.deductionApplications &&
          rcti.deductionApplications.length > 0 &&
          (() => {
            const deductions = rcti.deductionApplications.filter(
              (app) => app.deduction.type === "deduction",
            );
            const reimbursements = rcti.deductionApplications.filter(
              (app) => app.deduction.type === "reimbursement",
            );
            const totalDeductions = deductions.reduce(
              (sum, app) => sum + toNumber(app.amount),
              0,
            );
            const totalReimbursements = reimbursements.reduce(
              (sum, app) => sum + toNumber(app.amount),
              0,
            );
            // rcti.total is already adjusted after finalisation
            const adjustedTotal = toNumber(rcti.total);
            const isDraft = rcti.status === "draft";

            // Calculate total remaining across all deductions
            return (
              <>
                {deductions.length > 0 && (
                  <View style={styles.deductionsSection}>
                    <Text
                      style={{
                        fontSize: 7,
                        fontWeight: "bold",
                        color: "#991b1b",
                        marginBottom: 2,
                      }}
                    >
                      {isDraft ? "Pending Deductions:" : "Deductions:"}
                    </Text>
                    {deductions.map((app) => (
                      <View key={app.id}>
                        <View style={styles.deductionRow}>
                          <Text style={styles.deductionLabel}>
                            {app.deduction.description}
                          </Text>
                          <Text style={styles.deductionValue}>
                            -{formatCurrency(app.amount)}
                          </Text>
                        </View>
                        {(() => {
                          // For finalized RCTIs, amountRemaining is already updated
                          // For draft RCTIs, we need to subtract the pending amount
                          const remainingAfterThisPayment = isDraft
                            ? app.deduction.amountRemaining -
                              toNumber(app.amount)
                            : app.deduction.amountRemaining;

                          return remainingAfterThisPayment > 0 ? (
                            <Text
                              style={{
                                fontSize: 6,
                                color: "#991b1b",
                                marginLeft: 4,
                                marginBottom: 2,
                              }}
                            >
                              Remaining:{" "}
                              {formatCurrency(remainingAfterThisPayment)}
                            </Text>
                          ) : null;
                        })()}
                      </View>
                    ))}
                    <View
                      style={[
                        styles.deductionRow,
                        {
                          marginTop: 2,
                          paddingTop: 2,
                          borderTop: "1pt solid #fca5a5",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.deductionLabel, { fontWeight: "bold" }]}
                      >
                        Total Deductions:
                      </Text>
                      <Text style={styles.deductionValue}>
                        -{formatCurrency(totalDeductions)}
                      </Text>
                    </View>
                  </View>
                )}

                {reimbursements.length > 0 && (
                  <View style={styles.reimbursementsSection}>
                    <Text
                      style={{
                        fontSize: 7,
                        fontWeight: "bold",
                        color: "#166534",
                        marginBottom: 2,
                      }}
                    >
                      {isDraft ? "Pending Reimbursements:" : "Reimbursements:"}
                    </Text>
                    {reimbursements.map((app) => (
                      <View key={app.id}>
                        <View style={styles.reimbursementRow}>
                          <Text style={styles.reimbursementLabel}>
                            {app.deduction.description}
                          </Text>
                          <Text style={styles.reimbursementValue}>
                            +{formatCurrency(app.amount)}
                          </Text>
                        </View>
                        {(() => {
                          // For finalized RCTIs, amountRemaining is already updated
                          // For draft RCTIs, we need to subtract the pending amount
                          const remainingAfterThisPayment = isDraft
                            ? app.deduction.amountRemaining -
                              toNumber(app.amount)
                            : app.deduction.amountRemaining;

                          return remainingAfterThisPayment > 0 ? (
                            <Text
                              style={{
                                fontSize: 6,
                                color: "#166534",
                                marginLeft: 4,
                                marginBottom: 2,
                              }}
                            >
                              Remaining:{" "}
                              {formatCurrency(remainingAfterThisPayment)}
                            </Text>
                          ) : null;
                        })()}
                      </View>
                    ))}
                    <View
                      style={[
                        styles.reimbursementRow,
                        {
                          marginTop: 2,
                          paddingTop: 2,
                          borderTop: "1pt solid #86efac",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reimbursementLabel,
                          { fontWeight: "bold" },
                        ]}
                      >
                        Total Reimbursements:
                      </Text>
                      <Text style={styles.reimbursementValue}>
                        +{formatCurrency(totalReimbursements)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.adjustedTotalRow}>
                  <Text style={styles.adjustedTotalLabel}>
                    {isDraft ? "Estimated Amount Payable:" : "Amount Payable:"}
                  </Text>
                  <Text style={styles.adjustedTotalValue}>
                    {formatCurrency(adjustedTotal)}
                  </Text>
                </View>

                {isDraft && (
                  <Text
                    style={{
                      fontSize: 6,
                      color: "#6b7280",
                      marginTop: 2,
                      textAlign: "center",
                    }}
                  >
                    Draft - Deductions applied on finalisation
                  </Text>
                )}
              </>
            );
          })()}

        {/* GST Status - Only if registered */}
        {rcti.gstStatus === "registered" && (
          <View style={styles.row}>
            <Text style={styles.label}>GST:</Text>
            <Text style={styles.value}>Registered</Text>
          </View>
        )}

        {/* Notes - Only if present */}
        {rcti.notes && rcti.notes.trim() && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text style={styles.notesText}>{rcti.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text>{settings.companyName}</Text>
            {settings.companyAbn && <Text>ABN: {settings.companyAbn}</Text>}
          </View>
          <View style={styles.footerRight}>
            <Text>
              Generated: {new Date().toLocaleDateString("en-AU")} at{" "}
              {new Date().toLocaleTimeString("en-AU")}
            </Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
};
