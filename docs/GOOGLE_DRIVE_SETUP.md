# Google Drive Integration Setup

This guide will help you set up Google Drive integration using service account authentication for CSV import/export functionality in your worklog application.

## Prerequisites

1. A Google Cloud Project
2. Google Drive API enabled
3. Service account with domain-wide delegation configured

## Step 1: Create Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

## Step 2: Configure Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `worklog-drive-service`
   - Description: `Service account for worklog Google Drive integration`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

## Step 3: Generate Service Account Key

1. Click on the created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Download the JSON file

## Step 4: Configure Domain-Wide Delegation

1. In the service account details, note the "Client ID"
2. Go to your Google Workspace Admin Console
3. Navigate to Security > API Controls > Domain-wide Delegation
4. Click "Add new"
5. Enter the Client ID from step 1
6. Add the following OAuth scopes:
   ```
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/drive.metadata.readonly
   ```

## Step 5: Environment Variables

Add the following environment variable to your `.env.local` file:

```env
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS="base64-encoded-service-account-json"
```

To encode your service account JSON file:
```bash
# On macOS/Linux
base64 -i path/to/service-account-key.json

# On Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/service-account-key.json"))
```

## Step 6: Configure Shared Drive Access

1. **Add the service account to shared drives**:
   - Go to Google Drive
   - Right-click on the shared drive
   - Click "Share"
   - Add the service account email (found in the JSON file) with "Editor" or "Manager" role

## Step 7: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to the Integrations page
3. Go to the "Service Account" tab
4. Click "Load Shared Drives" to test the connection
5. Select a shared drive and folder for testing

## Features

### Service Account Integration
- Secure server-to-server authentication
- No user interaction required for authentication
- Access to shared drives and folders
- Automatic file uploads with proper permissions

### CSV Export
- Export worklog data with current filters applied
- Export customer data with current filters applied
- Download CSV files directly to your computer

### CSV Import
- Import worklog data from CSV files
- Import customer data from CSV files
- Validation and error reporting for import issues

### Image Upload
- Upload images to Google Drive folders
- View images directly in the application
- Access to shared drive folders

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

1. **"Service account credentials not found" error**
   - Ensure `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` environment variable is set
   - Verify the base64 encoding is correct
   - Check that the JSON file is valid

2. **"Access denied" error**
   - Make sure the service account has been added to the shared drive
   - Verify domain-wide delegation is configured correctly
   - Check that the OAuth scopes are properly set

3. **Import errors**
   - Check that your CSV file has the correct column headers
   - Ensure required fields are not empty
   - Verify date formats are correct (YYYY-MM-DD)

4. **Upload to Drive fails**
   - Check that the service account has write permissions to the selected folder
   - Verify the service account has access to the shared drive

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify your environment variables are set correctly
3. Ensure your Google Cloud project has the Drive API enabled
4. Check that your service account has proper permissions
5. Verify domain-wide delegation is configured correctly 