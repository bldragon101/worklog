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

  it("keeps an empty live region without regional suburbs", () => {
    render(<RegionalDropoffNotice suburbs={[]} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toBeEmptyDOMElement();
  });
});
