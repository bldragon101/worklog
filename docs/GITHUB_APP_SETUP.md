# GitHub App Setup for Release Automation

## Overview

To bypass branch protection rules and allow automated releases, you need to create a GitHub App with appropriate permissions.

## Step 1: Create GitHub App

1. Go to **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
   - Or visit: https://github.com/settings/apps/new

2. Fill in the details:
   - **GitHub App name**: `worklog-release-bot` (must be unique across GitHub)
   - **Homepage URL**: `https://github.com/bldragon101/worklog`
   - **Webhook**: Uncheck "Active"

3. Set **Repository permissions**:
   - **Contents**: Read and write
   - **Metadata**: Read-only (automatically set)
   - **Pull requests**: Read and write
   - **Issues**: Read and write

4. Under **Where can this GitHub App be installed?**:
   - Select "Only on this account"

5. Click **Create GitHub App**

## Step 2: Generate Private Key

1. After creating the app, scroll down to **Private keys**
2. Click **Generate a private key**
3. Save the downloaded `.pem` file securely

## Step 3: Install the App

1. Click **Install App** in the left sidebar
2. Select your account
3. Choose **Only select repositories**
4. Select the `worklog` repository
5. Click **Install**

## Step 4: Get App ID

1. Go back to your app settings
2. Note the **App ID** at the top of the page

## Step 5: Add Secrets to Repository

1. Go to your repository: `https://github.com/bldragon101/worklog`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add two secrets:

### Secret 1: RELEASE_APP_ID
- **Name**: `RELEASE_APP_ID`
- **Value**: The App ID from Step 4 (e.g., `123456`)

### Secret 2: RELEASE_APP_PRIVATE_KEY
- **Name**: `RELEASE_APP_PRIVATE_KEY`
- **Value**: Contents of the `.pem` file from Step 2
  - Open the `.pem` file in a text editor
  - Copy the **entire content** including:
    ```
    -----BEGIN RSA PRIVATE KEY-----
    ...
    -----END RSA PRIVATE KEY-----
    ```

## Step 6: Configure Branch Protection Bypass

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Edit the rule for `main` branch
3. Scroll to **Restrict who can push to matching branches**
4. Add the GitHub App: `worklog-release-bot`
5. Save changes

Repeat for `development` branch if protected.

## Step 7: Test the Setup

1. Make a test commit with conventional commit format:
   ```bash
   git commit -m "fix: test release automation"
   ```
2. Push to a branch and merge via PR to `development` or `main`
3. Check GitHub Actions to verify the workflow runs successfully

## Verification Checklist

- [ ] GitHub App created with correct name
- [ ] Private key generated and saved
- [ ] App installed on worklog repository
- [ ] `RELEASE_APP_ID` secret added
- [ ] `RELEASE_APP_PRIVATE_KEY` secret added
- [ ] App added to branch protection bypass list
- [ ] Test workflow runs successfully

## Troubleshooting

### Workflow fails with "Resource not accessible by integration"
- Check that all repository permissions are set correctly on the GitHub App
- Verify the app is installed on the repository

### Workflow fails with "refusing to allow a GitHub App to create or update workflow"
- Add **Workflows**: Read and write permission to the GitHub App

### "Bad credentials" error
- Verify the private key secret is formatted correctly
- Ensure no extra spaces or newlines were added when copying

### Push still blocked by branch protection
- Confirm the GitHub App is added to the bypass list in branch protection settings
- Check that the workflow is using the token from the app, not `GITHUB_TOKEN`

## Security Notes

- The private key grants significant access to your repository
- Store it securely and never commit it to version control
- Rotate the key periodically by generating a new one
- The app only has access to repositories you explicitly install it on

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Bypassing branch protections](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets#github-app)
- [tibdex/github-app-token action](https://github.com/tibdex/github-app-token)