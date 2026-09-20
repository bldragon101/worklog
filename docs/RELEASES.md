# Release Notes

User-facing release notes for WorkLog. These notes explain changes in plain language for end users.

## [1.10.0] - 2026-09-20

### What's New
- **Travel Hours**: Record travel time separately on a job and pay it to the driver on top of the hours charged to the customer. The jobs list shows a badge under the hours so you can see at a glance which jobs include travel
- **Driver Hour Deductions**: Withhold hours from a driver on an individual job using the new Deduction field. The deduction is taken off the driver's hours for that job and flows through to their RCTI and jobs report
- **Automatic Driver Hours**: Driver Hours is now worked out for you from hours plus travel hours, less any deduction, and is no longer typed in by hand. Hovering the field explains that it is calculated
- **Driver-Only Jobs**: Tick "Driver only" on a job the driver is paid for but the customer is not charged for, such as yard work or repositioning. These jobs show a "no charge" badge under their hours and still appear on the driver's RCTI in full
- **How Hours Work Guide**: A new "How hours work" button on the jobs page and in the job form explains each hours field, how the driver's paid hours are calculated, and what each badge means, with worked examples
- **Redesigned Job Dialog**: The add and edit job dialog is wider and grouped into labelled sections - Job, Customer & Route, Hours, Tolls & Status, and Comments - so all fields are visible without scrolling
- **Google Drive Reconnection Prompts**: If the Google Drive connection expires, WorkLog now tells administrators clearly that Drive needs reconnecting from the Integrations page instead of failing silently

### Improvements
- **Accurate RCTI Deduction Lines**: Break deductions and negative manual lines now keep their value when a line is edited, when GST settings are changed, and on the downloaded PDF. Previously these could be reset to zero
- **Deductions Kept When Editing RCTIs**: Adjusting the hours on an RCTI line now keeps the deduction carried over from the job, instead of quietly paying those hours back to the driver
- **Deductions Shown on RCTIs and Reports**: Where hours have been withheld, the Total Driver Hours column shows the amount deducted in brackets, on screen and in the PDF
- **Clearer Legacy Driver Hours**: Jobs that still carry an old manually entered Driver Hours value now explain what that value does and offer a one-click way to clear it and return to calculated hours, keeping any deduction
- **Deduction Column and Filter**: The jobs table has optional Deduction, Driver Hours and Driver Only columns you can show, sort and filter on
- **Driver Hours in Exports**: The jobs CSV export now includes Deduction Hours and Driver Only columns, and imports accept them
- **Shared Drive Support**: Browsing Google Drive folders now works correctly with shared drives, handles long folder lists, and resets cleanly when the folder picker is closed
- **Driver Updates**: Fixed an error when updating a driver that was archived or matched an existing entry
- **Attachment Names on Bulk Edits**: Attachment file names now stay in sync with Google Drive when jobs are updated through quick edit or bulk changes

## [1.8.0] - 2026-03-24

### What's New
- **Jobs Report**: Create weekly jobs reports for each driver showing jobs, hours worked, travelling time, and a grand total. Finalise reports, download them as PDF, and email them directly to drivers — all from within WorkLog
- **Quick Edit Mode** (Admin Only): Toggle quick-edit to update job fields such as hours, charges, and tolls directly in the jobs table without opening a form
- **Job Attachments**: Upload multiple file attachments to individual jobs with a staged upload flow that lets you review files before saving
- **Improved Time Picker**: Type start and finish times directly into the time picker with validation, in addition to using the dropdown selectors
- **RCTI Sent Tracking**: RCTIs now display when they were emailed so you can see at a glance which invoices have been sent to drivers
- **Sign-up Control** (Admin Only): Enable or disable new user sign-ups from the company settings page
- **Automated Daily Backups**: The database is automatically backed up daily to Google Drive for added peace of mind

### Improvements
- **Bankers Rounding**: Hours and charges now use bankers rounding for more accurate financial calculations
- **Better Attachment Handling**: Resolved issues with nested attachment arrays and improved reliability of multi-file uploads
- **Improved API Security**: Enhanced authentication, input validation, and rate limiting across all API routes
- **Accessibility Enhancements**: Improved keyboard navigation, screen reader support, and icon labels throughout the application
- **Refined Table Styling**: Cleaner table layout and styling for quick-edit mode and data tables

## [1.7.3] - 2026-02-16

### Improvements
- **Attachment Reliability**: Fixed an issue where editing a job could corrupt its attachment list

## [1.7.2] - 2026-02-16

### Improvements
- **Attachment Data Integrity**: Fixed nested attachment arrays that could cause display issues

## [1.7.1] - 2026-02-15

### Improvements
- **Database Schema Sync**: Applied migrations to keep the production database schema up to date

