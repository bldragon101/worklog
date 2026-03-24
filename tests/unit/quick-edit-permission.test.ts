import { renderHook, waitFor } from "@testing-library/react";
import { useQuickEditPermission } from "@/hooks/use-quick-edit-permission";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function createResponse({
  ok,
  body,
}: {
  ok: boolean;
  body: Record<string, unknown>;
}) {
  return {
    ok,
    json: () => Promise.resolve(body),
  };
}

function mockFetchResponses({
  settingsResponse,
  roleResponse,
}: {
  settingsResponse: { ok: boolean; body: Record<string, unknown> };
  roleResponse: { ok: boolean; body: Record<string, unknown> };
}) {
  mockFetch.mockImplementation((input: string) => {
    if (input.includes("/api/admin/quick-edit-settings")) {
      return Promise.resolve(createResponse(settingsResponse));
    }
    if (input.includes("/api/user/role")) {
      return Promise.resolve(createResponse(roleResponse));
    }
    return Promise.reject(new Error("Unexpected URL"));
  });
}

describe("useQuickEditPermission", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns loading state initially", () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "admin" },
      },
      roleResponse: {
        ok: true,
        body: { role: "admin" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("allows admin when minRole is admin", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "admin" },
      },
      roleResponse: {
        ok: true,
        body: { role: "admin" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("allows admin when minRole is user", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "user" },
      },
      roleResponse: {
        ok: true,
        body: { role: "admin" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("allows manager when minRole is manager", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "manager" },
      },
      roleResponse: {
        ok: true,
        body: { role: "manager" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("denies manager when minRole is admin", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "admin" },
      },
      roleResponse: {
        ok: true,
        body: { role: "manager" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("allows user when minRole is user", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "user" },
      },
      roleResponse: {
        ok: true,
        body: { role: "user" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("denies user when minRole is manager", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "manager" },
      },
      roleResponse: {
        ok: true,
        body: { role: "user" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("allows viewer when minRole is viewer", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "viewer" },
      },
      roleResponse: {
        ok: true,
        body: { role: "viewer" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("denies viewer when minRole is user", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "user" },
      },
      roleResponse: {
        ok: true,
        body: { role: "viewer" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("denies access when settings API returns non-ok response", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: false,
        body: {},
      },
      roleResponse: {
        ok: true,
        body: { role: "admin" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("denies access when role API returns non-ok response", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "viewer" },
      },
      roleResponse: {
        ok: false,
        body: {},
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("denies access when fetch throws a network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("defaults minRole to admin when quickEditMinRole is missing from settings", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: {},
      },
      roleResponse: {
        ok: true,
        body: { role: "manager" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("allows admin when quickEditMinRole is missing from settings (defaults to admin)", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: {},
      },
      roleResponse: {
        ok: true,
        body: { role: "admin" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("defaults role to viewer when role is missing from response", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "user" },
      },
      roleResponse: {
        ok: true,
        body: {},
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });

  it("allows access when role is missing and minRole is viewer (defaults to viewer)", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "viewer" },
      },
      roleResponse: {
        ok: true,
        body: {},
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(true);
  });

  it("denies access for an unknown role string which resolves to level 0", async () => {
    mockFetchResponses({
      settingsResponse: {
        ok: true,
        body: { quickEditMinRole: "viewer" },
      },
      roleResponse: {
        ok: true,
        body: { role: "unknown_role" },
      },
    });

    const { result } = renderHook(() => useQuickEditPermission());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseQuickEdit).toBe(false);
  });
});
