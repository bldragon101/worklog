import { XeroMappingPage } from "@/components/xero/xero-mapping-page";
import { parseXeroMappingTab } from "@/components/xero/xero-options";

/** Xero item and contact mappings; `?tab=customers` opens a given tab */
export default async function XeroSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  const initialTab =
    parseXeroMappingTab({ value: typeof tab === "string" ? tab : null }) ?? "trucks";

  return <XeroMappingPage key={initialTab} initialTab={initialTab} />;
}
