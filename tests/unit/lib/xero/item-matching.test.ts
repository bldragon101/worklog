import {
  getFuelLevyItemCode,
  getItemTruckClass,
  getRegistrationTokens,
  isSubcontractorItem,
  scoreNameMatch,
  suggestCompanyItemCode,
  suggestContactId,
  suggestVehicleItemCode,
} from "@/lib/xero/item-matching";

/** A sample of the real Xero item list */
const items = [
  { code: "12TC - 01SUB", name: "VIKRAM" },
  { code: "12TC - 02", name: "BNT040 - DAF CRANE" },
  { code: "12TC - 07", name: "HINO BCJ996" },
  { code: "12TC - 09", name: "CTJ450" },
  { code: "12TC - 11SUB", name: "AKITA SUBCONTRACTOR" },
  { code: "12TC - 13SUB", name: "AMAR TRANSPORT" },
  { code: "12TC - 20SUB", name: "Mandeep Kumar" },
  { code: "12TC - 21SUB", name: "MANDEEP GREWAL" },
  { code: "14TT - 01SUB", name: "AKITA SUBCONTRACTOR" },
  { code: "14TT - 02", name: "XW25ZG - UD TRAY" },
  { code: "14TT - 10SUB", name: "AMAR TRANSPORT" },
  { code: "14TT - 15SUB", name: "KANWAR RIPAN BLUE HAWK" },
  { code: "PMCRA - 02", name: "BCJ998" },
  { code: "PMCRA - 02SUB", name: "EAGLE SEMI CRANE" },
  { code: "PRIME MOVER - 01SUB", name: "AKITA SUBCONTRACTOR" },
  { code: "PRIME MOVER - 02", name: "BWS900 - DAF PRIME MOVER" },
  { code: "PRIME MOVER - 04SUB", name: "SEMI KANWAR RIPAN  BLUEHAWK" },
  { code: "PRIMEMOVER - 08SUB", name: "AMAR TPT" },
  { code: "14TAUT - 01SUB", name: "ABI Trans Tautliner" },
  { code: "Break", name: "Break" },
];

describe("getItemTruckClass", () => {
  it.each([
    ["12TC - 02", "crane"],
    ["12TC - 11SUB", "crane"],
    ["12TCRA", "crane"],
    ["14TT - 01", "tray"],
    ["TRAY", "tray"],
    ["PRIME MOVER - 02", "semi"],
    ["PRIMEMOVER - 03", "semi"],
    ["PRIME - 11SUB", "semi"],
    ["PRIME MOVER 01", "semi"],
    ["PMCRA - 02SUB", "semiCrane"],
    ["14TAUT - 01SUB", null],
    ["TAUT", null],
    ["Fuel Levy 10%", null],
    ["SUBC", null],
  ])("classes %s as %s", (code, expected) => {
    expect(getItemTruckClass({ code })).toBe(expected);
  });
});

describe("isSubcontractorItem", () => {
  it.each([
    ["12TC - 11SUB", true],
    ["PRIMEMOVER - 08SUB", true],
    ["12TC - 02", false],
    ["SUBC", false],
  ])("%s is a subcontractor item: %s", (code, expected) => {
    expect(isSubcontractorItem({ code })).toBe(expected);
  });
});

describe("getRegistrationTokens", () => {
  it("finds registration-like words mixing letters and digits", () => {
    expect(getRegistrationTokens({ text: "12TC - 02 BNT040 - DAF CRANE" })).toEqual(["BNT040"]);
    expect(getRegistrationTokens({ text: "HINO BCJ996" })).toEqual(["BCJ996"]);
    expect(getRegistrationTokens({ text: "Fuel Levy 10%" })).toEqual([]);
  });
});

describe("suggestVehicleItemCode", () => {
  it("matches a company truck by the registration in the item name", () => {
    expect(suggestVehicleItemCode({ registration: "BNT 040", items })).toBe("12TC - 02");
    expect(suggestVehicleItemCode({ registration: "bcj996", items })).toBe("12TC - 07");
    expect(suggestVehicleItemCode({ registration: "CTJ450", items })).toBe("12TC - 09");
    expect(suggestVehicleItemCode({ registration: "BWS900", items })).toBe("PRIME MOVER - 02");
  });

  it("suggests nothing for an unknown truck", () => {
    expect(suggestVehicleItemCode({ registration: "ZZZ999", items })).toBeNull();
    expect(suggestVehicleItemCode({ registration: "", items })).toBeNull();
  });
});

