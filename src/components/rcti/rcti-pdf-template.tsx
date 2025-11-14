import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

interface RctiSettings {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
}

interface RctiLine {
  id: number;
  jobDate: Date | string;
  customer: string;
  truckType: string;
  description: string | null;
  chargedHours: number;
  ratePerHour: number;
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
}

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
  subtotal: number;
  gst: number;
  total: number;
  status: string;
  notes: string | null;
  lines: RctiLine[];
}

interface RctiPdfTemplateProps {
  rcti: RctiData;
  settings: RctiSettings;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 100,
    paddingBottom: 80,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    position: "absolute",
    top: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
    marginBottom: 5,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 3,
  },
  companyDetails: {
    fontSize: 8,
    color: "#4b5563",
    marginBottom: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 20,
    marginTop: 10,
    textAlign: "center",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 150,
    fontSize: 9,
    color: "#4b5563",
    fontWeight: "bold",
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: "#1f2937",
  },
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 6,
    fontWeight: "bold",
    fontSize: 8,
    borderBottom: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
    fontSize: 8,
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
    marginTop: 15,
    marginLeft: "60%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: 10,
    color: "#4b5563",
  },
  totalValue: {
    fontSize: 10,
    color: "#1f2937",
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#dbeafe",
    padding: 8,
    marginTop: 4,
    borderRadius: 3,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#6b7280",
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: "right",
  },
  notes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fef3c7",
    borderRadius: 3,
    border: 1,
    borderColor: "#fbbf24",
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: "#78350f",
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

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

const formatBsb = (bsb: string | null): string => {
  if (!bsb) return "";
  const cleaned = bsb.replace(/\D/g, "");
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return bsb;
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

        {/* Bank Details */}
        {(rcti.bankAccountName || rcti.bankBsb || rcti.bankAccountNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            {rcti.bankAccountName && (
              <View style={styles.row}>
                <Text style={styles.label}>Account Name:</Text>
                <Text style={styles.value}>{rcti.bankAccountName}</Text>
              </View>
            )}
            {rcti.bankBsb && (
              <View style={styles.row}>
                <Text style={styles.label}>BSB:</Text>
                <Text style={styles.value}>{formatBsb(rcti.bankBsb)}</Text>
              </View>
            )}
            {rcti.bankAccountNumber && (
              <View style={styles.row}>
                <Text style={styles.label}>Account Number:</Text>
                <Text style={styles.value}>{rcti.bankAccountNumber}</Text>
              </View>
            )}
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
          {rcti.lines.map((line, index) => (
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
              <Text style={styles.col5}>{line.chargedHours.toFixed(2)}</Text>
              <Text style={styles.col6}>
                {formatCurrency(line.ratePerHour)}
              </Text>
              <Text style={styles.col7}>
                {formatCurrency(line.amountExGst)}
              </Text>
            </View>
          ))}
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
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total (Inc GST):</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(rcti.total)}
            </Text>
          </View>
        </View>

        {/* GST Status */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>GST Status:</Text>
            <Text style={styles.value}>
              {rcti.gstStatus === "registered"
                ? "Registered for GST"
                : "Not Registered for GST"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>GST Mode:</Text>
            <Text style={styles.value}>
              {rcti.gstMode.charAt(0).toUpperCase() + rcti.gstMode.slice(1)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {rcti.notes && (
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
