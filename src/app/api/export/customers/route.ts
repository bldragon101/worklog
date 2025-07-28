import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customer = searchParams.get('customer');
    const billTo = searchParams.get('billTo');

    // Build where clause based on filters
    const where: Prisma.CustomerWhereInput = {};
    
    if (customer) {
      where.customer = { contains: customer, mode: 'insensitive' };
    }
    
    if (billTo) {
      where.billTo = { contains: billTo, mode: 'insensitive' };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Convert to CSV format
    const csvHeaders = [
      'Customer',
      'Bill To',
      'Contact',
      'Tray Rate',
      'Crane Rate',
      'Semi Rate',
      'Semi Crane Rate',
      'Fuel Levy (%)',
      'Tolls',
      'Comments',
      'Created At',
      'Updated At'
    ];

    const csvRows = customers.map(customer => [
      customer.customer,
      customer.billTo,
      customer.contact,
      customer.tray || '',
      customer.crane || '',
      customer.semi || '',
      customer.semiCrane || '',
      customer.fuelLevy || '',
      customer.tolls ? 'Yes' : 'No',
      customer.comments || '',
      customer.createdAt.toISOString(),
      customer.updatedAt.toISOString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `customers_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting customers:', error);
    return NextResponse.json({ error: 'Failed to export customers' }, { status: 500 });
  }
} 