## [1.7.0] - 2026-02-15

### What's New
- **RCTI Email Delivery** (Admin Only): Email RCTIs directly to drivers from WorkLog
- **Company Settings** (Admin Only): Configure company details used on RCTIs and emails
- **Driver Archiving** (Admin Only): Archive drivers you no longer need without losing historical data
- **RCTIs by Driver**: Filter and view RCTIs grouped by driver for faster reconciliation

### Improvements
- **Clearer RCTI PDFs**: Improved formatting and file names for downloaded RCTIs
- **Consistent Driver and Truck Details**: Names and registrations are now standardised for easier reading

## [1.6.0] - 2026-01-04

### What's New
- **Attachment Syncing**: Attachments now stay updated when you edit or update jobs

### Improvements
- **Week Filters**: Week views now align to the correct week-ending date
- **Time Display Accuracy**: Times and dates now display consistently without unintended timezone shifts

## [1.5.0] - 2026-01-04

### What's New
- **Revert RCTIs to Draft** (Admin Only): Move a finalised RCTI back to draft when corrections are needed

### Improvements
- **Dark Mode Readability**: Paid badge text on RCTIs is clearer in dark mode

## [1.4.3] - 2025-12-15

### Improvements
- **Access Management Reliability**: More consistent user permissions across the app

## [1.4.2] - 2025-11-20

### Improvements
- **Time Display Consistency**: Times now display without timezone shifts for more predictable results

## [1.4.0] - 2025-11-19

### What's New
- **Download All RCTI PDFs** (Admin Only): Export all RCTI invoices for a selected date range by downloading individual PDF files sequentially, making it easier to share multiple invoices with your accountant or for record-keeping

### Improvements
- **Enhanced RCTI Time Handling**: Improved how RCTI calculates hours worked with more robust time parsing and validation
- **Better RCTI Finalisation**: The finalise button now only appears when all required fields are properly filled in

## [1.3.0] - 2025-10-29

### What's New
- **RCTI Invoice Management** (Admin Only): Create and manage Recipient Created Tax Invoices for subcontractors directly within WorkLog. Generate invoices from jobs, apply automatic break deductions, add manual line items, and export professional PDF invoices with your business details
- **Jobs Statistics Dashboard**: View real-time job metrics at the top of your jobs page, including total jobs, hours worked, and truck type breakdowns
- **Customisable Pagination**: Choose how many jobs to display per page (10, 20, 50, 100, or 200) to match your preferences
- **Auto-Updating Statistics**: Job statistics refresh automatically as you filter or modify jobs

### Improvements
- **Faster Search**: Search results now appear more smoothly as you type
- **Better Truck Type Categorisation**: More accurate grouping and display of truck types in statistics
- **Consistent Hours Display**: All hours now show with two decimal places for easier reading
- **Cleaner Table Layout**: Removed unnecessary sorting options to simplify the interface

## [1.2.0] - 2025-10-01

### What's New
- **Changelog Button**: A new changelog button has been added to easily view release notes and application updates directly from the interface
- **Copy Job Details**: You can now quickly copy job details to your clipboard in a formatted text format, perfect for pasting into external applications or messages

### Improvements
- Enhanced data table performance with optimized rendering and type checking
- Improved keyboard navigation in data table sheets
- Better timezone handling - all times now display consistently regardless of user's timezone
- Date format updated to dd/MM/yy for more compact display
- Added accessibility improvements with proper ARIA labels

## [1.1.0] - 2025-09-23

### What's New
- **Job Duplication**: You can now duplicate existing jobs with a single click, making it faster to create similar work entries
- **Improved Performance**: The job duplication feature now handles large datasets more efficiently

### Improvements
- Fixed an issue where duplicating jobs could sometimes result in incorrect data
- Improved the reliability of job state management
- Enhanced the overall stability of the application

## [1.0.0] - 2025-01-18

### Initial Release

WorkLog is a comprehensive work management application designed to streamline your business operations.

#### Key Features
- **Customer Management**: Keep track of all your customers in one place with detailed profiles and contact information
- **Job Tracking**: Monitor jobs from start to finish with real-time status updates and time tracking
- **Work Log Entries**: Maintain detailed records of all work performed with timestamps and descriptions
- **Secure Authentication**: Enterprise-grade security with Clerk authentication to keep your data safe
- **Data Import/Export**: Easily import existing data via CSV and export your records for backup or analysis
- **Google Drive Integration**: Seamlessly sync and backup your data to Google Drive
- **Mobile Responsive**: Access WorkLog from any device - desktop, tablet, or mobile
- **Dark/Light Themes**: Choose between dark and light themes for comfortable viewing in any environment
- **Advanced Filtering**: Quickly find what you need with powerful search and filter capabilities across all data