/**
 * @vitest-environment node
 */
import {
  canManageDriverBankDetails,
  omitDriverBankDetails,
  serialiseDriver,
} from "@/lib/driver-serialisation";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const decimal = (value: number) => ({ toNumber: () => value });

const driver = {
  id: 1,
  driver: "ALEX",
  tray: decimal(45.5),
  crane: "60.25",
  semi: null,
  semiCrane: 0,
  fuelLevy: 12,
  isArchived: null,
  abn: "12345678901",
  bankAccountName: "Alex Contracting",
  bankAccountNumber: "12345678",
  bankBsb: "123456",
};

describe("canManageDriverBankDetails", () => {
  it("allows admins only", () => {
    expect(canManageDriverBankDetails({ userRole: "admin" })).toBe(true);
    expect(canManageDriverBankDetails({ userRole: "manager" })).toBe(false);
    expect(canManageDriverBankDetails({ userRole: "user" })).toBe(false);
    expect(canManageDriverBankDetails({ userRole: "viewer" })).toBe(false);
    expect(canManageDriverBankDetails({ userRole: null })).toBe(false);
  });
});

describe("omitDriverBankDetails", () => {
  it("removes only the bank account fields", () => {
    const result = omitDriverBankDetails({ driver });

    expect(result).not.toHaveProperty("bankAccountName");
    expect(result).not.toHaveProperty("bankAccountNumber");
    expect(result).not.toHaveProperty("bankBsb");
    expect(result).toMatchObject({ id: 1, abn: "12345678901" });
  });
});

describe("serialiseDriver", () => {
  it("converts Decimal and string rates to numbers", () => {
    const result = serialiseDriver({ driver, includeBankDetails: true });

    expect(result).toMatchObject({
      tray: 45.5,
      crane: 60.25,
      semi: null,
      semiCrane: null,
      fuelLevy: 12,
      isArchived: false,
    });
  });

  it("keeps bank details when the caller may see them", () => {
    const result = serialiseDriver({ driver, includeBankDetails: true });

    expect(result).toMatchObject({
      bankAccountName: "Alex Contracting",
      bankAccountNumber: "12345678",
      bankBsb: "123456",
    });
  });

  it("leaves out bank details otherwise", () => {
    const json = JSON.parse(
      JSON.stringify(serialiseDriver({ driver, includeBankDetails: false })),
    );

    expect(json).not.toHaveProperty("bankAccountName");
    expect(json).not.toHaveProperty("bankAccountNumber");
    expect(json).not.toHaveProperty("bankBsb");
    expect(json).toMatchObject({ driver: "ALEX", tray: 45.5 });
  });
});
