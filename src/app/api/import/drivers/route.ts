import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { prisma } from '@/lib/api-helpers';
import Papa from 'papaparse';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

interface DriverCSVRow {
  Driver: string;
  Truck: string;
  'Tray Rate'?: string;
  'Crane Rate'?: string;
  'Semi Rate'?: string;
  'Semi Crane Rate'?: string;
  'Breaks (hours)'?: string;
  Type?: string;
  Tolls?: string;
  'Fuel Levy (%)'?: string;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

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

    const drivers = result.data as DriverCSVRow[];
    const importedDrivers = [];
    const errors = [];

    for (let i = 0; i < drivers.length; i++) {
      const row = drivers[i];
      try {
        // Validate required fields
        if (!row.Driver || !row.Truck) {
          errors.push(`Row ${i + 2}: Missing required fields (Driver, Truck)`);
          continue;
        }

        // Parse numeric fields
        const tray = row['Tray Rate'] ? parseInt(row['Tray Rate']) : null;
        const crane = row['Crane Rate'] ? parseInt(row['Crane Rate']) : null;
        const semi = row['Semi Rate'] ? parseInt(row['Semi Rate']) : null;
        const semiCrane = row['Semi Crane Rate'] ? parseInt(row['Semi Crane Rate']) : null;
        const breaks = row['Breaks (hours)'] ? parseFloat(row['Breaks (hours)']) : null;
        const fuelLevy = row['Fuel Levy (%)'] ? parseInt(row['Fuel Levy (%)']) : null;

        // Parse type field
        let type = row.Type || 'Employee';
        if (!['Employee', 'Contractor', 'Subcontractor'].includes(type)) {
          type = 'Employee';
        }

        // Parse boolean field
        const tolls = row.Tolls?.toLowerCase() === 'yes' || row.Tolls === 'true';

        // Only allow tolls and fuel levy for Subcontractors
        const finalTolls = type === 'Subcontractor' ? tolls : false;
        const finalFuelLevy = type === 'Subcontractor' ? fuelLevy : null;

        const driver = await prisma.driver.create({
          data: {
            driver: row.Driver,
            truck: row.Truck,
            tray: tray,
            crane: crane,
            semi: semi,
            semiCrane: semiCrane,
            breaks: breaks,
            type: type as 'Employee' | 'Contractor' | 'Subcontractor',
            tolls: finalTolls,
            fuelLevy: finalFuelLevy,
          },
        });

        importedDrivers.push(driver);
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedDrivers.length,
      errors: errors,
      totalRows: drivers.length
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Error importing drivers:', error);
    return NextResponse.json({ error: 'Failed to import drivers' }, { status: 500 });
  }
}