import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customer = searchParams.get('customer');
    const driver = searchParams.get('driver');

    // Build where clause based on filters
    const where: Prisma.JobsWhereInput = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    
    if (customer) {
      where.customer = { contains: customer, mode: 'insensitive' };
    }
    
    if (driver) {
      where.driver = { contains: driver, mode: 'insensitive' };
    }

    const jobs = await prisma.jobs.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Convert to CSV format
    const csvHeaders = [
      'Date',
      'Driver',
      'Customer',
      'Bill To',
      'Registration',
      'Truck Type',
      'Pickup',
      'Dropoff',
      'Runsheet',
      'Invoiced',
      'Charged Hours',
      'Driver Charge',
      'Comments',
      'Created At',
      'Updated At'
    ];

    const csvRows = jobs.map(job => [
      job.date.toISOString().split('T')[0],
      job.driver,
      job.customer,
      job.billTo,
      job.registration,
      job.truckType,
      job.pickup,
      job.dropoff,
      job.runsheet ? 'Yes' : 'No',
      job.invoiced ? 'Yes' : 'No',
      job.chargedHours || '',
      job.driverCharge || '',
      job.comments || '',
      job.createdAt.toISOString(),
      job.updatedAt.toISOString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `jobs_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting jobs:', error);
    return NextResponse.json({ error: 'Failed to export jobs' }, { status: 500 });
  }
} 