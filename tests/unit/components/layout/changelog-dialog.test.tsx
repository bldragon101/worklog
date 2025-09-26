import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangelogDialog } from '@/components/layout/changelog-dialog';
import type { Release } from '@/lib/changelog';

describe('ChangelogDialog', () => {
  const mockReleases: Release[] = [
    {
      version: '2.0.0',
      date: '2024-02-01',
      features: ['New dashboard', 'API v2'],
      bugFixes: ['Fix memory leak', 'Resolve crash issue'],
      breaking: ['API endpoints changed'],
      userNotes: {
        whatsNew: ['Brand new dashboard experience', 'Faster API'],
        improvements: ['Better performance', 'Enhanced stability'],
      },
    },
    {
      version: '1.1.0',
      date: '2024-01-15',
      features: ['Add export feature'],
      bugFixes: ['Fix login bug'],
      breaking: [],
    },
    {
      version: '1.0.0',
      date: '2024-01-01',
      features: ['Initial release'],
      bugFixes: [],
      breaking: [],
    },
  ];

  it('should render dialog with title and description', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    expect(screen.getByText('Release History')).toBeInTheDocument();
    expect(screen.getByText('View changes and improvements in each version of WorkLog')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    const { container } = render(
      <ChangelogDialog
        open={false}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('should display all releases with version numbers', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('should show Current badge for current version', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="1.1.0"
      />
    );

    const currentBadge = screen.getByText('Current');
    expect(currentBadge).toBeInTheDocument();

    // Check it's associated with v1.1.0
    const v110Element = screen.getByText('v1.1.0');
    expect(v110Element.parentElement?.parentElement).toContainElement(currentBadge);
  });

  it('should show Latest badge for newest non-current version', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="1.1.0"
      />
    );

    const latestBadge = screen.getByText('Latest');
    expect(latestBadge).toBeInTheDocument();

    // Check it's associated with v2.0.0
    const v200Element = screen.getByText('v2.0.0');
    expect(v200Element.parentElement?.parentElement).toContainElement(latestBadge);
  });

  it('should expand first version by default', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // First version should be expanded - check for user notes content
    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
      expect(screen.getByText('Brand new dashboard experience')).toBeInTheDocument();
    });
  });

  it('should toggle version expansion when clicked', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Find and click on v1.1.0 (should be collapsed initially)
    const v110Button = screen.getByText('v1.1.0').closest('button');
    expect(v110Button).toBeInTheDocument();

    // Initially collapsed - technical details not visible
    expect(screen.queryByText('Add export feature')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(v110Button!);

    // Now should see technical details button
    await waitFor(() => {
      expect(screen.getAllByText('Technical Details')).toHaveLength(2); // One for v2.0.0, one for v1.1.0
    });
  });

  it('should show user notes when available', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Check for user notes sections
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText('Improvements')).toBeInTheDocument();

    // Check for user notes content
    expect(screen.getByText('Brand new dashboard experience')).toBeInTheDocument();
    expect(screen.getByText('Better performance')).toBeInTheDocument();
  });

  it('should show technical details in expandable section', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Technical details should be hidden initially
    expect(screen.queryByText('New dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Fix memory leak')).not.toBeInTheDocument();

    // Click on Technical Details button
    const techButton = screen.getByText('Technical Details').closest('button');
    fireEvent.click(techButton!);

    // Now technical details should be visible
    await waitFor(() => {
      expect(screen.getByText('New dashboard')).toBeInTheDocument();
      expect(screen.getByText('Fix memory leak')).toBeInTheDocument();
      expect(screen.getByText('API endpoints changed')).toBeInTheDocument();
    });
  });

  it('should display breaking changes in red', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Expand technical details
    const techButton = screen.getByText('Technical Details').closest('button');
    fireEvent.click(techButton!);

    await waitFor(() => {
      const breakingHeader = screen.getByText('Breaking Changes');
      expect(breakingHeader).toHaveClass('text-red-600');

      const breakingChange = screen.getByText('API endpoints changed');
      expect(breakingChange).toBeInTheDocument();
    });
  });

  it('should display features in green', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Expand technical details
    const techButton = screen.getByText('Technical Details').closest('button');
    fireEvent.click(techButton!);

    await waitFor(() => {
      const featuresHeader = screen.getByText('Features');
      expect(featuresHeader).toHaveClass('text-green-600');
    });
  });

  it('should display bug fixes in orange', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Expand technical details
    const techButton = screen.getByText('Technical Details').closest('button');
    fireEvent.click(techButton!);

    await waitFor(() => {
      const bugFixesHeader = screen.getByText('Bug Fixes');
      expect(bugFixesHeader).toHaveClass('text-orange-600');
    });
  });

  it('should collapse technical details when version is collapsed', async () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Expand technical details first
    const techButton = screen.getByText('Technical Details').closest('button');
    fireEvent.click(techButton!);

    // Verify technical details are visible
    await waitFor(() => {
      expect(screen.getByText('New dashboard')).toBeInTheDocument();
    });

    // Collapse the version
    const versionButton = screen.getByText('v2.0.0').closest('button');
    fireEvent.click(versionButton!);

    // Technical details should be gone
    await waitFor(() => {
      expect(screen.queryByText('New dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();
    });
  });

  it('should handle releases without user notes', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={[mockReleases[1]]} // v1.1.0 has no user notes
        currentVersion="1.1.0"
      />
    );

    // Should not show What's New or Improvements sections
    expect(screen.queryByText("What's New")).not.toBeInTheDocument();
    expect(screen.queryByText('Improvements')).not.toBeInTheDocument();

    // Should still have Technical Details button
    expect(screen.getByText('Technical Details')).toBeInTheDocument();
  });

  it('should handle empty releases array', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={[]}
        currentVersion="1.0.0"
      />
    );

    expect(screen.getByText('Release History')).toBeInTheDocument();
    expect(screen.queryByText(/v\d+\.\d+\.\d+/)).not.toBeInTheDocument();
  });

  it('should format dates correctly', () => {
    render(
      <ChangelogDialog
        open={true}
        onOpenChange={jest.fn()}
        releases={mockReleases}
        currentVersion="2.0.0"
      />
    );

    // Check for formatted dates
    expect(screen.getByText('Feb 1, 2024')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument();
  });
});
