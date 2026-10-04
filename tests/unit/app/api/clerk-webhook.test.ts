/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { Webhook } from "svix";

const mocks = vi.hoisted(() => {
  process.env.CLERK_WEBHOOK_SECRET = `whsec_${Buffer.from(
    "clerk-webhook-test-secret",
  ).toString("base64")}`;
  return {
    userUpdate: vi.fn(),
    userFindUnique: vi.fn(),
    updateUserMetadata: vi.fn(),
  };
});

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

/**
 * A webhook request signed with the test secret, as Clerk would send it.
 */
function webhookRequest({
  event,
  signature,
}: {
  event: unknown;
  signature?: string;
}) {
  const body = JSON.stringify(event);
  const id = "msg_1";
  const timestamp = new Date();
  const signed = new Webhook(process.env.CLERK_WEBHOOK_SECRET ?? "").sign(
    id,
    timestamp,
    body,
  );

  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature ?? signed,
    },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userUpdate.mockResolvedValue({});
  mocks.userFindUnique.mockResolvedValue({ role: "manager" });
});

describe("Clerk webhook session.created", () => {
  it("records the login against the session's user, not the session ID", async () => {
    const response = await POST(
      webhookRequest({
        event: {
          type: "session.created",
          data: { id: "sess_123", user_id: "user_456" },
        },
      }),
    );

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
    const response = await POST(
      webhookRequest({
        event: { type: "session.created", data: { id: "sess_123" } },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.updateUserMetadata).not.toHaveBeenCalled();
  });
});

describe("Clerk webhook signature", () => {
  it("rejects a request whose signature does not match", async () => {
    const response = await POST(
      webhookRequest({
        event: {
          type: "session.created",
          data: { id: "sess_123", user_id: "user_456" },
        },
        signature: "v1,bm90LWEtcmVhbC1zaWduYXR1cmU=",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
