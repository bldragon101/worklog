import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DropoffWithRegionalBadges } from "@/components/entities/job/dropoff-with-regional-badges";

describe("DropoffWithRegionalBadges", () => {
  it("badges regional drop-offs from a metro pickup", () => {
    render(
      <DropoffWithRegionalBadges
        pickup="Dandenong"
        dropoff="Richmond, Belmont"
      />,
    );
    expect(screen.getByTitle("Belmont (regional suburb)")).toBeInTheDocument();
    expect(screen.getByText("Richmond,")).toBeInTheDocument();
    expect(screen.queryByTitle(/Richmond/)).not.toBeInTheDocument();
  });

  it("does not badge when the pickup is regional", () => {
    render(<DropoffWithRegionalBadges pickup="Geelong" dropoff="Belmont" />);
    expect(screen.queryByTitle(/regional suburb/)).not.toBeInTheDocument();
    expect(screen.getByText("Belmont")).toBeInTheDocument();
  });

  it("renders nothing for an empty drop-off", () => {
    const { container } = render(
      <DropoffWithRegionalBadges pickup="Dandenong" dropoff={null} />,
    );
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
