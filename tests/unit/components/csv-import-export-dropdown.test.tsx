import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { CsvImportExportDropdown } from "@/components/shared/csv-import-export-dropdown";

const mocks = vi.hoisted(() => ({ checkPermission: vi.fn() }));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ checkPermission: mocks.checkPermission }),
}));
// Render menu items inline so they can be queried without opening the menu
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children, id }: { children: ReactNode; id?: string }) => (
    <div id={id}>{children}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CsvImportExportDropdown", () => {
  it.each([
    ["jobs", "create_jobs"],
    ["customers", "create_customers"],
    ["vehicles", "create_vehicles"],
    ["drivers", "create_drivers"],
  ] as const)(
    "checks %s imports against %s",
    (type, permission) => {
      mocks.checkPermission.mockReturnValue(true);

      render(<CsvImportExportDropdown type={type} />);

      expect(mocks.checkPermission).toHaveBeenCalledWith(permission);
      expect(screen.getByText("Import CSV")).toBeInTheDocument();
    },
  );

  it("hides Import CSV but keeps Export CSV without the create permission", () => {
    mocks.checkPermission.mockReturnValue(false);

    render(<CsvImportExportDropdown type="drivers" />);

    expect(screen.queryByText("Import CSV")).not.toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });
});
