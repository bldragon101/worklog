import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegionalDropoffNotice } from "@/components/entities/job/regional-dropoff-notice";

describe("RegionalDropoffNotice", () => {
  it("renders a badge for each regional suburb", () => {
    render(<RegionalDropoffNotice suburbs={["Belmont", "Bendigo"]} />);
    expect(screen.getByText("Regional: Belmont")).toBeInTheDocument();
    expect(screen.getByText("Regional: Bendigo")).toBeInTheDocument();
    expect(
      screen.getByText("Check whether country run charges apply."),
    ).toBeInTheDocument();
  });

  it("renders nothing without regional suburbs", () => {
    const { container } = render(<RegionalDropoffNotice suburbs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
