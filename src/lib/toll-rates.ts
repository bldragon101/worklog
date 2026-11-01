import { prisma } from "@/lib/prisma";
import { DEFAULT_TOLL_RATES, type TollRates } from "@/lib/utils/toll-rates";

/**
 * The configured toll rates, or the defaults when company settings have not
 * been saved.
 */
export async function getTollRates(): Promise<TollRates> {
  const settings = await prisma.companySettings.findFirst({
    select: { tollEastlinkRate: true, tollCitylinkRate: true },
  });

  if (!settings) return DEFAULT_TOLL_RATES;

  return {
    eastlink: Number(settings.tollEastlinkRate),
    citylink: Number(settings.tollCitylinkRate),
  };
}
