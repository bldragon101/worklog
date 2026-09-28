/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  return {
    event: { current: {} as unknown },
    userUpdate: vi.fn(),
    userFindUnique: vi.fn(),
    updateUserMetadata: vi.fn(),
  };
});

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return mocks.event.current;
    }
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: mocks.userUpdate,
      findUnique: mocks.userFindUnique,
    },
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: { updateUserMetadata: mocks.updateUserMetadata },
  }),
}));

import { POST } from "@/app/api/webhooks/clerk/route";

function webhookRequest() {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": "msg_1",
      "svix-timestamp": "1790000000",
      "svix-signature": "v1,signature",
    },
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userUpdate.mockResolvedValue({});
  mocks.userFindUnique.mockResolvedValue({ role: "manager" });
});

describe("Clerk webhook session.created", () => {
  it("records the login against the session's user, not the session ID", async () => {
    mocks.event.current = {
      type: "session.created",
      data: { id: "sess_123", user_id: "user_456" },
    };

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user_456" },
      data: expect.objectContaining({ lastLogin: expect.any(Date) }),
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user_456" },
      select: { role: true },
    });
    expect(mocks.updateUserMetadata).toHaveBeenCalledWith("user_456", {
      publicMetadata: { role: "manager" },
    });
  });

  it("skips the update when the event has no user ID", async () => {
    mocks.event.current = {
      type: "session.created",
      data: { id: "sess_123" },
    };

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.updateUserMetadata).not.toHaveBeenCalled();
  });
});
