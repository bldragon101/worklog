import { withSavedOption } from "@/lib/utils/select-options";

describe("withSavedOption", () => {
  const options = ["Acme", "Bolt"];

  it("appends a saved value missing from the options", () => {
    expect(withSavedOption({ options, saved: "Legacy Co" })).toEqual([
      "Acme",
      "Bolt",
      "Legacy Co",
    ]);
  });

  it("returns the same options when the saved value is present", () => {
    expect(withSavedOption({ options, saved: "Acme" })).toBe(options);
  });

  it.each([null, undefined, ""])("ignores an empty saved value (%s)", (saved) => {
    expect(withSavedOption({ options, saved })).toBe(options);
  });
});
