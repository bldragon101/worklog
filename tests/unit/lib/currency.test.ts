import { formatCurrency } from "@/lib/utils/currency";

describe("formatCurrency", () => {
  it.each([
    { amount: 70, expected: "$70.00" },
    { amount: -70, expected: "-$70.00" },
    { amount: -3.5, expected: "-$3.50" },
    { amount: 0, expected: "$0.00" },
    { amount: -0.001, expected: "$0.00" },
    { amount: "-38.5", expected: "-$38.50" },
    { amount: { toNumber: () => -35 }, expected: "-$35.00" },
  ])("formats $amount as $expected", ({ amount, expected }) => {
    expect(formatCurrency({ amount })).toBe(expected);
  });
});
