# Google Drive Integration Setup

This guide will help you set up Google Drive integration for CSV import/export functionality in your worklog application.

## Prerequisites

1. A Google Cloud Project
2. Google Drive API enabled
3. OAuth 2.0 credentials configured

## Step 1: Create Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

## Step 2: Configure OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application" as the application type
4. Configure the OAuth consent screen:
   - Add your application name
   - Add your email as a test user
       - Add the required scopes:
      - `https://www.googleapis.com/auth/drive.file`
      - `https://www.googleapis.com/auth/drive.metadata.readonly`
      - `https://www.googleapis.com/auth/drive.readonly`
      - `https://www.googleapis.com/auth/drive` (for shared drive access)

5. Configure authorized redirect URIs:
   - For development: `http://localhost:3000/api/google-drive/callback`
   - For production: `https://yourdomain.com/api/google-drive/callback`

6. Note down your Client ID and Client Secret

## Step 3: Environment Variables

Add the following environment variables to your `.env.local` file:

```env
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-drive/callback"
```

For production, update the redirect URI to your domain:
```env
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/google-drive/callback"
```

## Step 4: Configure Shared Drive Access (Optional)

If you want to access shared drives:

1. **Add your Google account to the shared drive**:
   - Go to Google Drive
   - Right-click on the shared drive
   - Click "Share"
   - Add your email with "Editor" or "Manager" role

2. **If your app is in testing mode**:
   - Go to OAuth consent screen in Google Cloud Console
   - Add your email to "Test users" section

## Step 5: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to the worklog or customers page
3. Click the "Upload to Drive" button
4. Follow the OAuth flow to authenticate with Google
5. Select a folder (including shared drives) to upload your CSV export

## Features

### CSV Export
- Export worklog data with current filters applied
- Export customer data with current filters applied
- Download CSV files directly to your computer

### CSV Import
- Import worklog data from CSV files
- Import customer data from CSV files
- Validation and error reporting for import issues

### Google Drive Integration
- Upload CSV exports directly to Google Drive
- Access to shared drives and folders
- Automatic file naming with timestamps

## CSV Format

### Worklog Import Format
Required columns:
- `Date` (YYYY-MM-DD format)
- `Driver`
- `Customer`
- `Bill To`

Optional columns:
- `Registration`
- `Truck Type`
- `Pickup`
- `Dropoff`
- `Runsheet` (Yes/No or true/false)
- `Invoiced` (Yes/No or true/false)
- `Charged Hours` (numeric)
- `Driver Charge` (numeric)
- `Comments`

### Customer Import Format
Required columns:
- `Customer`
- `Bill To`
- `Contact`

Optional columns:
- `Tray Rate` (numeric)
- `Crane Rate` (numeric)
- `Semi Rate` (numeric)
- `Semi Crane Rate` (numeric)
- `Fuel Levy (%)` (numeric)
- `Tolls` (Yes/No or true/false)
- `Comments`

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI" error**
   - Ensure your redirect URI matches exactly in Google Cloud Console
   - Check that your environment variables are set correctly

2. **"Access denied" error**
   - Make sure you've added your email as a test user in the OAuth consent screen
   - Verify that the required scopes are added

3. **Import errors**
   - Check that your CSV file has the correct column headers
   - Ensure required fields are not empty
   - Verify date formats are correct (YYYY-MM-DD)

4. **Upload to Drive fails**
   - Check that you have write permissions to the selected folder
   - Verify your Google account has access to the shared drive (if using one)

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify your environment variables are set correctly
3. Ensure your Google Cloud project has the Drive API enabled
4. Check that your OAuth consent screen is properly configured 