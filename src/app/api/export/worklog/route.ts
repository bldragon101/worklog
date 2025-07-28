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
    const where: Prisma.WorkLogWhereInput = {};
    
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

    const logs = await prisma.workLog.findMany({
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

    const csvRows = logs.map(log => [
      log.date.toISOString().split('T')[0],
      log.driver,
      log.customer,
      log.billTo,
      log.registration,
      log.truckType,
      log.pickup,
      log.dropoff,
      log.runsheet ? 'Yes' : 'No',
      log.invoiced ? 'Yes' : 'No',
      log.chargedHours || '',
      log.driverCharge || '',
      log.comments || '',
      log.createdAt.toISOString(),
      log.updatedAt.toISOString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `worklog_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting worklog:', error);
    return NextResponse.json({ error: 'Failed to export worklog' }, { status: 500 });
  }
} 