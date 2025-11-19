# Release Plan: Version 1.4.0

## Overview

This document outlines the plan for releasing version 1.4.0 of WorkLog, which includes new RCTI PDF export features and improvements to time handling.

## Version Information

- **Current Version:** 1.3.0 (stable on main)
- **Target Version:** 1.4.0
- **Release Type:** Minor (new features)
- **Branch:** `bugfix/rcti-hours`

## Changes Included

### Commits

```
c6454a3 chore: Configure semantic-release to auto-generate changelog.json
74089b7 docs: Add 1.4.0 release notes
9306f5e feat: Add Download All PDFs feature to RCTI page
a681df6 fix: Update RCTI finalise flow and robust time utils
```

### Semantic Versioning Analysis

| Commit Type | Version Impact | Reason |
|------------|----------------|---------|
| `feat:` | Minor (1.3.x → 1.4.0) | New Download All PDFs feature |
| `fix:` | Patch (would be 1.3.1) | Bug fixes and improvements |
| `docs:` | None | Documentation only |
| `chore:` | None | Configuration changes |

**Result:** `feat` takes precedence → **1.4.0**

## New Features

### 1. Download All RCTI PDFs (Admin Only)
- Export multiple RCTI invoices as a single ZIP file
- Select date range for export
- Improved workflow for bulk invoice sharing
- Perfect for monthly accounting submissions

### 2. Enhanced RCTI Time Handling
- More robust time parsing and validation
- Better handling of edge cases in hour calculations
- Improved user experience when finalising RCTIs

## Release Notes

### User-Facing (RELEASES.md)

```markdown
## [1.4.0] - 2025-11-19

### What's New
- **Download All RCTI PDFs** (Admin Only): Export all RCTI invoices for a selected date range as a single ZIP file, making it easier to share multiple invoices with your accountant or for record-keeping

### Improvements
- **Enhanced RCTI Time Handling**: Improved how RCTI calculates hours worked with more robust time parsing and validation
- **Better RCTI Finalisation**: The finalise button now only appears when all required fields are properly filled in
```

### Technical Changelog (Auto-generated)

Will be added to `docs/CHANGELOG.md` by semantic-release:

```markdown
## [1.4.0](https://github.com/bldragon101/worklog/compare/v1.3.0...v1.4.0) (2025-11-19)

### Features
* Add Download All PDFs feature to RCTI page ([9306f5e](link))

### Bug Fixes
* Update RCTI finalise flow and robust time utils ([a681df6](link))
```

## Automated Release Process

### Workflow Configuration

The release is fully automated using GitHub Actions and semantic-release:

1. **Trigger:** Push to `main` branch
2. **Workflow:** `.github/workflows/release-main.yml`
3. **Configuration:** `.releaserc.json`

### Semantic-Release Plugins

```json
[
  "@semantic-release/commit-analyzer",    // Analyzes commits for version bump
  "@semantic-release/release-notes-generator", // Generates release notes
  "@semantic-release/changelog",          // Updates docs/CHANGELOG.md
  "@semantic-release/npm",                // Updates package.json (no publish)
  "@semantic-release/exec",               // Generates src/data/changelog.json
  "@semantic-release/git",                // Commits changes back to repo
  "@semantic-release/github"              // Creates GitHub release with assets
]
```

### What Gets Updated Automatically

✅ **Files Updated:**
- `package.json` (version: "1.4.0")
- `docs/CHANGELOG.md` (new entry at top)
- `src/data/changelog.json` (currentVersion: "1.4.0")

✅ **Git Operations:**
- Creates tag: `v1.4.0`
- Commits: `chore(release): 1.4.0 [skip ci]`
- Pushes to `main` branch

✅ **GitHub Release:**
- Release title: "v1.4.0"
- Release notes from CHANGELOG.md and RELEASES.md
- Attached assets:
  - `source-code.tar.gz`
  - `source-code.zip`

## Release Steps

### 1. Merge to Development (Pre-release)

```bash
git checkout development
git merge bugfix/rcti-hours
git push origin development
```

