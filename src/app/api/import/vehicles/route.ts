import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

interface VehicleCSVRow {
  Registration: string;
  'Expiry Date': string;
  Make: string;
  Model: string;
  'Year of Manufacture': string;
  Type: string;
  'Carrying Capacity'?: string;
  'Tray Length'?: string;
  'Crane Reach'?: string;
  'Crane Type'?: string;
  'Crane Capacity'?: string;
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
      return NextResponse.json({ 
        success: false,
        error: 'No file provided' 
      }, { 
        status: 400,
        headers: rateLimitResult.headers 
      });
    }

    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (result.errors.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'CSV parsing errors', 
        details: result.errors 
      }, { 
        status: 400,
        headers: rateLimitResult.headers 
      });
    }

    const vehicles = result.data as VehicleCSVRow[];
    const importedVehicles = [];
    const errors = [];

    for (let i = 0; i < vehicles.length; i++) {
      const row = vehicles[i];
      try {
        // Validate required fields
        if (!row.Registration || !row['Expiry Date'] || !row.Make || !row.Model || 
            !row['Year of Manufacture'] || !row.Type) {
          errors.push(`Row ${i + 2}: Missing required fields (Registration, Expiry Date, Make, Model, Year of Manufacture, Type)`);
          continue;
        }

        // Parse year
        const yearOfManufacture = parseInt(row['Year of Manufacture']);
        if (isNaN(yearOfManufacture)) {
          errors.push(`Row ${i + 2}: Invalid year of manufacture`);
          continue;
        }

        // Parse expiry date
        const expiryDate = new Date(row['Expiry Date']);
        if (isNaN(expiryDate.getTime())) {
          errors.push(`Row ${i + 2}: Invalid expiry date format`);
          continue;
        }

        // Check if vehicle with this registration already exists
        const existingVehicle = await prisma.vehicle.findUnique({
          where: { registration: row.Registration }
        });

        if (existingVehicle) {
          errors.push(`Row ${i + 2}: Vehicle with registration ${row.Registration} already exists`);
          continue;
        }

        const vehicle = await prisma.vehicle.create({
          data: {
            registration: row.Registration,
            expiryDate: expiryDate,
            make: row.Make,
            model: row.Model,
            yearOfManufacture: yearOfManufacture,
            type: row.Type,
            carryingCapacity: row['Carrying Capacity'] || null,
            trayLength: row['Tray Length'] || null,
            craneReach: row['Crane Reach'] || null,
            craneType: row['Crane Type'] || null,
            craneCapacity: row['Crane Capacity'] || null,
          },
        });

        importedVehicles.push(vehicle);
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedVehicles.length,
      errors: errors,
      totalRows: vehicles.length
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Error importing vehicles:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}