describe("scoreNameMatch", () => {
  it("ignores company words such as Pty Ltd and Transport", () => {
    expect(scoreNameMatch({ a: "Akita Transport Pty Ltd", b: "AKITA SUBCONTRACTOR" })).toBe(1);
    expect(scoreNameMatch({ a: "Amar Transport", b: "AMAR TPT" })).toBe(1);
  });

  it("treats words run together as the same name", () => {
    expect(scoreNameMatch({ a: "Kanwar Ripan Blue Hawk", b: "SEMI KANWAR RIPAN  BLUEHAWK" })).toBe(1);
  });

  it("scores a shared first name alone as a weak match", () => {
    expect(scoreNameMatch({ a: "Mandeep Kumar", b: "MANDEEP GREWAL" })).toBe(0.5);
  });

  it("scores names with no significant words as no match", () => {
    expect(scoreNameMatch({ a: "Transport Pty Ltd", b: "AMAR TPT" })).toBe(0);
  });
});

describe("suggestCompanyItemCode", () => {
  it("picks the subcontractor item of the class matching the company name", () => {
    expect(
      suggestCompanyItemCode({ companyName: "Akita Transport Pty Ltd", truckClass: "crane", items }),
    ).toBe("12TC - 11SUB");
    expect(
      suggestCompanyItemCode({ companyName: "Akita Transport Pty Ltd", truckClass: "tray", items }),
    ).toBe("14TT - 01SUB");
    expect(
      suggestCompanyItemCode({ companyName: "Akita Transport Pty Ltd", truckClass: "semi", items }),
    ).toBe("PRIME MOVER - 01SUB");
    expect(
      suggestCompanyItemCode({ companyName: "Amar Transport", truckClass: "semi", items }),
    ).toBe("PRIMEMOVER - 08SUB");
  });

  it("suggests nothing when the company has no item of that class", () => {
    expect(
      suggestCompanyItemCode({ companyName: "Akita Transport", truckClass: "semiCrane", items }),
    ).toBeNull();
  });

  it("does not suggest on a shared first name alone", () => {
    expect(
      suggestCompanyItemCode({ companyName: "Mandeep Singh", truckClass: "crane", items }),
    ).toBeNull();
    expect(
      suggestCompanyItemCode({ companyName: "Mandeep Kumar", truckClass: "crane", items }),
    ).toBe("12TC - 20SUB");
  });
});

describe("suggestContactId", () => {
  const contacts = [
    { contactId: "c1", name: "Xperia Group Pty Ltd" },
    { contactId: "c2", name: "Metro Crane Hire" },
    { contactId: "c3", name: "Xperia Logistics" },
  ];

  it("prefers an exact name, then the closest name ignoring Pty Ltd", () => {
    expect(suggestContactId({ billTo: "metro crane hire", contacts })).toBe("c2");
    expect(suggestContactId({ billTo: "Xperia Group", contacts })).toBe("c1");
  });

  it("suggests nothing for an unrelated name", () => {
    expect(suggestContactId({ billTo: "Coastal Building Supplies", contacts })).toBeNull();
  });
});

describe("getFuelLevyItemCode", () => {
  const codes = ["Fuel Levy", "Fuel Levy 10%", "Fuel Levy 12%", "Fuel Levy 5%"];

  it("uses the item for the percentage when Xero has one", () => {
    expect(getFuelLevyItemCode({ percent: 10, itemCodes: codes, fallbackItemCode: "Fuel Levy" })).toBe(
      "Fuel Levy 10%",
    );
  });

  it("falls back to the plain fuel levy item", () => {
    expect(getFuelLevyItemCode({ percent: 7, itemCodes: codes, fallbackItemCode: "Fuel Levy" })).toBe(
      "Fuel Levy",
    );
    expect(getFuelLevyItemCode({ percent: 7, itemCodes: codes, fallbackItemCode: null })).toBeNull();
  });
});