**Result:** Creates `v1.4.0-pre.1` (or next pre-release number)

**Workflow Triggered:** `.github/workflows/release-development.yml`

**Verification:**
- Check GitHub Actions run completes successfully
- Verify pre-release appears in GitHub Releases
- Confirm `development` branch has release commit

### 2. Test Pre-release

1. Deploy pre-release to staging/test environment
2. Verify Download All PDFs feature works correctly
3. Test RCTI time calculations and finalisation
4. Check changelog dialog shows correct version
5. Confirm no regressions in existing features

### 3. Merge to Main (Stable Release)

```bash
git checkout main
git pull origin main
git merge development --no-ff -m "Merge development for v1.4.0 release"
git push origin main
```

**Result:** Creates stable `v1.4.0` release

**Workflow Triggered:** `.github/workflows/release-main.yml`

**Automated Actions:**
1. Analyzes commits since v1.3.0
2. Determines version bump: 1.3.0 → 1.4.0
3. Runs `node scripts/generate-changelog.js`
4. Updates package.json, CHANGELOG.md, changelog.json
5. Creates Git tag `v1.4.0`
6. Commits: `chore(release): 1.4.0 [skip ci]`
7. Creates GitHub Release with notes and source archives
8. Pushes changes back to `main`

### 4. Post-Release Verification

**Check GitHub:**
- [ ] Release appears at: https://github.com/bldragon101/worklog/releases/tag/v1.4.0
- [ ] Release notes include user-friendly descriptions
- [ ] Source code archives are attached
- [ ] Tag `v1.4.0` exists

**Check Repository:**
```bash
git pull origin main
cat package.json | grep version  # Should show "1.4.0"
head -n 20 docs/CHANGELOG.md     # Should have 1.4.0 entry at top
cat src/data/changelog.json | grep currentVersion  # Should show "1.4.0"
```

**Check UI:**
1. Deploy to production
2. Login to application
3. Check sidebar shows `v1.4.0` button
4. Click changelog button
5. Verify 1.4.0 appears with "Current" badge
6. Verify release notes display correctly

### 5. Communication

**Notify Users:**
- [ ] Post announcement in communication channels
- [ ] Highlight Download All PDFs feature for admins
- [ ] Mention improved RCTI time handling

**Update Documentation:**
- [ ] User guide (if applicable)
- [ ] Admin documentation for new PDF export feature
- [ ] FAQ or knowledge base articles

## Rollback Plan

If issues are discovered after release:

### Option 1: Hotfix (Recommended for Critical Issues)

```bash
git checkout -b hotfix/1.4.1 main
# Fix the issue
git commit -m "fix: Critical issue description"
git push origin hotfix/1.4.1
# Create PR to main
# Merge will trigger 1.4.1 release
```

### Option 2: Revert (For Severe Issues)

```bash
git checkout main
git revert <release-commit-hash> -m 1
git push origin main
# This will create a new release reverting changes
```

### Option 3: Emergency Rollback

1. Delete the tag and release from GitHub
2. Force push previous commit to main
3. Redeploy previous version
4. Fix issues and re-release

## Timeline

- **Pre-release to Development:** Immediate (ready to merge)
- **Testing Period:** 1-2 days
- **Production Release:** After testing verification
- **User Communication:** Within 24 hours of release

## Success Criteria

✅ All automated checks pass
✅ Version 1.4.0 appears in GitHub releases
✅ UI displays v1.4.0 in changelog dialog
✅ Download All PDFs feature works correctly
✅ RCTI time calculations are accurate
✅ No critical bugs reported within 48 hours

## Notes

- This release uses conventional commits for automatic versioning
- The changelog.json is now automatically generated during release
- No manual version bumps required - semantic-release handles everything
- All times continue to use Australian English spelling (e.g., "finalise")

## Contact

For questions about this release:
- Review the semantic-release logs in GitHub Actions
- Check the `.releaserc.json` configuration
- Refer to `AGENTS.md` for development guidelines

---

**Status:** Ready for release
**Prepared by:** AI Assistant
**Date:** 2025-11-19