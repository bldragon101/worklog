import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (result.errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parsing errors', 
        details: result.errors 
      }, { status: 400 });
    }

    const logs = result.data as any[];
    const importedLogs = [];
    const errors = [];

    for (let i = 0; i < logs.length; i++) {
      const row = logs[i];
      try {
        // Validate required fields
        if (!row.Date || !row.Driver || !row.Customer || !row['Bill To']) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }

        // Parse date
        const date = new Date(row.Date);
        if (isNaN(date.getTime())) {
          errors.push(`Row ${i + 2}: Invalid date format`);
          continue;
        }

        // Parse numeric fields
        const chargedHours = row['Charged Hours'] ? parseFloat(row['Charged Hours']) : null;
        const driverCharge = row['Driver Charge'] ? parseFloat(row['Driver Charge']) : null;

        // Parse boolean fields
        const runsheet = row.Runsheet?.toLowerCase() === 'yes' || row.Runsheet === 'true';
        const invoiced = row.Invoiced?.toLowerCase() === 'yes' || row.Invoiced === 'true';

        const log = await prisma.workLog.create({
          data: {
            date: date,
            driver: row.Driver,
            customer: row.Customer,
            billTo: row['Bill To'],
            registration: row.Registration || '',
            truckType: row['Truck Type'] || '',
            pickup: row.Pickup || '',
            dropoff: row.Dropoff || '',
            runsheet: runsheet,
            invoiced: invoiced,
            chargedHours: chargedHours,
            driverCharge: driverCharge,
            comments: row.Comments || null,
          },
        });

        importedLogs.push(log);
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedLogs.length,
      errors: errors,
      totalRows: logs.length
    });

  } catch (error) {
    console.error('Error importing worklog:', error);
    return NextResponse.json({ error: 'Failed to import worklog' }, { status: 500 });
  }
} 