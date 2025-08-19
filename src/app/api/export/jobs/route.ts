import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const customer = searchParams.get('customer');
    const driver = searchParams.get('driver');

    // Build where clause based on filters
    const where: Prisma.JobsWhereInput = {};
    
    // Handle date filtering - prioritize startDate/endDate over month/year
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (month && year) {
      // Filter by month and year when showing whole month
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const monthStart = new Date(yearNum, monthNum, 1);
      const monthEnd = new Date(yearNum, monthNum + 1, 0); // Last day of month
      
      where.date = {
        gte: monthStart,
        lte: monthEnd,
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
      'Start Time',
      'Finish Time',
      'Runsheet',
      'Invoiced',
      'Charged Hours',
      'Driver Charge',
      'Comments',
      'Created At',
      'Updated At'
    ];

    const csvRows = jobs.map((job: any) => [
      job.date.toISOString().split('T')[0],
      job.driver,
      job.customer,
      job.billTo,
      job.registration,
      job.truckType,
      job.pickup,
      job.dropoff,
      job.startTime ? job.startTime.toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
      job.finishTime ? job.finishTime.toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
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
      ...csvRows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `jobs_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...rateLimitResult.headers
      },
    });
  } catch (error) {
    console.error('Error exporting jobs:', error);
    return NextResponse.json({ error: 'Failed to export jobs' }, { status: 500 });
  }
} 