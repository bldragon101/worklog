import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import SettingsUsersPage from "@/app/settings/users/page";
import { renderWithQueryClient } from "../helpers/query-client";

vi.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/brand/icon-logo", () => ({
  PageHeader: () => null,
}));
vi.mock("@/components/users/create-user-dialog", () => ({
  CreateUserDialog: () => null,
}));
vi.mock("@/components/users/user-card", () => ({
  UserCard: ({ user }: { user: { email: string } }) => (
    <div data-testid="user-card">{user.email}</div>
  ),
}));
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const users = [
  {
    id: "u1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    role: "admin",
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "u2",
    email: "grace@example.com",
    firstName: "Grace",
    lastName: "Hopper",
    role: "viewer",
    isActive: false,
    createdAt: "2024-01-02T00:00:00Z",
  },
];

describe("SettingsUsersPage", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("loads users and filters them by the search box", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => users,
    });

    renderWithQueryClient({ ui: <SettingsUsersPage /> });

    await waitFor(() =>
      expect(screen.getAllByTestId("user-card")).toHaveLength(2),
    );
    expect(mockFetch).toHaveBeenCalledWith("/api/users");

    fireEvent.change(document.getElementById("search-users-input")!, {
      target: { value: "grace" },
    });

    expect(screen.getAllByTestId("user-card")).toHaveLength(1);
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });

  it("shows the permission message when loading is forbidden", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    renderWithQueryClient({ ui: <SettingsUsersPage /> });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error Loading Users",
        description: "You do not have permission to manage users.",
        variant: "destructive",
      }),
    );
    expect(screen.queryAllByTestId("user-card")).toHaveLength(0);
  });

  it("refetches the list when refresh is pressed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => users,
    });

    renderWithQueryClient({ ui: <SettingsUsersPage /> });
    await waitFor(() =>
      expect(screen.getAllByTestId("user-card")).toHaveLength(2),
    );

    fireEvent.click(document.getElementById("refresh-users-btn")!);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
