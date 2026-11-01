/**
 * Dollars per toll crossing. One rate per road is used for customer invoices,
 * RCTIs and the jobs stats.
 */
export interface TollRates {
  eastlink: number;
  citylink: number;
}

/** Used until company settings are saved. Matches the column defaults. */
export const DEFAULT_TOLL_RATES: TollRates = {
  eastlink: 18.5,
  citylink: 31,
};

export const TOLL_RATE_MAX = 1000;
