import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    const body = await request.json();
    
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        customer: body.customer,
        billTo: body.billTo,
        contact: body.contact,
        tray: body.tray || null,
        crane: body.crane || null,
        semi: body.semi || null,
        semiCrane: body.semiCrane || null,
        fuelLevy: body.fuelLevy || null,
        tolls: body.tolls || false,
        comments: body.comments || null,
      },
    });
    
    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    await prisma.customer.delete({
      where: { id: customerId },
    });
    
    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
