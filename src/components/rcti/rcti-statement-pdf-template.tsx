import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency as formatCurrencyAmount } from "@/lib/utils/currency";
import {
  formatMelbourneDate,
  formatStatementDate,
  formatStatementPeriod,
  type RctiStatement,
} from "@/lib/rcti-statement";
import {
  PdfCompanyFooter,
  PdfCompanyHeader,
  RctiPdfPage,
  type CompanySettingsData,
  type RctiData,
} from "@/components/rcti/rcti-pdf-template";

export interface StatementDriverDetails {
  driverName: string;
  businessName: string | null;
  driverAbn: string | null;
  driverAddress: string | null;
}

interface RctiStatementPdfProps {
  statement: RctiStatement;
  driver: StatementDriverDetails;
  settings: CompanySettingsData;
  /** ISO date the statement is issued on */
  statementDate: string;
}

interface RctiStatementPdfDocumentProps extends RctiStatementPdfProps {
  /** Whether the statement summary opens the document */
  includeStatement: boolean;
  /** Full RCTIs to append after the statement, one or more pages each */
  rctis: RctiData[];
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 50,
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 10,
    textAlign: "center",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  detailsBlock: {
    width: "48%",
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
    width: 80,
    fontSize: 7,
    color: "#4b5563",
    fontWeight: "bold",
  },
  value: {
    flex: 1,
    fontSize: 7,
    color: "#1f2937",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryBox: {
    width: "32%",
    padding: 6,
    borderRadius: 2,
    border: "1pt solid #e5e7eb",
    backgroundColor: "#f9fafb",
  },
  summaryBoxHighlight: {
    backgroundColor: "#dbeafe",
    border: "1pt solid #bfdbfe",
  },
  summaryLabel: {
    fontSize: 7,
    color: "#4b5563",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summaryValueHighlight: {
    color: "#1e40af",
  },
  summaryNote: {
    fontSize: 6,
    color: "#6b7280",
    marginTop: 1,
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
  tableTotalRow: {
    flexDirection: "row",
    padding: 3,
    fontSize: 7,
    fontWeight: "bold",
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  colInvoice: { width: "16%" },
  colWeek: { width: "11%" },
  colStatus: { width: "9%" },
  colPaid: { width: "10%" },
  colAmount: { width: "9%", textAlign: "right" },
  colAdjust: { width: "11%", textAlign: "right" },
  colPayable: { width: "16%", textAlign: "right" },
  note: {
    marginTop: 6,
    fontSize: 6,
    color: "#6b7280",
  },
});

const formatCurrency = ({ amount }: { amount: number }): string =>
  formatCurrencyAmount({ amount });

const formatAdjustment = ({ amount }: { amount: number }): string =>
  amount > 0 ? `+${formatCurrency({ amount })}` : formatCurrency({ amount });

const formatStatus = ({ status }: { status: string }): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

/** Statement summarising a driver's selected RCTIs, as one or more pages */
export const RctiStatementPdfPage = ({
  statement,
  driver,
  settings,
  statementDate,
}: RctiStatementPdfProps) => {
  const { rows, totals } = statement;
  const period = formatStatementPeriod({
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
  });
  const hasAdjustments = rows.some((row) => row.adjustments !== 0);

  return (
    <Page size="A4" style={styles.page}>
      <PdfCompanyHeader settings={settings} />

      <Text style={styles.title}>RCTI STATEMENT</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detailsBlock}>
          <Text style={styles.sectionTitle}>Payee</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{driver.driverName}</Text>
          </View>
          {driver.businessName && (
            <View style={styles.row}>
              <Text style={styles.label}>Business:</Text>
              <Text style={styles.value}>{driver.businessName}</Text>
            </View>
          )}
          {driver.driverAbn && (
            <View style={styles.row}>
              <Text style={styles.label}>ABN:</Text>
              <Text style={styles.value}>{driver.driverAbn}</Text>
            </View>
          )}
          {driver.driverAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{driver.driverAddress}</Text>
            </View>
          )}
        </View>
        <View style={styles.detailsBlock}>
          <Text style={styles.sectionTitle}>Statement Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Statement Date:</Text>
            <Text style={styles.value}>
              {formatStatementDate({ isoString: statementDate })}
            </Text>
          </View>
          {period && (
            <View style={styles.row}>
              <Text style={styles.label}>Period:</Text>
              <Text style={styles.value}>{period}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>RCTIs:</Text>
            <Text style={styles.value}>{totals.count}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Payable</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency({ amount: totals.amountPayable })}
          </Text>
          <Text style={styles.summaryNote}>
            {totals.count} RCTI{totals.count === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Paid</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency({ amount: totals.paid })}
          </Text>
          <Text style={styles.summaryNote}>
            {totals.paidCount} RCTI{totals.paidCount === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={[styles.summaryBox, styles.summaryBoxHighlight]}>
          <Text style={styles.summaryLabel}>Balance Outstanding</Text>
          <Text style={[styles.summaryValue, styles.summaryValueHighlight]}>
            {formatCurrency({ amount: totals.outstanding })}
          </Text>
          <Text style={styles.summaryNote}>
            {totals.outstandingCount} RCTI
            {totals.outstandingCount === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.colInvoice}>Invoice No.</Text>
        <Text style={styles.colWeek}>Week Ending</Text>
        <Text style={styles.colStatus}>Status</Text>
        <Text style={styles.colPaid}>Paid On</Text>
        <Text style={styles.colAmount}>Ex GST</Text>
        <Text style={styles.colAmount}>GST</Text>
        <Text style={styles.colAmount}>Inc GST</Text>
        <Text style={styles.colAdjust}>Adjustments</Text>
        <Text style={styles.colPayable}>Amount Payable</Text>
      </View>
      {rows.map((row, index) => (
        <View
          key={row.id}
          style={
            index % 2 === 1
              ? [styles.tableRow, styles.tableRowAlt]
              : styles.tableRow
          }
          wrap={false}
        >
          <Text style={styles.colInvoice}>{row.invoiceNumber}</Text>
          <Text style={styles.colWeek}>
            {formatStatementDate({ isoString: row.weekEnding })}
          </Text>
          <Text style={styles.colStatus}>
            {formatStatus({ status: row.status })}
          </Text>
          <Text style={styles.colPaid}>
            {row.status === "paid" && row.paidAt
              ? formatMelbourneDate({ isoString: row.paidAt })
              : "-"}
          </Text>
          <Text style={styles.colAmount}>
            {formatCurrency({ amount: row.subtotal })}
          </Text>
          <Text style={styles.colAmount}>
            {formatCurrency({ amount: row.gst })}
          </Text>
          <Text style={styles.colAmount}>
            {formatCurrency({ amount: row.grossTotal })}
          </Text>
          <Text style={styles.colAdjust}>
            {row.adjustments === 0
              ? "-"
              : formatAdjustment({ amount: row.adjustments })}
          </Text>
          <Text style={styles.colPayable}>
            {formatCurrency({ amount: row.amountPayable })}
          </Text>
        </View>
      ))}
      <View style={styles.tableTotalRow} wrap={false}>
        <Text style={styles.colInvoice}>Total</Text>
        <Text style={styles.colWeek} />
        <Text style={styles.colStatus} />
        <Text style={styles.colPaid} />
        <Text style={styles.colAmount}>
          {formatCurrency({ amount: totals.subtotal })}
        </Text>
        <Text style={styles.colAmount}>
          {formatCurrency({ amount: totals.gst })}
        </Text>
        <Text style={styles.colAmount}>
          {formatCurrency({ amount: totals.grossTotal })}
        </Text>
        <Text style={styles.colAdjust}>
          {totals.adjustments === 0
            ? "-"
            : formatAdjustment({ amount: totals.adjustments })}
        </Text>
        <Text style={styles.colPayable}>
          {formatCurrency({ amount: totals.amountPayable })}
        </Text>
      </View>

      {hasAdjustments && (
        <Text style={styles.note}>
          Adjustments are the deductions (-) and reimbursements (+) applied to
          each RCTI. Amount Payable is the Inc GST total after adjustments.
        </Text>
      )}

      <PdfCompanyFooter settings={settings} />
    </Page>
  );
};

/** Statement summary and/or each full RCTI it lists, as one document */
export const RctiStatementPdfDocument = ({
  statement,
  driver,
  settings,
  statementDate,
  includeStatement,
  rctis,
}: RctiStatementPdfDocumentProps) => (
  <Document>
    {includeStatement && (
      <RctiStatementPdfPage
        statement={statement}
        driver={driver}
        settings={settings}
        statementDate={statementDate}
      />
    )}
    {rctis.map((rcti) => (
      <RctiPdfPage key={rcti.id} rcti={rcti} settings={settings} />
    ))}
  </Document>
);
