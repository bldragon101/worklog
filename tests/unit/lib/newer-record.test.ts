import { pickNewerRecord } from "@/lib/utils/newer-record";

const held = { id: 1, status: "draft", updatedAt: "2026-09-21T02:00:00.000Z" };

describe("pickNewerRecord", () => {
  it("keeps the held record when the list has no copy", () => {
    expect(pickNewerRecord({ held, listed: undefined })).toBe(held);
  });

  it("uses the listed copy when it was updated more recently", () => {
    const listed = { ...held, status: "finalised", updatedAt: "2026-09-21T03:00:00.000Z" };

    expect(pickNewerRecord({ held, listed })).toBe(listed);
  });

  it("keeps the held record when the listed copy is older, such as just after a save", () => {
    const listed = { ...held, updatedAt: "2026-09-21T01:00:00.000Z" };

    expect(pickNewerRecord({ held, listed })).toBe(held);
  });
});
