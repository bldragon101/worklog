import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FuelLevyNotice } from "@/components/layout/fuel-levy-notice";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/hooks/use-default-fuel-levy");

describe("FuelLevyNotice", () => {
  const mockUseDefaultFuelLevy = useDefaultFuelLevy as vi.MockedFunction<
    typeof useDefaultFuelLevy
  >;

  const mockFuelLevy = ({
    data,
    isLoading = false,
    isError = false,
  }: {
    data: number | null | undefined;
    isLoading?: boolean;
    isError?: boolean;
  }) => {
    mockUseDefaultFuelLevy.mockReturnValue({
      data,
      isLoading,
      isError,
    } as ReturnType<typeof useDefaultFuelLevy>);
  };

  const renderNotice = ({ isAdmin }: { isAdmin: boolean }) =>
    render(
      <SidebarProvider>
        <FuelLevyNotice isAdmin={isAdmin} />
      </SidebarProvider>,
    );

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the default fuel levy to non-admin users", () => {
    mockFuelLevy({ data: 15.69 });
    renderNotice({ isAdmin: false });

    expect(screen.getByText("15.69%")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Default fuel levy: 15.69%",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a zero fuel levy", () => {
    mockFuelLevy({ data: 0 });
    renderNotice({ isAdmin: false });

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("links admins to the admin settings page", () => {
    mockFuelLevy({ data: 20 });
    renderNotice({ isAdmin: true });

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/settings/admin",
    );
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("hides the notice from non-admin users when not set", () => {
    mockFuelLevy({ data: null });
    const { container } = renderNotice({ isAdmin: false });

    expect(
      container.querySelector("#sidebar-fuel-levy-notice"),
    ).not.toBeInTheDocument();
  });

  it("tells admins when the default fuel levy is not set", () => {
    mockFuelLevy({ data: null });
    renderNotice({ isAdmin: true });

    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("renders nothing while loading or on error", () => {
    mockFuelLevy({ data: undefined, isLoading: true });
    const { container, rerender } = renderNotice({ isAdmin: true });
    expect(
      container.querySelector("#sidebar-fuel-levy-notice"),
    ).not.toBeInTheDocument();

    mockFuelLevy({ data: undefined, isError: true });
    rerender(
      <SidebarProvider>
        <FuelLevyNotice isAdmin />
      </SidebarProvider>,
    );
    expect(
      container.querySelector("#sidebar-fuel-levy-notice"),
    ).not.toBeInTheDocument();
  });
});
